import React, { useState } from 'react';
import './ChatBot.css';

const ChatBot = ({ email, initialScanResult, onNewAnalysis }) => {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isActive, setIsActive] = useState(false);

    const startChat = async () => {
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
                    content: data.response || "Hi! I'm your AI assistant. How can I help you today?",
                    type: 'welcome'
                }
            ]);

        } catch (error) {
            console.error('Error in startChat:', error);
            setMessages([{
                role: 'assistant',
                content: `Sorry, I'm having trouble starting the chat. Please try again.`,
                type: 'error'
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleSendMessage = async () => {
        if (!userInput.trim()) return;

        const userMessage = {
            role: 'user',
            content: userInput,
            type: 'message'
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
                content: data.response,
                type: 'message'
            }]);

        } catch (error) {
            console.error('Error in handleSendMessage:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Sorry, I'm having trouble processing your response. Please try again.`,
                type: 'error'
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    if (!isActive) {
        return (
            <div className="chatbot-container">
                <button className="start-chat-button" onClick={startChat}>
                    Start Chat with AI Assistant
                </button>
            </div>
        );
    }

    return (
        <div className="chatbot-container">
            <div className="chatbot-messages">
                {messages.map((message, index) => (
                    <div key={index} className={`message ${message.role} ${message.type}`}>
                        {message.content}
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