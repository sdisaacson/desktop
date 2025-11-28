import * as admin from 'firebase-admin';

admin.initializeApp();

export { fetchEmails } from './fetchEmails';
export { fetchEmailContent } from './fetchEmailContent';
export { sendEmail } from './sendEmail';
export { downloadAttachment } from './downloadAttachment';
