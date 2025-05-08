import React, { useState, useEffect } from 'react';
import { X, Download, Paperclip } from 'lucide-react';
import './EmailView.css';

const EmailView = ({ email, onClose }) => {
    const [emailContent, setEmailContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchEmailContent = async () => {
            try {
                console.log('Fetching email:', email.id); // Debug log
                const response = await fetch(`http://localhost:5000/emails/${email.id}`);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to fetch email content');
                }
                const data = await response.json();
                console.log('Email content:', data); // Debug log
                setEmailContent(data);
            } catch (err) {
                console.error('Error details:', err); // Debug log
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (email) {
            fetchEmailContent();
        }
    }, [email]);

    if (loading) {
        return (
            <div className="email-view">
                <div className="loading-message">Loading email...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="email-view">
                <div className="error-message">
                    <p>Error: {error}</p>
                    <p>Email ID: {email.id}</p>
                    <button className="retry-button" onClick={() => window.location.reload()}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!emailContent) {
        return (
            <div className="email-view">
                <div className="error-message">No email content available</div>
            </div>
        );
    }

    return (
        <div className="email-view">
            <div className="email-view-header">
                <div className="email-view-title">
                    <h2>{emailContent.subject}</h2>
                    <button className="close-button" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="email-view-meta">
                    <div className="email-view-sender">
                        <strong>From:</strong> {emailContent.sender}
                    </div>
                    <div className="email-view-time">
                        <strong>Date:</strong> {new Date(emailContent.time).toLocaleString()}
                    </div>
                </div>
            </div>
            <div className="email-view-content">
                {emailContent.attachments && emailContent.attachments.length > 0 && (
                    <div className="email-attachments">
                        <h3>Attachments:</h3>
                        {emailContent.attachments.map((attachment, index) => (
                            <div key={index} className="attachment-item">
                                <Paperclip size={16} />
                                <span>{attachment.filename}</span>
                                <button
                                    className="download-button"
                                    onClick={() => {
                                        const blob = new Blob([attachment.content], { type: attachment.contentType });
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = attachment.filename;
                                        document.body.appendChild(a);
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                        document.body.removeChild(a);
                                    }}
                                >
                                    <Download size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <div className="email-body" dangerouslySetInnerHTML={{ __html: emailContent.content }} />
            </div>
        </div>
    );
};

export default EmailView; 