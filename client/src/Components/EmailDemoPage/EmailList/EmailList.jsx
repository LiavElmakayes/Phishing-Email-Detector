import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, AlertCircle, File, Shield, AlertTriangle } from "lucide-react";
import './EmailList.css';

const EmailList = ({ emails, onToggleStar, onToggleImportant }) => {
    const navigate = useNavigate();

    const handleStarClick = (e, email) => {
        e.stopPropagation();
        onToggleStar(email);
    };

    const handleImportantClick = (e, email) => {
        e.stopPropagation();
        onToggleImportant(email);
    };

    const handleCheckboxClick = (e) => {
        e.stopPropagation();
    };

    const handleEmailClick = (email) => {
        navigate(`/demo/${email.id}`);
    };

    const getRiskIndicator = (scanResult) => {
        const score = scanResult * 10; // Convert to percentage
        if (score <= 25) {
            return <Shield className="email-list-icon safe" />;
        } else if (score <= 50) {
            return <Shield className="email-list-icon warning" />;
        } else {
            return <AlertTriangle className="email-list-icon danger" />;
        }
    };

    return (
        <div className="email-list">
            <div className="email-list-content">
                {emails.map((email) => (
                    <div
                        key={email.id}
                        className={`email-list-item ${!email.read ? 'unread' : ''}`}
                        onClick={() => handleEmailClick(email)}
                    >
                        <div className="email-list-checkbox-container">
                            <input
                                type="checkbox"
                                className="email-list-checkbox"
                                onClick={handleCheckboxClick}
                            />
                            <Star
                                className={`email-list-icon ${email.starred ? 'starred' : ''}`}
                                onClick={(e) => handleStarClick(e, email)}
                            />
                            <AlertCircle
                                className={`email-list-icon ${email.important ? 'important' : ''}`}
                                onClick={(e) => handleImportantClick(e, email)}
                            />
                        </div>

                        <div className="email-list-sender">
                            <span className={!email.read ? 'unread' : ''}>{email.sender}</span>
                        </div>

                        <div className="email-list-content-container">
                            <span className={`email-list-subject ${!email.read ? 'unread' : ''}`}>{email.subject}</span>
                            <span className="email-list-separator">-</span>
                            <span className="email-list-preview">{email.snippet}</span>
                        </div>

                        {email.hasAttachment && (
                            <div className="email-list-attachment">
                                <File className="email-list-icon" />
                            </div>
                        )}

                        <div className="email-list-risk">
                            {email.scanResult !== undefined && getRiskIndicator(email.scanResult)}
                            <span className="email-list-risk-score">
                                {email.scanResult !== undefined ? (
                                    <span>{Math.round(email.scanResult * 10)}%</span>
                                ) : 'N/A'}
                            </span>
                        </div>

                        <div className="email-list-time">
                            {email.time}
                        </div>
                    </div>
                ))}
            </div>
            <div className="email-list-pagination">
                1-50 of 13,624
            </div>
        </div>
    );
};

export default EmailList; 