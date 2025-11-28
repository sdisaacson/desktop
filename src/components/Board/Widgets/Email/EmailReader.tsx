import React, { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { ArrowLeft, Download, CornerUpLeft, CornerUpRight, Trash2 } from "react-feather";
import "./EmailReader.css";
import axios from "axios";

interface EmailReaderProps {
    email: any; // Full email object (fetched via content)
    onBack: () => void;
    onReply: () => void;
    onForward: () => void;
    config: any; // SMTP/IMAP config for download
}

export default function EmailReader({ email, onBack, onReply, onForward, config }: EmailReaderProps) {
    const [fullContent, setFullContent] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch full content including body
        const fetchContent = async () => {
            setLoading(true);
            try {
                // Determine base URL based on environment
                const baseUrl = window.location.hostname === "localhost" 
                    ? "http://127.0.0.1:5001/demo-local/us-central1"
                    : "https://us-central1-your-project.cloudfunctions.net"; // Update for prod

                const res = await axios.post(`${baseUrl}/fetchEmailContent`, {
                    config,
                    uid: email.uid
                });
                setFullContent(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, [email, config]);

    const handleDownload = async (filename: string) => {
        // Call downloadAttachment cloud function
        alert("Download not fully implemented in demo");
    };

    if (loading) return <div className="email-reader">Loading...</div>;
    if (!fullContent) return <div className="email-reader">Failed to load content.</div>;

    const sanitizedHtml = DOMPurify.sanitize(fullContent.html || fullContent.text || "", {
        USE_PROFILES: { html: true }
    });

    return (
        <div className="email-reader">
            <div className="email-toolbar">
                <button className="email-btn" onClick={onBack}><ArrowLeft size={14}/> Back</button>
                <button className="email-btn" onClick={onReply}><CornerUpLeft size={14}/> Reply</button>
                <button className="email-btn" onClick={onForward}><CornerUpRight size={14}/> Forward</button>
            </div>

            <div className="reader-header">
                <div className="reader-subject">{fullContent.subject}</div>
                <div className="reader-meta">
                    <div>From: {fullContent.from}</div>
                    <div>To: {fullContent.to}</div>
                    <div>{new Date(fullContent.date).toLocaleString()}</div>
                </div>
            </div>

            <div className="reader-body" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />

            {fullContent.attachments && fullContent.attachments.length > 0 && (
                <div className="reader-attachments">
                    <strong>Attachments:</strong>
                    <div>
                        {fullContent.attachments.map((att: any, idx: number) => (
                            <span key={idx} className="attachment-item" onClick={() => handleDownload(att.filename)}>
                                <Download size={12} style={{marginRight: 4}}/> {att.filename}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
