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
exports.fetchEmails = void 0;
const functions = __importStar(require("firebase-functions"));
const imap = __importStar(require("imap-simple"));
const cors_1 = __importDefault(require("cors"));
const corsHandler = (0, cors_1.default)({ origin: true });
exports.fetchEmails = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        const { config, limit, page } = req.body;
        const imapSettings = config.imap || config; // Support new structure or fallback
        if (!imapSettings.user || !imapSettings.password || !imapSettings.host) {
            res.status(400).send({ error: "Missing IMAP config" });
            return;
        }
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
            const emails = messages.map((msg) => ({
                uid: msg.attributes.uid,
                seq: msg.seqNo,
                from: msg.parts[0].body.from[0],
                subject: msg.parts[0].body.subject[0],
                date: msg.parts[0].body.date[0],
                hasAttachment: false
            })).reverse();
            connection.end();
            res.status(200).send({ emails, total });
        }
        catch (err) {
            console.error("IMAP Error:", err);
            res.status(500).send({ error: err.message });
        }
    });
});
//# sourceMappingURL=fetchEmails.js.map