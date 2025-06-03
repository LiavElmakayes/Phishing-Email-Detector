import React, { useState, useEffect, useCallback } from 'react';
import './ChatBot.css';

const ChatBot = ({ email, initialScanResult, onNewAnalysis, isStarted }) => {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isActive, setIsActive] = useState(false);

    const formatMessage = (content) => {
        if (!content) return '';

        // Convert markdown-style formatting to HTML
        let formattedContent = content
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
            // Bullet points (convert both - and • to styled bullets)
            .replace(/^[-•] (.*$)/gm, '<li>$1</li>')
            .replace(/(<li>.*?<\/li>\n?)+/g, '<ul>$&</ul>')
            // Remove extra newlines between headers and their content
            .replace(/(<\/h[1-4]>)\n+/g, '$1')
            // Clean up multiple newlines and ensure proper spacing
            .replace(/\n{3,}/g, '\n\n')
            // Handle spacing after lists
            .replace(/(<\/ul>)\s*\n+(?=<h[1-4]>)/g, '$1')    // No newline after lists before headers
            .replace(/(<\/ul>)\s*\n+(?=<p>)/g, '$1\n')      // Single newline after lists before paragraphs
            .replace(/(<\/p>)\s*\n+(?=<h[1-4]>)/g, '$1')     // No newline after paragraphs before headers
            .replace(/(<\/h[1-4]>)\s*\n+(?=<ul>)/g, '$1')    // No newline between headers and lists
            .replace(/(<\/h[1-4]>)\s*\n+(?=<p>)/g, '$1')     // No newline between headers and paragraphs
            // Remove any trailing whitespace
            .replace(/\s+$/gm, '')
            // Keep single newline between list items but remove it after the last one
            .replace(/(<\/li>)\n+(?=<li>)/g, '$1\n')         // Keep newline between lists items
            .replace(/(<\/li>)\n+(?=<\/ul>)/g, '$1')         // Remove newline before closing ul tag
            .replace(/(<\/h[1-4]>)\s*\n+(?=<h[1-4]>)/g, '$1\n'); // Single newline between headers

        return formattedContent;
    };

    const formatTime = () => {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const startChat = useCallback(async () => {
        if (isActive) return;
        setIsActive(true);
        setIsTyping(true);

        try {
            const response = await fetch('http://localhost:5000/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: "Start chat",
                    conversation: [],
                    email: email
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to start chat');
            }

            setMessages([
                {
                    role: 'assistant',
                    content: formatMessage(data.response || "Hi! I'm your AI assistant. How can I help you today?"),
                    type: 'welcome',
                    timestamp: formatTime()
                }
            ]);

        } catch (error) {
            console.error('Error in startChat:', error);
            setMessages([{
                role: 'assistant',
                content: formatMessage(`Sorry, I'm having trouble starting the chat. Please try again.`),
                type: 'error',
                timestamp: formatTime()
            }]);
        } finally {
            setIsTyping(false);
        }
    }, [isActive, email]);

    useEffect(() => {
        if (isStarted && !isActive) {
            startChat();
        }
    }, [isStarted, isActive, startChat]);

    const handleSendMessage = async () => {
        if (!userInput.trim()) return;

        const userMessage = {
            role: 'user',
            content: userInput,
            type: 'message',
            timestamp: formatTime()
        };

        setMessages(prev => [...prev, userMessage]);
        setUserInput('');
        setIsTyping(true);

        try {
            const response = await fetch('http://localhost:5000/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userInput,
                    conversation: messages,
                    email: email
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to process response');
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: formatMessage(data.response),
                type: 'message',
                timestamp: formatTime()
            }]);

        } catch (error) {
            console.error('Error in handleSendMessage:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: formatMessage(`Sorry, I'm having trouble processing your response. Please try again.`),
                type: 'error',
                timestamp: formatTime()
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    if (!isActive) {
        return (
            <div className="chatbot-initial-state">
                <div className="chatbot-welcome-card">
                    <div className="chatbot-welcome-icon">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="#0084ff" />
                            <path d="M12 6C8.69 6 6 8.69 6 12C6 15.31 8.69 18 12 18C15.31 18 18 15.31 18 12C18 8.69 15.31 6 12 6ZM12 16C9.79 16 8 14.21 8 12C8 9.79 9.79 8 12 8C14.21 8 16 9.79 16 12C16 14.21 14.21 16 12 16Z" fill="#0084ff" />
                        </svg>
                    </div>
                    <h2>AI Assistant</h2>
                    <p>I can help you analyze emails and answer questions about phishing detection.</p>
                    <button className="start-chat-button" onClick={startChat}>
                        Start Conversation
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="chatbot-container">
            <div className="chatbot-messages">
                {messages.map((message, index) => (
                    <div
                        key={index}
                        className={`message ${message.role} ${message.type}`}
                    >
                        <div dangerouslySetInnerHTML={{ __html: message.content }} />
                        <div className="message-timestamp">{message.timestamp}</div>
                    </div>
                ))}
                {isTyping && (
                    <div className="message assistant typing">
                        <span className="typing-indicator">...</span>
                    </div>
                )}
            </div>
            <div className="chatbot-input">
                <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type your message here..."
                    disabled={isTyping}
                />
                <button onClick={handleSendMessage} disabled={isTyping || !userInput.trim()}>
                    Send
                </button>
            </div>
        </div>
    );
};

export default ChatBot; 