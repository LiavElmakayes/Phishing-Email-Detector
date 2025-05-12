import React, { useState } from 'react';
import './ChatBot.css';

const ChatBot = ({ email, initialScanResult, onNewAnalysis }) => {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [chatId, setChatId] = useState(null);

    const startChat = async () => {
        if (isActive) return; // Prevent multiple starts
        setIsActive(true);
        setIsTyping(true);

        try {
            console.log('Starting chat with props:', { email, initialScanResult });

            // Ensure email data is properly formatted
            const emailData = {
                subject: email?.subject || '',
                sender: email?.sender || '',
                content: email?.content || ''
            };

            const requestBody = {
                email: emailData,
                initialScanResult: initialScanResult || {},
                conversation: []
            };

            console.log('Sending request to server:', JSON.stringify(requestBody, null, 2));

            const response = await fetch('http://localhost:5001/api/ai-analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Server error response:', errorData);
                throw new Error(errorData.error || 'Network response was not ok');
            }

            const data = await response.json();
            console.log('Server response data:', data);

            if (data.error) {
                console.error('Error in response data:', data.error);
                throw new Error(data.error);
            }

            // Store the chat_id
            setChatId(data.chat_id);

            // Add only the question to the chat
            if (data.questions) {
                setMessages([{
                    role: 'assistant',
                    content: data.questions,
                    chat_id: data.chat_id
                }]);
            }

        } catch (error) {
            console.error('Error in startChat:', error);
            setMessages([{
                role: 'assistant',
                content: `Error: ${error.message}. Please try again.`
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleSendMessage = async () => {
        if (!userInput.trim() || !chatId) return; // Prevent sending without chatId

        // Add user message to chat
        const userMessage = {
            role: 'user',
            content: userInput
        };
        setMessages(prev => [...prev, userMessage]);
        setUserInput('');
        setIsTyping(true);

        try {
            const response = await fetch('http://localhost:5001/api/ai-analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: {
                        subject: email?.subject || '',
                        sender: email?.sender || '',
                        content: email?.content || ''
                    },
                    initialScanResult: initialScanResult || {},
                    conversation: messages,
                    chat_id: chatId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Server error:', errorData);
                throw new Error(errorData.error || 'Network response was not ok');
            }

            const data = await response.json();
            console.log('Received response:', data);

            if (data.error) {
                throw new Error(data.error);
            }

            // Add only the question to the chat
            if (data.questions) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.questions,
                    chat_id: data.chat_id
                }]);
            }

        } catch (error) {
            console.error('Error sending message:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Error: ${error.message}. Please try again.`
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    if (!isActive) {
        return (
            <button className="start-chat-button" onClick={startChat}>
                Start Chat with AI Assistant
            </button>
        );
    }

    return (
        <div className="chat-container">
            <div className="chat-messages">
                {messages.map((message, index) => (
                    <div key={index} className={`message ${message.role}`}>
                        {message.content}
                    </div>
                ))}
                {isTyping && (
                    <div className="message assistant typing">
                        AI is typing...
                    </div>
                )}
            </div>
            <div className="chat-input">
                <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Type your message..."
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button onClick={handleSendMessage}>Send</button>
            </div>
        </div>
    );
};

export default ChatBot; 