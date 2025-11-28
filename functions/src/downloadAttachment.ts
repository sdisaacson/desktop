import * as functions from 'firebase-functions';
import * as imap from 'imap-simple';
import { simpleParser } from 'mailparser';
import cors from 'cors';

const corsHandler = cors({ origin: true });

export const downloadAttachment = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        const { config, uid, filename } = req.body;
        
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
                bodies: [''],
                markSeen: false
            };

            const messages = await connection.search([['UID', uid]], fetchOptions);
            if (messages.length === 0) throw new Error("Email not found");

            const raw = messages[0].parts[0].body;
            const parsed = await simpleParser(raw);

            const attachment = parsed.attachments.find(att => att.filename === filename);

            if (!attachment) throw new Error("Attachment not found");

            connection.end();
            
            // Return as base64
            res.status(200).send({ 
                content: attachment.content.toString('base64'),
                contentType: attachment.contentType,
                filename: attachment.filename
            });

        } catch (err: any) {
            console.error(err);
            res.status(500).send({ error: err.message });
        }
    });
});
