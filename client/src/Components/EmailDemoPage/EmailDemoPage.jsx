import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from './Sidebar/Sidebar';
import Header from './Header/Header';
import Toolbar from './Toolbar/Toolbar';
import Tabs from './Tabs/Tabs';
import EmailList from './EmailList/EmailList';
import EmailViewPage from './EmailViewPage/EmailViewPage';
import RightSidebar from './RightSidebar/RightSidebar';
import './EmailDemoPage.css';

const EmailDemoPage = () => {
    const { id } = useParams();
    const [selectedTab, setSelectedTab] = useState('primary');
    const [emails, setEmails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [scanningEmails, setScanningEmails] = useState(false);

    const scanEmail = async (emailData) => {
        try {
            console.log('Scanning email:', {
                subject: emailData.subject,
                sender: emailData.sender,
                contentLength: emailData.content?.length
            });

            // First fetch the actual .eml file from the server
            const emlResponse = await fetch(`http://localhost:5000/emails/${emailData.id}/raw`);
            if (!emlResponse.ok) {
                throw new Error('Failed to fetch email file');
            }
            const emlBlob = await emlResponse.blob();

            // Create a FormData object to send the email file
            const formData = new FormData();
            formData.append('emlFile', emlBlob, emailData.id);

            const response = await fetch('http://localhost:5000/analyze', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Failed to scan email');
            }

            const result = await response.json();
            console.log('Scan result for email:', {
                subject: emailData.subject,
                result: result
            });

            return {
                ...emailData,
                scanResult: result.result || 0,
                legitimacy: result.legitimacy || 'Unknown'
            };
        } catch (err) {
            console.error('Error scanning email:', err);
            return {
                ...emailData,
                scanResult: 0,
                legitimacy: 'Unknown'
            };
        }
    };

    const scanEmails = useCallback(async (emailsToScan) => {
        setScanningEmails(true);
        try {
            const scannedEmails = await Promise.all(
                emailsToScan.map(email => scanEmail(email))
            );
            setEmails(scannedEmails);
            // Cache the scanned emails
            localStorage.setItem('cachedEmails', JSON.stringify(scannedEmails));
        } catch (err) {
            console.error('Error scanning emails:', err);
            setError('Failed to scan some emails');
        } finally {
            setScanningEmails(false);
        }
    }, []);

    useEffect(() => {
        const fetchEmails = async () => {
            try {
                // First try to get cached emails with scan results
                const cachedEmails = localStorage.getItem('cachedEmails');
                if (cachedEmails) {
                    console.log('Using cached emails with scan results');
                    setEmails(JSON.parse(cachedEmails));
                    setLoading(false);
                    return;
                }

                const response = await fetch('http://localhost:5000/emails');
                if (!response.ok) {
                    throw new Error('Failed to fetch emails');
                }
                const data = await response.json();
                console.log('Received emails from server:', data.map(email => ({
                    id: email.id,
                    subject: email.subject,
                    hasContent: !!email.content,
                    contentLength: email.content?.length
                })));
                await scanEmails(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchEmails();
    }, [scanEmails]);

    const handleToggleStar = (email) => {
        setEmails(emails.map(e =>
            e.id === email.id ? { ...e, starred: !e.starred } : e
        ));
    };

    const handleToggleImportant = (email) => {
        setEmails(emails.map(e =>
            e.id === email.id ? { ...e, important: !e.important } : e
        ));
    };

    const filteredEmails = emails.filter(email => {
        if (selectedTab === 'starred') return email.starred;
        if (selectedTab === 'important') return email.important;
        return email.category === selectedTab;
    });

    return (
        <div className="email-demo-page">
            <div className="sidebar-container">
                <Sidebar />
            </div>

            <div className="main-container">
                <div className="header-container">
                    <Header />
                </div>
                <div className="toolbar-container">
                    <Toolbar />
                </div>
                <div className="tabs-container">
                    <Tabs selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
                </div>
                <div className="email-list-container">
                    {id ? (
                        <EmailViewPage />
                    ) : loading || scanningEmails ? (
                        <div className="loading-message">
                            {scanningEmails ? 'Scanning emails for phishing...' : 'Loading emails...'}
                        </div>
                    ) : error ? (
                        <div className="error-message">Error: {error}</div>
                    ) : (
                        <EmailList
                            emails={filteredEmails}
                            onToggleStar={handleToggleStar}
                            onToggleImportant={handleToggleImportant}
                        />
                    )}
                </div>
            </div>

            <div className="right-sidebar-container">
                <RightSidebar />
            </div>
        </div>
    );
};

export default EmailDemoPage; 