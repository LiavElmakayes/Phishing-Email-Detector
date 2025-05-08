import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
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
    const navigate = useNavigate();
    const [selectedTab, setSelectedTab] = useState('primary');
    const [emails, setEmails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchEmails = async () => {
            try {
                const response = await fetch('http://localhost:5000/emails');
                if (!response.ok) {
                    throw new Error('Failed to fetch emails');
                }
                const data = await response.json();
                setEmails(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchEmails();
    }, []);

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
                    ) : loading ? (
                        <div className="loading-message">Loading emails...</div>
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