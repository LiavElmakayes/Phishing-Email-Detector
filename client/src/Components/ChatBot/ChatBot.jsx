import React, { useState } from 'react';
import './ChatBot.css';

const ChatBot = ({ email, initialScanResult, onNewAnalysis }) => {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [chatId, setChatId] = useState(null);
    const [currentCategory, setCurrentCategory] = useState('subject');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    const startChat = async () => {
        if (isActive) return;
        setIsActive(true);
        setIsTyping(true);

        try {
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

            console.log('Sending request:', requestBody);

            const response = await fetch('http://localhost:5001/api/ai-analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error('Failed to start chat');
            }

            const data = await response.json();
            console.log('Received data:', data);

            // Handle both response formats
            if (data.questions) {
                // Handle structured questions format
                if (typeof data.questions === 'object') {
                    setChatId(data.chat_id);
                    setCurrentCategory(data.current_category || 'subject');

                    // Add welcome message
                    setMessages([
                        {
                            role: 'assistant',
                            content: "Hi! I'll help you analyze this email. Let me ask you a few simple questions to better understand if it's safe.",
                            type: 'welcome'
                        }
                    ]);

                    // Add the first question after a short delay
                    setTimeout(() => {
                        let firstQuestion = null;
                        if (data.questions.subject_analysis?.user_questions?.length > 0) {
                            firstQuestion = data.questions.subject_analysis.user_questions[0];
                        } else if (data.questions.sender_analysis?.user_questions?.length > 0) {
                            firstQuestion = data.questions.sender_analysis.user_questions[0];
                            setCurrentCategory('sender');
                        } else if (data.questions.content_analysis?.user_questions?.length > 0) {
                            firstQuestion = data.questions.content_analysis.user_questions[0];
                            setCurrentCategory('content');
                        }

                        if (firstQuestion) {
                            setMessages(prev => [...prev, {
                                role: 'assistant',
                                content: firstQuestion,
                                type: 'question'
                            }]);
                        } else {
                            setMessages(prev => [...prev, {
                                role: 'assistant',
                                content: "I'm having trouble analyzing this email. Please try again.",
                                type: 'error'
                            }]);
                        }
                    }, 1000);
                }
                // Handle string format (fallback)
                else if (typeof data.questions === 'string') {
                    setChatId(data.chat_id);
                    setCurrentCategory(data.current_category || 'subject');

                    // Add welcome message
                    setMessages([
                        {
                            role: 'assistant',
                            content: "Hi! I'll help you analyze this email. Let me ask you a few simple questions to better understand if it's safe.",
                            type: 'welcome'
                        }
                    ]);

                    // Add the question after a short delay
                    setTimeout(() => {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: data.questions,
                            type: 'question'
                        }]);
                    }, 1000);
                }
            } else {
                throw new Error('Invalid response format');
            }

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
        if (!userInput.trim() || !chatId) return;

        const userMessage = {
            role: 'user',
            content: userInput,
            type: 'answer'
        };

        // Update messages state with user message
        setMessages(prev => [...prev, userMessage]);
        setUserInput('');
        setIsTyping(true);

        try {
            // Construct the updated conversation including the new user message
            const updatedConversation = [...messages, userMessage];

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
                    conversation: updatedConversation,
                    chat_id: chatId,
                    current_category: currentCategory,
                    question_index: currentQuestionIndex
                })
            });

            if (!response.ok) {
                throw new Error('Failed to process response');
            }

            const data = await response.json();
            console.log('Received response data:', data);

            if (data.error) {
                throw new Error(data.error);
            }

            // Update current category and question index
            if (data.current_category) {
                setCurrentCategory(data.current_category);
            }
            if (data.question_index !== undefined) {
                setCurrentQuestionIndex(data.question_index);
            }

            // Handle final analysis
            if (data.is_final) {
                onNewAnalysis(data.score);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `Thank you for your answers! I've updated the risk assessment based on our conversation.`,
                    type: 'final'
                }]);
            } else {
                // Add the next question directly without acknowledgment
                setTimeout(() => {
                    let nextQuestion = null;
                    let nextCategory = currentCategory;

                    // Determine the next category and question
                    if (currentCategory === 'subject' && data.questions?.sender_analysis?.user_questions?.length > 0) {
                        nextCategory = 'sender';
                        nextQuestion = data.questions.sender_analysis.user_questions[0];
                    } else if (currentCategory === 'sender' && data.questions?.content_analysis?.user_questions?.length > 0) {
                        nextCategory = 'content';
                        nextQuestion = data.questions.content_analysis.user_questions[0];
                    }

                    if (nextQuestion) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: nextQuestion,
                            type: 'question'
                        }]);
                        setCurrentCategory(nextCategory);
                        setCurrentQuestionIndex(prev => prev + 1);
                    }
                }, 1000);
            }

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
                    placeholder="Type your answer here..."
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