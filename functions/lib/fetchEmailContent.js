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
exports.fetchEmailContent = void 0;
const functions = __importStar(require("firebase-functions"));
const imap = __importStar(require("imap-simple"));
const mailparser_1 = require("mailparser");
const cors_1 = __importDefault(require("cors"));
const corsHandler = (0, cors_1.default)({ origin: true });
const getAddressText = (addr) => {
    if (!addr)
        return '';
    if (Array.isArray(addr)) {
        return addr.map(a => a.text).join(', ');
    }
    return addr.text;
};
exports.fetchEmailContent = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        const { config, uid } = req.body;
        const imapSettings = config.imap || config;
        const imapConfig = {
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
                markSeen: true
            };
            const messages = await connection.search([['UID', uid]], fetchOptions);
            if (messages.length === 0) {
                throw new Error("Email not found");
            }
            const raw = messages[0].parts[0].body;
            const parsed = await (0, mailparser_1.simpleParser)(raw);
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
        }
        catch (err) {
            console.error(err);
            res.status(500).send({ error: err.message });
        }
    });
});
//# sourceMappingURL=fetchEmailContent.js.map