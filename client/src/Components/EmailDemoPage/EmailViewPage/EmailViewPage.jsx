import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import './EmailViewPage.css';

const EmailViewPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [email, setEmail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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

    return (
        <div className="email-view-content">
            <button className="back-button" onClick={() => navigate('/demo')}>
                <ArrowLeft size={20} />
                Back to Inbox
            </button>
            <div className="email-details">
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
            </div>
        </div>
    );
};

export default EmailViewPage; 