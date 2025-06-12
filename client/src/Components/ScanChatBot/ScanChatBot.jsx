import React, { useState, useEffect, useRef } from 'react';
import './ScanChatBot.css';
import { FaRobot, FaTimes } from 'react-icons/fa';
import { ref, set, get } from "firebase/database";
import { useSelector } from 'react-redux';
import { database } from '../../firebase';

const ScanChatBot = ({ scanData, isOpen, onClose, scanId = null }) => {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const user = useSelector((state) => state.AuthReducer.user);

    // Auto-expand when opened
    useEffect(() => {
        if (isOpen) {
            setIsExpanded(true);
        }
    }, [isOpen]);

    // Load saved conversation when component mounts or scanId changes
    useEffect(() => {
        const loadSavedConversation = async () => {
            if (!user || !scanId) return;

            try {
                const chatRef = ref(database, `users/${user.uid}/emailHistory/${scanId}/chat`);
                const snapshot = await get(chatRef);
                if (snapshot.exists()) {
                    setMessages(snapshot.val());
                }
            } catch (error) {
                console.error('Error loading saved conversation:', error);
            }
        };

        if (isOpen && isExpanded) {
            loadSavedConversation();
        }
    }, [user, scanId, isOpen, isExpanded]);

    // Save conversation whenever messages change
    useEffect(() => {
        const saveConversation = async () => {
            if (!user || !scanId || messages.length === 0) return;

            try {
                const chatRef = ref(database, `users/${user.uid}/emailHistory/${scanId}/chat`);
                await set(chatRef, messages);
            } catch (error) {
                console.error('Error saving conversation:', error);
            }
        };

        saveConversation();
    }, [messages, user, scanId]);

    // Reset chat state when component is closed
    useEffect(() => {
        if (!isOpen) {
            setIsExpanded(false);
            setUserInput('');
            setIsTyping(false);
            // Don't reset messages here to preserve conversation
        }
    }, [isOpen]);

    // Format message content (reusing similar formatting from main ChatBot)
    const formatMessage = (content) => {
        if (!content) return '';

        return content
            // Headings
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
            // Bold and underline
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.*?)__/g, '<u>$1</u>')
            // Colored text
            .replace(/\[color=(.*?)\](.*?)\[\/color\]/g, '<span style="color: $1">$2</span>')
            // Bullet points
            .replace(/^[-•] (.*$)/gm, '<li>$1</li>')
            .replace(/(<li>.*?<\/li>\n?)+/g, '<ul>$&</ul>')
            // Clean up spacing
            .replace(/\n{3,}/g, '\n\n')
            .replace(/(<\/h[1-4]>)\s*\n+(?=<h[1-4]>)/g, '$1\n')
            .replace(/(<\/ul>)\s*\n+(?=<h[1-4]>)/g, '$1')
            .replace(/(<\/p>)\s*\n+(?=<h[1-4]>)/g, '$1')
            .replace(/(<\/h[1-4]>)\s*\n+(?=<ul>)/g, '$1')
            .replace(/(<\/h[1-4]>)\s*\n+(?=<p>)/g, '$1')
            .replace(/\s+$/gm, '')
            .replace(/(<\/li>)\n+(?=<li>)/g, '$1\n')
            .replace(/(<\/li>)\n+(?=<\/ul>)/g, '$1');
    };

    const formatTime = () => {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Scroll to bottom of messages
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Toggle chat window
    const toggleChat = () => {
        if (!isOpen) return; // Don't allow toggling if component is not open
        setIsExpanded(!isExpanded);
        if (!isExpanded) {
            // Reset messages when opening chat
            setMessages([]);
        }
    };

    // Modify the welcome message useEffect to only trigger on first open
    useEffect(() => {
        if (isOpen && isExpanded && messages.length === 0) {
            const welcomeMessage = {
                role: 'assistant',
                content: formatMessage(`# Welcome to the Scan Analysis Assistant

I can help you understand the results of your email scan. Feel free to ask me any questions about:

- The SpamAssassin score and what it means
- Specific scan results and their implications
- Technical terms used in the scan
- General email security concepts

What would you like to know about your scan results?`),
                timestamp: formatTime()
            };
            setMessages([welcomeMessage]);
        }
    }, [isExpanded, isOpen]);

    const handleSendMessage = async () => {
        if (!userInput.trim() || isTyping) return;

        const userMessage = {
            role: 'user',
            content: userInput,
            timestamp: formatTime()
        };

        // Update messages immediately with user message
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setUserInput('');
        setIsTyping(true);

        try {
            const response = await fetch('http://localhost:5000/api/scan-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userInput,
                    conversation: messages,
                    scanData: scanData
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to process response');
            }

            const assistantMessage = {
                role: 'assistant',
                content: formatMessage(data.response),
                timestamp: formatTime()
            };

            setMessages([...newMessages, assistantMessage]);

        } catch (error) {
            console.error('Error in handleSendMessage:', error);
            const errorMessage = {
                role: 'assistant',
                content: formatMessage(`Sorry, I'm having trouble processing your question. Please try again. ${error.message}`),
                timestamp: formatTime()
            };
            setMessages([...newMessages, errorMessage]);
        } finally {
            setIsTyping(false);
        }
    };

    if (!isOpen) return null; // Don't render anything if not open

    return (
        <div className="scan-chatbot-wrapper">
            {/* Only show floating button when chat is minimized */}
            {!isExpanded && (
                <button
                    className="scan-chatbot-button"
                    onClick={toggleChat}
                >
                    <FaRobot className="chat-icon" />
                    <span className="button-text">AI Assistant</span>
                </button>
            )}

            {/* Chat window */}
            {isExpanded && (
                <div className="scan-chatbot-container">
                    <div className="scan-chatbot-header">
                        <h2>Scan Analysis Assistant</h2>
                        <button className="minimize-button" onClick={toggleChat}>−</button>
                    </div>

                    <div className="scan-chatbot-messages" ref={chatContainerRef}>
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={`scan-message ${message.role}`}
                            >
                                <div
                                    className="scan-message-content"
                                    dangerouslySetInnerHTML={{ __html: message.content }}
                                />
                                <div className="scan-message-timestamp">{message.timestamp}</div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="scan-message assistant typing">
                                <span className="typing-indicator">...</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="scan-chatbot-input">
                        <input
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Ask about your scan results..."
                            disabled={isTyping}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={isTyping || !userInput.trim()}
                        >
                            Send
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScanChatBot; 