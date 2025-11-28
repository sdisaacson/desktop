import * as functions from 'firebase-functions';
import * as imap from 'imap-simple';
import cors from 'cors';

const corsHandler = cors({ origin: true });

export const fetchEmails = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        const { config, limit, page } = req.body;

        const imapSettings = config.imap || config; // Support new structure or fallback

        if (!imapSettings.user || !imapSettings.password || !imapSettings.host) {
            res.status(400).send({ error: "Missing IMAP config" });
            return;
        }

        const imapConfig: imap.ImapSimpleOptions = {
            imap: {
                user: imapSettings.user,
                password: imapSettings.password,
                host: imapSettings.host,
                port: imapSettings.port || 993,
                tls: imapSettings.security === 'SSL/TLS' || imapSettings.tls === true || imapSettings.port === 993,
                autotls: imapSettings.security === 'STARTTLS' ? 'always' : 'never',
                tlsOptions: { rejectUnauthorized: false }, 
                authTimeout: 3000
            }
        };

        try {
            const connection = await imap.connect(imapConfig);
            await connection.openBox('INBOX');

            // Fetch all UIDs to get the total count (metadata only)
            const allMessages = await connection.search(['ALL'], { bodies: [] });
            const total = allMessages.length;

            if (total === 0) {
                connection.end();
                res.status(200).send({ emails: [], total: 0 });
                return;
            }

            // Pagination logic (Sequence numbers: 1 = Oldest, Total = Newest)
            // Page 1 (Newest) = Total down to (Total - Limit + 1)
            const end = total - ((page - 1) * limit);
            const start = Math.max(1, end - limit + 1);

            const fetchOptions = {
                bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'],
                struct: true
            };

            const messages = await connection.search([`${start}:${end}`], fetchOptions);
            
            const emails = messages.map((msg: any) => ({
                uid: msg.attributes.uid,
                seq: msg.seqNo,
                from: msg.parts[0].body.from[0],
                subject: msg.parts[0].body.subject[0],
                date: msg.parts[0].body.date[0],
                hasAttachment: false 
            })).reverse(); 

            connection.end();
            res.status(200).send({ emails, total });

        } catch (err: any) {
            console.error("IMAP Error:", err);
            res.status(500).send({ error: err.message });
        }
    });
});