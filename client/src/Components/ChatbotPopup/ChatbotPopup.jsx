// ChatbotPopup.jsx
import React from 'react';
import './ChatbotPopup.css';

const ChatbotPopup = ({ onClose }) => {
    return (
        <div className="chatbot-popup">
            <div className="chatbot-header">Chatbot Assistance</div>
            <p className="chatbot-text">Let's clarify the email's legitimacy. I'll ask a few questions.</p>
            <button className="chatbot-button" onClick={onClose}>Start Chat</button>
        </div>
    );
};

export default ChatbotPopup;