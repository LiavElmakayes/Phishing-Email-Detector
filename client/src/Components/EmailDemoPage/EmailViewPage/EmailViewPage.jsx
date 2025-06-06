import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { FaShieldAlt, FaExclamationTriangle, FaExternalLinkAlt } from 'react-icons/fa';
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
    const [isChatStarted, setIsChatStarted] = useState(false);
    const chatbotRef = useRef(null);

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

    const handleNewAnalysis = (newScore) => {
        setAiAnalysisScore(newScore);
    };

    const handleStartChat = () => {
        setIsChatStarted(true);
        // Smooth scroll to chatbot after a short delay to ensure it's rendered
        setTimeout(() => {
            chatbotRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    // Function to parse and render links in the content
    const renderEmailContent = (content) => {
        if (!content) return null;

        // Regular expression to match URLs, excluding both opening and closing brackets
        const urlRegex = /\[?(https?:\/\/[^\s\]]+)\]?/g;

        // Split the content by URLs and map through the parts
        const parts = content.split(urlRegex);

        return parts.map((part, index) => {
            // If this part matches a URL
            if (part.match(urlRegex)) {
                // Remove any brackets from the URL
                const cleanUrl = part.replace(/[\[\]]/g, '');
                return (
                    <a
                        key={index}
                        href={cleanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="email-link"
                        title={`Opens in new tab: ${cleanUrl}`}
                    >
                        {cleanUrl}
                        <FaExternalLinkAlt className="external-link-icon" />
                    </a>
                );
            }
            // If it's not a URL, return the text as is
            return part;
        });
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
    const icon = isLegitimate ? <CheckCircle size={40} className="email-legitimate-icon" /> : <FaExclamationTriangle size={40} className="email-alert-icon" />;

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
                    <>
                        <div className={`email-scan-result ${isLegitimate ? 'legitimate' : 'phishing'}`}>
                            <div className="email-result-icon">{icon}</div>
                            <div className="email-result-text-container">
                                <span className="email-result-percentage">Risk Score: {percentage}% Phishing</span>
                                {aiAnalysisScore !== null && (
                                    <span className="ai-analysis-note">(Updated by AI Analysis)</span>
                                )}
                                <p className="email-result-legitimacy">
                                    {isLegitimate ? (
                                        'This email appears to be legitimate - No phishing indicators found.'
                                    ) : (
                                        'This email has been flagged as potentially phishing - Proceed with caution.'
                                    )}
                                </p>
                            </div>
                        </div>
                        <button
                            className="start-chat-top-button"
                            onClick={handleStartChat}
                        >
                            <FaShieldAlt size={20} />
                            Start Chat with AI Assistant
                        </button>
                    </>
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

                <div className="email-body">
                    <div className="email-content-text">
                        {email.content ? (
                            <pre>{renderEmailContent(email.content)}</pre>
                        ) : (
                            <p className="no-content">No email content available</p>
                        )}
                    </div>
                </div>

                {email && scanResult && (
                    <div ref={chatbotRef}>
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
                            isStarted={isChatStarted}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmailViewPage; 