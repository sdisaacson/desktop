import * as functions from 'firebase-functions';
import * as nodemailer from 'nodemailer';
import cors from 'cors';

const corsHandler = cors({ origin: true });

export const sendEmail = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        const { config, to, subject, body, cc, bcc, inReplyTo, references } = req.body;
        
        const smtpSettings = config.smtp || config;

        const transporter = nodemailer.createTransport({
            host: smtpSettings.host,
            port: smtpSettings.port || 587,
            secure: smtpSettings.security === 'SSL/TLS' || smtpSettings.port === 465, 
            auth: {
                user: smtpSettings.user,
                pass: smtpSettings.password
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        const mailOptions = {
            from: smtpSettings.user,
            to,
            cc,
            bcc,
            subject,
            html: body,
            inReplyTo,
            references
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            res.status(200).send({ success: true, messageId: info.messageId });
        } catch (err: any) {
            console.error(err);
            res.status(500).send({ error: err.message });
        }
    });
});
