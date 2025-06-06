import React, { useState, useEffect, useMemo } from 'react';
import { ref, onValue, query, orderByChild, remove } from "firebase/database";
import { useSelector } from 'react-redux';
import { database } from '../../firebase';
import { FaComments, FaCalendarAlt, FaEnvelope, FaSearch, FaShieldAlt, FaExclamationTriangle, FaRobot, FaCheckCircle, FaTimesCircle, FaChartLine, FaTrash } from 'react-icons/fa';
import { CheckCircle } from 'lucide-react';
import './ChatHistory.css';

const ChatHistory = () => {
    const [chatHistory, setChatHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedChat, setSelectedChat] = useState(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState(null);
    const user = useSelector((state) => state.AuthReducer.user);

    // Function to extract AI's final analysis score from messages
    const getAIFinalScore = (messages) => {
        if (!messages || !Array.isArray(messages)) return null;

        // Look for the final analysis message
        const finalAnalysisMessage = messages.find(msg =>
            msg.role === 'assistant' &&
            msg.content.includes('Risk Assessment')
        );

        if (finalAnalysisMessage) {
            // Extract any number followed by % in the Risk Assessment section
            const scoreMatch = finalAnalysisMessage.content.match(/(\d+)%/);
            if (scoreMatch && scoreMatch[1]) {
                return parseInt(scoreMatch[1], 10);
            }
        }
        return null;
    };

    // Function to determine legitimacy based on score
    const getLegitimacy = (score) => {
        return score >= 50 ? 'Phishing' : 'Legitimate';
    };

    // Function to get initial legitimacy
    const getInitialLegitimacy = (scanResult) => {
        if (!scanResult?.result) return 'Unknown';
        return scanResult.result * 10 >= 50 ? 'Phishing' : 'Legitimate';
    };

    useEffect(() => {
        if (!user) return;

        const historyRef = ref(database, `users/${user.uid}/chatHistory`);
        const historyQuery = query(historyRef, orderByChild('timestamp'));

        const unsubscribe = onValue(historyQuery, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // Filter out conversations without AI analysis before setting state
                const historyArray = Object.entries(data)
                    .map(([id, chat]) => ({
                        id,
                        ...chat
                    }))
                    .filter(chat => getAIFinalScore(chat.messages) !== null) // Only keep analyzed conversations
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                setChatHistory(historyArray);
                setError(null);
            } else {
                setChatHistory([]);
                setError(null);
            }
            setLoading(false);
        }, (error) => {
            setError(`Error loading chat history: ${error.message}`);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    // Calculate summary statistics
    const totalConversations = chatHistory.length;

    // Initial analysis statistics
    const initialSafeEmails = chatHistory.filter(chat => {
        const initialLegitimacy = getInitialLegitimacy(chat.scanResult);
        return initialLegitimacy === 'Legitimate';
    }).length;

    const initialPhishingDetected = chatHistory.filter(chat => {
        const initialLegitimacy = getInitialLegitimacy(chat.scanResult);
        return initialLegitimacy === 'Phishing';
    }).length;

    // Calculate initial average risk score
    const initialTotalRisk = chatHistory.reduce((sum, chat) => sum + (chat.scanResult?.result || 0), 0);
    const initialAverageRisk = totalConversations > 0 ? Math.round((initialTotalRisk / totalConversations) * 10) : 0;

    // Final analysis statistics
    const finalSafeEmails = chatHistory.filter(chat => {
        const aiFinalScore = getAIFinalScore(chat.messages);
        return getLegitimacy(aiFinalScore) === 'Legitimate';
    }).length;

    const finalPhishingDetected = chatHistory.filter(chat => {
        const aiFinalScore = getAIFinalScore(chat.messages);
        return getLegitimacy(aiFinalScore) === 'Phishing';
    }).length;

    // Calculate final average risk score
    const finalTotalRisk = chatHistory.reduce((sum, chat) => {
        const aiFinalScore = getAIFinalScore(chat.messages);
        return sum + (aiFinalScore || 0);
    }, 0);
    const finalAverageRisk = totalConversations > 0 ? Math.round(finalTotalRisk / totalConversations) : 0;

    // Filter the chat history based on search term
    const filteredChats = useMemo(() => {
        return chatHistory.filter(chat =>
            chat.emailSubject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            chat.emailSender?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [chatHistory, searchTerm]);

    const handleDelete = async (chatId) => {
        try {
            const historyRef = ref(database, `users/${user.uid}/chatHistory/${chatId}`);
            await remove(historyRef);
            setDeleteConfirmation(null);
        } catch (error) {
            console.error('Error deleting chat:', error);
            setError('Failed to delete chat history');
        }
    };

    if (loading) {
        return (
            <div className="chat-loading-container">
                <div className="chat-loading-spinner"></div>
                <p>Loading chat history...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="chat-error-container">
                <div className="chat-error-message">
                    <h3>Error</h3>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-history-container">
            <div className="chat-history-header">
                <h2>Chat History</h2>
                <p className="chat-history-subtitle">View your analyzed conversations with the AI assistant and compare initial vs final analysis results</p>
            </div>

            {/* Summary Statistics */}
            <div className="chat-summary-container">
                <div className="chat-summary-header">
                    {/* Combined Title and Count */}
                    <div className="chat-summary-combined-title">
                        Analysis Overview - Total Analyzed Conversations: <span className="highlight">{totalConversations}</span>
                    </div>
                </div>

                <div className="chat-summary-content">
                    <div className="chat-summary-section initial-analysis">
                        <div className="section-header">
                            <FaShieldAlt className="section-icon" />
                            <h4>Initial Analysis</h4>
                            <span className="section-subtitle">SpamAssassin Results</span>
                        </div>
                        <div className="section-stats">
                            <div className="chat-stat-item">
                                <div className="chat-stat-icon safe">
                                    <FaCheckCircle />
                                </div>
                                <div className="chat-stat-info">
                                    <div className="chat-stat-value">{initialSafeEmails}</div>
                                    <div className="chat-stat-label">Safe Emails</div>
                                </div>
                            </div>
                            <div className="chat-stat-item">
                                <div className="chat-stat-icon phishing">
                                    <FaTimesCircle />
                                </div>
                                <div className="chat-stat-info">
                                    <div className="chat-stat-value">{initialPhishingDetected}</div>
                                    <div className="chat-stat-label">Phishing Detected</div>
                                </div>
                            </div>
                            <div className="chat-stat-item">
                                <div className="chat-stat-icon risk">
                                    <FaChartLine />
                                </div>
                                <div className="chat-stat-info">
                                    <div className="chat-stat-value">{initialAverageRisk}/100</div>
                                    <div className="chat-stat-label">Average Risk</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="chat-summary-section ai-analysis">
                        <div className="section-header">
                            <FaRobot className="section-icon" />
                            <h4>AI Analysis</h4>
                            <span className="section-subtitle">{totalConversations} Emails Analyzed</span>
                        </div>
                        <div className="section-stats">
                            <div className="chat-stat-item">
                                <div className="chat-stat-icon safe">
                                    <FaCheckCircle />
                                </div>
                                <div className="chat-stat-info">
                                    <div className="chat-stat-value">{finalSafeEmails}</div>
                                    <div className="chat-stat-label">Safe Emails</div>
                                </div>
                            </div>
                            <div className="chat-stat-item">
                                <div className="chat-stat-icon phishing">
                                    <FaTimesCircle />
                                </div>
                                <div className="chat-stat-info">
                                    <div className="chat-stat-value">{finalPhishingDetected}</div>
                                    <div className="chat-stat-label">Phishing Detected</div>
                                </div>
                            </div>
                            <div className="chat-stat-item">
                                <div className="chat-stat-icon risk">
                                    <FaChartLine />
                                </div>
                                <div className="chat-stat-info">
                                    <div className="chat-stat-value">{finalAverageRisk}/100</div>
                                    <div className="chat-stat-label">Average Risk</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="chat-search-bar">
                <div className="chat-search-input-container">
                    <FaSearch className="chat-search-icon" />
                    <input
                        type="text"
                        placeholder="Search by email subject or sender..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="chat-search-input"
                    />
                </div>
            </div>

            <p className="chat-showing-text">
                {chatHistory.length === 0
                    ? "You don't have any chats yet"
                    : chatHistory.length === 1
                        ? `Showing 1 conversation`
                        : filteredChats.length === chatHistory.length
                            ? `Showing all ${chatHistory.length} conversations`
                            : `Showing ${filteredChats.length} of ${chatHistory.length} conversations${searchTerm ? ` for "${searchTerm}"` : ''}`
                }
            </p>

            {filteredChats.length === 0 && chatHistory.length > 0 ? (
                <div className="chat-no-results">
                    <FaSearch size={48} />
                    <p>No conversations found matching your search criteria.</p>
                </div>
            ) : filteredChats.length === 0 && chatHistory.length === 0 ? (
                <div className="chat-no-history">
                    <div className="chat-no-history-content">
                        <div className="chat-no-history-icon-wrapper">
                            <FaComments size={64} />
                        </div>
                        <h3 className="chat-no-history-title">No Chat History Available</h3>
                        <p className="chat-no-history-description">Start a conversation with the AI assistant to see your analysis results here</p>
                        <div className="chat-no-history-decoration">
                            <div className="chat-decoration-circle"></div>
                            <div className="chat-decoration-circle"></div>
                            <div className="chat-decoration-circle"></div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="chat-history-grid">
                    {filteredChats.map((chat) => {
                        const aiFinalScore = getAIFinalScore(chat.messages);
                        const finalLegitimacy = aiFinalScore !== null
                            ? getLegitimacy(aiFinalScore)
                            : chat.scanResult?.legitimacy || 'Unknown';
                        const initialLegitimacy = getInitialLegitimacy(chat.scanResult);

                        return (
                            <div key={chat.id} className="chat-history-card">
                                <div className="chat-card-summary">
                                    <div className="chat-email-icon-wrapper">
                                        <FaEnvelope className="chat-email-icon" />
                                    </div>
                                    <div className="chat-summary-details">
                                        <span className="chat-email-subject">{chat.emailSubject || 'No Subject'}</span>
                                        <div className="chat-summary-meta">
                                            <p className="chat-sender">From: {chat.emailSender || 'Unknown Sender'}</p>
                                            <div className="chat-meta-item">
                                                <FaCalendarAlt />
                                                <span>{chat.timestamp ? new Date(chat.timestamp).toLocaleDateString() : 'N/A'}</span>
                                            </div>
                                            <div className="chat-meta-item">
                                                <FaComments />
                                                <span>{chat.messages?.length || 0} messages</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="chat-result-info">
                                        <div className="chat-legitimacy-transition">
                                            <span className={`chat-legitimacy-badge ${initialLegitimacy.toLowerCase().replace(' ', '-')}`}>
                                                {initialLegitimacy === 'Legitimate' ? <CheckCircle size={14} style={{ marginRight: '4px' }} /> : <FaExclamationTriangle size={14} style={{ marginRight: '4px' }} />}
                                                {initialLegitimacy}
                                            </span>
                                            <span className="chat-legitimacy-arrow">→</span>
                                            <span className={`chat-legitimacy-badge ${finalLegitimacy.toLowerCase().replace(' ', '-')}`}>
                                                {finalLegitimacy === 'Legitimate' ? <CheckCircle size={14} style={{ marginRight: '4px' }} /> : <FaExclamationTriangle size={14} style={{ marginRight: '4px' }} />}
                                                {finalLegitimacy}
                                            </span>
                                        </div>
                                        <div className="chat-risk-score-transition">
                                            <div className={`chat-risk-score initial ${initialLegitimacy.toLowerCase()}`}>
                                                <FaShieldAlt size={14} style={{ marginRight: '4px' }} />
                                                Initial: {Math.round(chat.scanResult.result * 10)}/100
                                            </div>
                                            <span className="chat-risk-arrow">→</span>
                                            <div className={`chat-risk-score final ${finalLegitimacy.toLowerCase()}`}>
                                                <FaShieldAlt size={14} style={{ marginRight: '4px' }} />
                                                Final: {aiFinalScore}/100
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="chat-card-actions">
                                    <button
                                        className="chat-view-btn"
                                        onClick={() => setSelectedChat(chat)}
                                    >
                                        <FaComments /> View Conversation
                                    </button>
                                    <button
                                        className="chat-delete-btn"
                                        onClick={() => setDeleteConfirmation(chat)}
                                    >
                                        <FaTrash /> Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedChat && (
                <div className="chat-history-modal">
                    <div className="chat-modal-content">
                        <button className="chat-modal-close" onClick={() => setSelectedChat(null)}>×</button>
                        <h2>Conversation Details</h2>
                        <div className="chat-modal-content-wrapper">
                            <div className="chat-modal-header">
                                <p><strong>Email Subject:</strong> {selectedChat.emailSubject || 'No Subject'}</p>
                                <p><strong>From:</strong> {selectedChat.emailSender || 'Unknown Sender'}</p>
                                <p><strong>Date:</strong> {new Date(selectedChat.timestamp).toLocaleString()}</p>
                            </div>
                            <div className="chat-messages-container">
                                {selectedChat.messages?.map((message, index) => (
                                    <div key={index} className={`chat-message ${message.role}`}>
                                        <div className="chat-message-content" dangerouslySetInnerHTML={{ __html: message.content }} />
                                        <div className="chat-message-timestamp">{message.timestamp}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmation && (
                <div className="chat-delete-modal">
                    <div className="chat-delete-modal-content">
                        <h3>Delete Chat History</h3>
                        <p>Are you sure you want to delete this chat history? This action cannot be undone.</p>
                        <div className="chat-delete-modal-actions">
                            <button
                                className="chat-cancel-delete-btn"
                                onClick={() => setDeleteConfirmation(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="chat-confirm-delete-btn"
                                onClick={() => handleDelete(deleteConfirmation.id)}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatHistory; 