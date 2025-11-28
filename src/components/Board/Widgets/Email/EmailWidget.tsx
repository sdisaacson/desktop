import React, { useState, useEffect } from "react";
import "./EmailWidget.css";
import DeleteWidget from "../DeleteWidget";
import { Widget } from "../../Board";
import { useBoard } from "../../../../hooks/useBoard";
import { useFirestore } from "../../../../hooks/useFirestore";
import { useSelector } from "react-redux";
import { GlobalData } from "../../../../store/global";
import axios from "axios";
import { Settings, RefreshCw, Plus, ChevronLeft, ChevronRight } from "react-feather";
import EmailReader from "./EmailReader";

interface EmailWidgetProps {
    id: string;
    theme: string;
    widgetData: Widget;
}

interface ServerConfig {
    host: string;
    port: number;
    security: 'None' | 'SSL/TLS' | 'STARTTLS';
    user: string;
    password: string;
}

interface EmailConfig {
    imap: ServerConfig;
    smtp: ServerConfig;
    limit: number;
}

export default function EmailWidget({ id, theme, widgetData }: EmailWidgetProps) {
    const { save } = useBoard();
    const { saveToFirestore } = useFirestore();
    const { widgets, layouts, dashboards, activeDashboard } = useSelector((state: GlobalData) => state);

    const [view, setView] = useState<'inbox' | 'read' | 'compose' | 'config'>('inbox');
    
    // Load config or defaults
    const initialConfig = (widgetData as any).emailConfig || {
        imap: { host: '', port: 993, security: 'SSL/TLS', user: '', password: '' },
        smtp: { host: '', port: 587, security: 'STARTTLS', user: '', password: '' }
    };
    
    const [config, setConfig] = useState<EmailConfig>(initialConfig);
    const [emails, setEmails] = useState<any[]>([]);
    const [selectedEmail, setSelectedEmail] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    
    // Compose state
    const [composeTo, setComposeTo] = useState("");
    const [composeSubject, setComposeSubject] = useState("");
    const [composeBody, setComposeBody] = useState("");

    // Config Input State
    const [imapHost, setImapHost] = useState(initialConfig.imap.host);
    const [imapPort, setImapPort] = useState(initialConfig.imap.port);
    const [imapSecurity, setImapSecurity] = useState(initialConfig.imap.security);
    const [imapUser, setImapUser] = useState(initialConfig.imap.user);
    const [imapPass, setImapPass] = useState(initialConfig.imap.password);

    const [smtpHost, setSmtpHost] = useState(initialConfig.smtp.host);
    const [smtpPort, setSmtpPort] = useState(initialConfig.smtp.port);
    const [smtpSecurity, setSmtpSecurity] = useState(initialConfig.smtp.security);
    const [smtpUser, setSmtpUser] = useState(initialConfig.smtp.user);
    const [smtpPass, setSmtpPass] = useState(initialConfig.smtp.password);
    
    // Default limit to 10 if not set in config
    const [emailLimit, setEmailLimit] = useState(initialConfig.limit || 10);

    useEffect(() => {
        if (!config.imap?.user) {
            setView('config');
        } else {
            fetchEmails();
        }
        // eslint-disable-next-line
    }, []);

    const getBaseUrl = () => {
        return window.location.hostname === "localhost" 
            ? "http://127.0.0.1:5001/demo-local/us-central1"
            : "https://us-central1-your-project.cloudfunctions.net";
    };

    const fetchEmails = async () => {
        if (!config.imap?.user) return;
        setLoading(true);
        try {
            const res = await axios.post(`${getBaseUrl()}/fetchEmails`, {
                config, // Pass full config object structure
                page,
                limit: config.limit || 10 // Use configured limit
            });
            setEmails(res.data.emails);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        // Validation
        if (!imapHost || !imapUser || !imapPass) {
            alert("Please fill in all IMAP required fields.");
            return;
        }
        if (!smtpHost || !smtpUser || !smtpPass) {
            alert("Please fill in all SMTP required fields.");
            return;
        }

        const newConfig: any = {
            imap: { host: imapHost, port: imapPort, security: imapSecurity as any, user: imapUser, password: imapPass },
            smtp: { host: smtpHost, port: smtpPort, security: smtpSecurity as any, user: smtpUser, password: smtpPass },
            limit: emailLimit
        };
        
        setConfig(newConfig);
        
        // Save to store
        const currentWidgetsList = activeDashboard === "home" ? widgets : dashboards.find(d => d.id === activeDashboard)?.widgets || [];
        const currentLayoutList = activeDashboard === "home" ? layouts : dashboards.find(d => d.id === activeDashboard)?.layouts || [];
        
        const newWidgets = currentWidgetsList.map(w => w.i === id ? { ...w, emailConfig: newConfig } : w);
        save({ layout: currentLayoutList, widgets: newWidgets });
        await saveToFirestore({ widgets: newWidgets });

        setView('inbox');
        fetchEmails(); // Reload with new config
    };

    const handleTestConnection = async () => {
        setLoading(true);
        try {
            // Test Fetch
            const tempConfig = {
                imap: { host: imapHost, port: imapPort, security: imapSecurity, user: imapUser, password: imapPass },
                smtp: { host: smtpHost, port: smtpPort, security: smtpSecurity, user: smtpUser, password: smtpPass }
            };
            await axios.post(`${getBaseUrl()}/fetchEmails`, {
                config: tempConfig,
                page: 1,
                limit: 1
            });
            alert("Connection Successful!");
        } catch (err: any) {
            alert("Connection Failed: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleSendEmail = async () => {
        setLoading(true);
        try {
            await axios.post(`${getBaseUrl()}/sendEmail`, {
                config,
                to: composeTo,
                subject: composeSubject,
                body: composeBody
            });
            alert("Sent!");
            setComposeBody("");
            setComposeSubject("");
            setComposeTo("");
            setView('inbox');
        } catch (err: any) {
            alert("Error sending: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`widget EmailWidget ${theme}`}>
            <div className="header">
                <div className="widgetTitle">Email Reader</div>
                <div className="widgetButtons" style={{display: 'flex', gap: 5}} onMouseDown={(e) => e.stopPropagation()}>
                    <button className="email-btn" onClick={() => setView('config')}><Settings size={12}/></button>
                    <DeleteWidget id={id} />
                </div>
            </div>

            <div className="content">
                {view === 'config' && (
                    <div className="email-config">
                        <div className="config-section">
                            <h4>IMAP Settings (Incoming)</h4>
                            <input placeholder="Hostname (e.g. imap.gmail.com)" value={imapHost} onChange={e => setImapHost(e.target.value)} />
                            <div className="row">
                                <input type="number" placeholder="Port" value={imapPort} onChange={e => setImapPort(parseInt(e.target.value))} style={{flex: 1}} />
                                <select value={imapSecurity} onChange={e => setImapSecurity(e.target.value as any)} style={{flex: 1}}>
                                    <option value="SSL/TLS">SSL/TLS</option>
                                    <option value="STARTTLS">STARTTLS</option>
                                    <option value="None">None</option>
                                </select>
                            </div>
                            <input placeholder="Username" value={imapUser} onChange={e => setImapUser(e.target.value)} />
                            <input type="password" placeholder="Password" value={imapPass} onChange={e => setImapPass(e.target.value)} />
                        </div>

                        <div className="config-section">
                            <h4>SMTP Settings (Outgoing)</h4>
                            <input placeholder="Hostname (e.g. smtp.gmail.com)" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} />
                            <div className="row">
                                <input type="number" placeholder="Port" value={smtpPort} onChange={e => setSmtpPort(parseInt(e.target.value))} style={{flex: 1}} />
                                <select value={smtpSecurity} onChange={e => setSmtpSecurity(e.target.value as any)} style={{flex: 1}}>
                                    <option value="SSL/TLS">SSL/TLS</option>
                                    <option value="STARTTLS">STARTTLS</option>
                                    <option value="None">None</option>
                                </select>
                            </div>
                            <input placeholder="Username" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} />
                            <input type="password" placeholder="Password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} />
                        </div>

                        <div className="config-section">
                            <h4>General Settings</h4>
                            <div className="row" style={{alignItems: 'center'}}>
                                <label style={{fontSize: '12px', color: '#666', marginRight: 10}}>Emails per page:</label>
                                <input 
                                    type="number" 
                                    value={emailLimit} 
                                    min={1} 
                                    max={50} 
                                    onChange={e => setEmailLimit(parseInt(e.target.value) || 10)} 
                                    style={{width: 60}}
                                />
                            </div>
                        </div>

                        <div className="config-actions">
                            <button className="test-btn" onClick={handleTestConnection} disabled={loading}>
                                {loading ? "Testing..." : "Test Connection"}
                            </button>
                            <button className="save-btn" onClick={handleSaveConfig} disabled={loading}>
                                Save Configuration
                            </button>
                        </div>
                    </div>
                )}

                {view === 'inbox' && (
                    <>
                        <div className="email-toolbar">
                            <button className="email-btn" onClick={fetchEmails}><RefreshCw size={12}/> Refresh</button>
                            <button className="email-btn" onClick={() => setView('compose')}><Plus size={12}/> Compose</button>
                        </div>
                        <div className="email-list">
                            {loading ? <div style={{padding: 10}}>Loading...</div> : emails.map(email => (
                                <div key={email.uid} className="email-item" onClick={() => { setSelectedEmail(email); setView('read'); }}>
                                    <div className="email-header">
                                        <span>{email.from.name || email.from.address}</span>
                                        <span className="email-date">{new Date(email.date).toLocaleDateString()}</span>
                                    </div>
                                    <div className="email-subject">{email.subject}</div>
                                </div>
                            ))}
                        </div>
                        <div className="email-pagination">
                            <button className="email-btn" disabled={page <= 1} onClick={() => { setPage(p => p - 1); fetchEmails(); }}><ChevronLeft size={12}/></button>
                            <span>Page {page}</span>
                            <button className="email-btn" onClick={() => { setPage(p => p + 1); fetchEmails(); }}><ChevronRight size={12}/></button>
                        </div>
                    </>
                )}

                {view === 'read' && selectedEmail && (
                    <EmailReader 
                        email={selectedEmail} 
                        config={config}
                        onBack={() => setView('inbox')}
                        onReply={() => {
                            setComposeTo(selectedEmail.from.address);
                            setComposeSubject(`Re: ${selectedEmail.subject}`);
                            setView('compose');
                        }}
                        onForward={() => {
                            setComposeSubject(`Fwd: ${selectedEmail.subject}`);
                            setView('compose');
                        }}
                    />
                )}

                {view === 'compose' && (
                    <div className="email-compose">
                        <div className="email-toolbar">
                            <button className="email-btn" onClick={() => setView('inbox')}>Cancel</button>
                        </div>
                        <input placeholder="To" value={composeTo} onChange={e => setComposeTo(e.target.value)} />
                        <input placeholder="Subject" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} />
                        <textarea placeholder="Message..." value={composeBody} onChange={e => setComposeBody(e.target.value)} />
                        <button className="email-btn" style={{background: 'var(--coolYellow)', justifyContent: 'center'}} onClick={handleSendEmail}>Send</button>
                    </div>
                )}
            </div>
        </div>
    );
}
