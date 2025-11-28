"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const functions = __importStar(require("firebase-functions"));
const nodemailer = __importStar(require("nodemailer"));
const cors_1 = __importDefault(require("cors"));
const corsHandler = (0, cors_1.default)({ origin: true });
exports.sendEmail = functions.https.onRequest((req, res) => {
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
        }
        catch (err) {
            console.error(err);
            res.status(500).send({ error: err.message });
        }
    });
});
//# sourceMappingURL=sendEmail.js.map