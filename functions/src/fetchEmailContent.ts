import * as functions from 'firebase-functions';
import * as imap from 'imap-simple';
import { simpleParser, AddressObject } from 'mailparser';
import cors from 'cors';

const corsHandler = cors({ origin: true });

const getAddressText = (addr: AddressObject | AddressObject[] | undefined): string => {
    if (!addr) return '';
    if (Array.isArray(addr)) {
        return addr.map(a => a.text).join(', ');
    }
    return addr.text;
};

export const fetchEmailContent = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        const { config, uid } = req.body;
        
        const imapSettings = config.imap || config;

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

            const fetchOptions = {
                bodies: [''], // Fetch whole email
                markSeen: true
            };

            const messages = await connection.search([['UID', uid]], fetchOptions);
            if (messages.length === 0) {
                throw new Error("Email not found");
            }

            const raw = messages[0].parts[0].body;
            const parsed = await simpleParser(raw);

            const result = {
                subject: parsed.subject,
                from: getAddressText(parsed.from),
                to: getAddressText(parsed.to),
                cc: getAddressText(parsed.cc),
                date: parsed.date,
                html: parsed.html || parsed.textAsHtml || parsed.text, 
                attachments: parsed.attachments.map(att => ({
                    filename: att.filename,
                    contentType: att.contentType,
                    size: att.size,
                    checksum: att.checksum 
                }))
            };

            connection.end();
            res.status(200).send(result);

        } catch (err: any) {
            console.error(err);
            res.status(500).send({ error: err.message });
        }
    });
});