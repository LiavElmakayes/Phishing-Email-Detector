import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { FaShieldAlt, FaExclamationTriangle } from 'react-icons/fa';
import ChatBot from '../../ChatBot/ChatBot';
import './EmailViewPage.css';

const EmailViewPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [email, setEmail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [scanResult, setScanResult] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [aiAnalysisScore, setAiAnalysisScore] = useState(null);

    useEffect(() => {
        const fetchEmail = async () => {
            try {
                console.log('Fetching email with ID:', id);
                const response = await fetch(`http://localhost:5000/emails/${id}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch email');
                }
                const data = await response.json();
                console.log('Received email data:', data);
                setEmail(data);

                // Try to get cached scan result first
                const cachedEmails = localStorage.getItem('cachedEmails');
                if (cachedEmails) {
                    const emails = JSON.parse(cachedEmails);
                    const cachedEmail = emails.find(e => e.id === id);
                    if (cachedEmail) {
                        console.log('Found cached email:', cachedEmail);
                        // Handle both formats of scan results
                        if (typeof cachedEmail.scanResult === 'number') {
                            // Convert number format to object format
                            const result = {
                                result: cachedEmail.scanResult,
                                legitimacy: cachedEmail.legitimacy || (cachedEmail.scanResult >= 5.0 ? 'Phishing' : 'Legitimate')
                            };
                            console.log('Using converted cached scan result:', result);
                            setScanResult(result);
                        } else if (cachedEmail.scanResult && typeof cachedEmail.scanResult === 'object') {
                            console.log('Using cached scan result object:', cachedEmail.scanResult);
                            setScanResult(cachedEmail.scanResult);
                        }
                        return;
                    }
                }

                // If no cached result found, scan the email
                console.log('No cached scan result found, scanning email...');
                scanEmail(data);
            } catch (err) {
                console.error('Error fetching email:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchEmail();
        }
    }, [id]);

    const scanEmail = async (emailData) => {
        setIsScanning(true);
        try {
            const response = await fetch('http://localhost:5000/analyze-content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subject: emailData.subject,
                    content: emailData.content,
                    sender: emailData.sender
                })
            });

            if (!response.ok) {
                throw new Error('Failed to scan email');
            }

            const result = await response.json();
            console.log('Raw scan result:', result);
            console.log('Result value:', result.result);
            console.log('Legitimacy:', result.legitimacy);
            setScanResult(result);
        } catch (err) {
            console.error('Error scanning email:', err);
            setError('Failed to scan email');
        } finally {
            setIsScanning(false);
        }
    };

    const getProgressBarColor = (percentage) => {
        let r, g, b;

        if (percentage <= 25) {
            const ratio = percentage / 25;
            r = Math.round(0 + (76 - 0) * ratio);
            g = Math.round(200 + (175 - 200) * ratio);
            b = Math.round(0 + (80 - 0) * ratio);
        } else if (percentage <= 50) {
            const ratio = (percentage - 25) / 25;
            r = Math.round(76 + (255 - 76) * ratio);
            g = Math.round(175 + (152 - 175) * ratio);
            b = Math.round(80 + (0 - 80) * ratio);
        } else {
            const ratio = (percentage - 50) / 50;
            r = Math.round(255 + (244 - 255) * ratio);
            g = Math.round(152 + (67 - 152) * ratio);
            b = Math.round(0 + (54 - 0) * ratio);
        }

        return `rgb(${r}, ${g}, ${b})`;
    };

    const handleNewAnalysis = (newScore) => {
        setAiAnalysisScore(newScore);
    };

    if (!id) {
        return null;
    }

    if (loading) {
        return <div className="loading-message">Loading email...</div>;
    }

    if (error) {
        return <div className="error-message">Error: {error}</div>;
    }

    if (!email) {
        return <div className="error-message">Email not found</div>;
    }

    // Function to format the sender information
    const formatSender = (sender) => {
        if (!sender) return 'Unknown Sender';

        // If the sender is already in the correct format, return it
        if (sender.includes('<') && sender.includes('>')) {
            return sender;
        }

        // If it's just an email address, return it
        if (sender.includes('@')) {
            return sender;
        }

        // Otherwise, try to construct the full sender format
        return `${sender} <${email.sender}>`;
    };

    const percentage = aiAnalysisScore !== null ? aiAnalysisScore : (scanResult ? (scanResult.result || 0) * 10 : 0);
    const isLegitimate = aiAnalysisScore !== null ? aiAnalysisScore < 50 : (scanResult ? scanResult.legitimacy === 'Legitimate' : false);
    const icon = isLegitimate ? <FaShieldAlt size={40} className="email-legitimate-icon" /> : <FaExclamationTriangle size={40} className="email-alert-icon" />;
    const progressBarColor = getProgressBarColor(percentage);

    return (
        <div className="email-view-content">
            <button className="back-button" onClick={() => navigate('/demo')}>
                <ArrowLeft size={20} />
                Back to Inbox
            </button>
            <div className="email-details">
                {isScanning ? (
                    <div className="scanning-message">Scanning email for phishing indicators...</div>
                ) : scanResult && (
                    <div className={`email-scan-result ${isLegitimate ? 'legitimate' : 'phishing'}`}>
                        <div className="email-result-icon">{icon}</div>
                        <div className="email-result-text">
                            <span className="email-result-percentage">Risk Score: {percentage}% Phishing</span>
                            {aiAnalysisScore !== null && (
                                <span className="ai-analysis-note">(Updated by AI Analysis)</span>
                            )}
                        </div>
                        <div className="email-progress-bar">
                            <div
                                className="email-progress-bar-fill"
                                style={{ width: `${percentage}%`, backgroundColor: progressBarColor }}
                            ></div>
                        </div>
                        <div className="email-result-details">
                            {isLegitimate ? (
                                <p>This email appears to be legitimate - No phishing indicators found.</p>
                            ) : (
                                <p>This email has been flagged as potentially phishing - Proceed with caution.</p>
                            )}
                        </div>
                    </div>
                )}

                <h1 className="email-subject">{email.subject}</h1>
                <div className="email-meta">
                    <div className="email-sender">
                        <strong>From:</strong> {formatSender(email.sender)}
                    </div>
                    <div className="email-time">
                        <strong>Date:</strong> {new Date(email.time).toLocaleString()}
                    </div>
                </div>

                <div className="email-body" dangerouslySetInnerHTML={{ __html: email.content }} />

                {email && scanResult && (
                    <ChatBot
                        email={{
                            subject: email.subject || '',
                            sender: email.sender || '',
                            content: email.content || '',
                            metadata: {
                                scanResult: scanResult.result || 0,
                                legitimacy: scanResult.legitimacy || 'Unknown',
                                spamAssassinScore: scanResult.result || 0,
                                spamAssassinDetails: scanResult.details || {},
                                rawScanResult: scanResult.raw || {}
                            }
                        }}
                        initialScanResult={{
                            result: scanResult.result || 0,
                            legitimacy: scanResult.legitimacy || 'Unknown'
                        }}
                        onNewAnalysis={handleNewAnalysis}
                    />
                )}
            </div>
        </div>
    );
};

export default EmailViewPage; 