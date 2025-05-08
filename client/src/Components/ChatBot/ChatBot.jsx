import React, { useState } from 'react';
import './ChatBot.css';

const ChatBot = ({ email, initialScanResult, onNewAnalysis }) => {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isActive, setIsActive] = useState(false);

    const startChat = async () => {
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

            // Ensure initialScanResult is properly formatted
            const scanResult = {
                result: initialScanResult?.result || 0,
                legitimacy: initialScanResult?.legitimacy || 'Unknown'
            };

            console.log('Formatted email data:', emailData);
            console.log('Formatted scan result:', scanResult);

            const requestBody = {
                email: emailData,
                initialScanResult: scanResult,
                conversation: []
            };

            console.log('Sending request to server:', JSON.stringify(requestBody, null, 2));

            const response = await fetch('http://localhost:5000/api/ai-analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            console.log('Server response status:', response.status);

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

            // Add AI's initial analysis and first question to chat
            setMessages([{
                role: 'assistant',
                content: data.analysis || 'No analysis provided'
            }]);

            // Update the phishing score if available
            if (data.score !== undefined) {
                console.log('Updating phishing score:', data.score);
                onNewAnalysis(data.score);
            }

        } catch (error) {
            console.error('Error in startChat:', error);
            console.error('Error stack:', error.stack);
            setMessages([{
                role: 'assistant',
                content: `Error: ${error.message}. Please try again.`
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleSendMessage = async () => {
        if (!userInput.trim()) return;

        // Add user message to chat
        const userMessage = {
            role: 'user',
            content: userInput
        };
        setMessages(prev => [...prev, userMessage]);
        setUserInput('');
        setIsTyping(true);

        try {
            // Ensure email data is properly formatted
            const emailData = {
                subject: email?.subject || '',
                sender: email?.sender || '',
                content: email?.content || ''
            };

            console.log('Sending message with conversation:', [...messages, userMessage]);
            const response = await fetch('http://localhost:5000/api/ai-analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: emailData,
                    initialScanResult: initialScanResult || {},
                    conversation: [...messages, userMessage]
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

            // Add AI response to chat
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.analysis
            }]);

            // Update the phishing score if available
            if (data.score !== undefined) {
                onNewAnalysis(data.score);
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