import React, { useState, useEffect, useCallback } from 'react';
import { ref, push, set } from 'firebase/database';
import { database } from '../../firebase';
import { useSelector } from 'react-redux';
import './ChatBot.css';

const ChatBot = ({ email, initialScanResult, onNewAnalysis, isStarted, aiAnalysisScore }) => {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [chatId, setChatId] = useState(null);
    const user = useSelector((state) => state.AuthReducer.user);

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

    // Unified function to get the latest analysis result
    const getLatestAnalysisResult = useCallback(() => {
        console.log('ChatBot: Calculating latest analysis result...');
        console.log('  aiAnalysisScore (prop):', aiAnalysisScore);
        console.log('  initialScanResult (prop):', initialScanResult);

        // Prioritize AI score if available (AI score is 0-100)
        let score = null;
        if (aiAnalysisScore !== null && typeof aiAnalysisScore === 'number') {
            score = aiAnalysisScore;
        } else if (initialScanResult?.result !== undefined && typeof initialScanResult.result === 'number') {
            // Use initial scan result, scaling it from 0-10 to 0-100 for consistency
            score = initialScanResult.result * 10;
        }
        // If neither is a valid number, score remains null

        // Determine legitimacy based on the calculated score
        const legitimacy = score !== null
            ? (score < 50 ? 'Legitimate' : 'Phishing')
            : initialScanResult?.legitimacy || 'Unknown';

        // Prepare the result value to be saved (scaled back to 0-10)
        // Ensure resultValue is always a number.
        let resultValue = 0;
        if (score !== null && typeof score === 'number') {
            resultValue = parseFloat((score / 10).toFixed(1));
        } else if (initialScanResult?.result !== undefined && typeof initialScanResult.result === 'number') {
            // If AI score wasn't available, use the original initial scan result (0-10)
            resultValue = initialScanResult.result;
        }
        // If neither is a valid number, resultValue remains 0

        console.log('  Calculated score (0-100):', score);
        console.log('  Derived legitimacy:', legitimacy);
        console.log('  Final resultValue (0-10) for saving:', resultValue);

        return {
            result: resultValue, // Ensure this is always a number
            legitimacy: legitimacy,
            details: initialScanResult?.details || null,
            raw: initialScanResult?.raw || null
        };
    }, [aiAnalysisScore, initialScanResult]);

    const saveChatToFirebase = useCallback(async (messagesToSave, currentChatId) => {
        if (!user || !email || !currentChatId) {
            console.error('Save to Firebase failed: Missing user, email, or chatId.', { user: !!user, email: !!email, currentChatId });
            return;
        }
        // console.log('Attempting to save chat', currentChatId, 'with', messagesToSave.length, 'messages.');

        try {
            // Reference to the specific chat entry using the provided currentChatId
            const chatEntryRef = ref(database, `users/${user.uid}/chatHistory/${currentChatId}`);

            // Get the most up-to-date analysis result
            const latestAnalysis = getLatestAnalysisResult();

            // Create a safe chat data object with fallbacks for missing properties
            const chatData = {
                emailId: email.id || 'unknown',
                emailSubject: email.subject || 'No Subject',
                emailSender: email.sender || 'Unknown Sender',
                messages: messagesToSave.map(msg => ({
                    role: msg.role,
                    content: msg.content,
                    type: msg.type,
                    timestamp: msg.timestamp
                })),
                timestamp: new Date().toISOString(), // Always update timestamp on save
                scanResult: latestAnalysis // Save the latest analysis result
            };

            // Optional: Validate that no undefined values exist in the data
            const hasUndefined = Object.entries(chatData).some(([key, value]) => {
                if (value === undefined) {
                    console.error(`Undefined value found in chatData for key: ${key}`);
                    return true;
                }
                // Recursively check nested objects/arrays if necessary
                if (typeof value === 'object' && value !== null) {
                    return Object.values(value).some(nestedValue => nestedValue === undefined);
                }
                return false;
            });

            if (hasUndefined) {
                console.error('Chat data contains undefined values:', chatData);
                throw new Error('Cannot save chat: data contains undefined values');
            }

            // Save/Update the chat entry
            await set(chatEntryRef, chatData);
            // console.log('Chat saved successfully with ID:', currentChatId);

        } catch (error) {
            console.error('Error saving chat:', error);
            // Avoid adding error message to state here to prevent save loop
            // Optionally save a minimal error state if needed for debugging history
        }
    }, [user, email, getLatestAnalysisResult]);

    const startChat = useCallback(async () => {
        if (isActive) return; // Prevent starting if already active

        setIsActive(true);
        setIsTyping(true);

        try {
            // Create the initial chat entry reference *before* the first API call
            const chatRef = ref(database, `users/${user.uid}/chatHistory`);
            const newChatRef = push(chatRef);
            const newChatId = newChatRef.key;
            setChatId(newChatId); // Set the chat ID for this conversation state
            // console.log('New chat ID generated:', newChatId);

            // Initial save for the new chat entry with basic info
            // This save is important to create the entry in Firebase immediately
            const initialChatData = {
                emailId: email.id || 'unknown',
                emailSubject: email.subject || 'No Subject',
                emailSender: email.sender || 'Unknown Sender',
                messages: [], // Start with empty messages
                timestamp: new Date().toISOString(),
                scanResult: getLatestAnalysisResult() // Save initial scan result
            };
            await set(newChatRef, initialChatData); // Use set with the new ref for initial save
            // console.log('Initial chat entry created with ID:', newChatId);

            // Initial message to the API
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

            const initialMessage = {
                role: 'assistant',
                content: formatMessage(data.response || "Hi! I'm your AI assistant. How can I help you today?"),
                type: 'welcome',
                timestamp: formatTime()
            };

            // Update messages and save the first assistant message
            const messagesAfterStart = [initialMessage];
            setMessages(messagesAfterStart);

            // Save the state after the first assistant message using the established chatId
            // This save is now handled by the useEffect watching 'messages' and 'chatId'
            // await saveChatToFirebase(messagesAfterStart, newChatId);

        } catch (error) {
            console.error('Error in startChat:', error);
            setMessages([{
                role: 'assistant',
                content: formatMessage(`Sorry, I'm having trouble starting the chat. Please try again. ${error.message}`),
                type: 'error',
                timestamp: formatTime()
            }]);
            // Attempt to save the error state if chatId was set
            if (chatId) {
                // This save is now handled by the useEffect watching 'messages' and 'chatId'
                // await saveChatToFirebase(messages, chatId);
            }
        } finally {
            setIsTyping(false);
        }
    }, [isActive, email, user, getLatestAnalysisResult, chatId]);

    useEffect(() => {
        if (isStarted && !isActive) {
            startChat();
        } else if (!isStarted && isActive && chatId) {
            // When chat is closed/inactive, save the final state.
            // This save is now handled by the useEffect watching 'messages' and 'chatId'
            // saveChatToFirebase(messages, chatId); 
        }
    }, [isStarted, isActive, startChat, chatId, messages, saveChatToFirebase]);

    // Effect to save chat whenever messages or the AI analysis score changes
    // This effect ensures ongoing saves as the conversation progresses and analysis updates.
    // Debounce the save operation to avoid excessive writes during rapid message changes
    useEffect(() => {
        // Save the chat whenever messages or aiAnalysisScore updates,
        // but only after the chat has been started (chatId is set)
        // and there are messages to save.
        if (chatId && messages.length > 0) {
            // console.log('Messages or AI score changed, triggering save...', { chatId, messagesLength: messages.length, aiScore: aiAnalysisScore });
            const handler = setTimeout(() => {
                saveChatToFirebase(messages, chatId);
            }, 500); // Save after 500ms of inactivity

            return () => clearTimeout(handler); // Cleanup timeout on dependency change
        }
        // console.log('Save useEffect dependencies changed, but not saving.', { chatId, messagesLength: messages.length, aiScore: aiAnalysisScore });

    }, [messages, aiAnalysisScore, chatId, saveChatToFirebase]);

    const handleSendMessage = async () => {
        if (!userInput.trim() || isTyping) return; // Prevent sending empty or while typing
        if (!chatId) {
            console.error('Cannot send message: Chat ID not set. Start chat first.');
            // Handle case where chatId is somehow not set (should not happen after startChat)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: formatMessage('Sorry, there was an internal error. Please try starting a new chat.'),
                type: 'error',
                timestamp: formatTime()
            }]);
            return;
        }

        const userMessage = {
            role: 'user',
            content: userInput,
            type: 'message',
            timestamp: formatTime()
        };

        // Optimistically update messages immediately
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setUserInput('');
        setIsTyping(true);

        // A save will be triggered by the useEffect due to messages changing

        try {
            const response = await fetch('http://localhost:5000/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userInput,
                    conversation: messages, // Send previous messages + user's new message
                    email: email
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to process response');
            }

            const assistantMessage = {
                role: 'assistant',
                content: formatMessage(data.response), // Ensure formatMessage is applied
                type: 'message',
                timestamp: formatTime()
            };

            // Update messages with assistant response
            const updatedMessages = [...newMessages, assistantMessage];
            setMessages(updatedMessages);

            // Check if the assistant's message contains the final analysis score
            const finalScoreMatch = data.response.match(/calculate this email has a (\d+)% probability/);
            if (finalScoreMatch && finalScoreMatch[1]) {
                const finalScore = parseInt(finalScoreMatch[1], 10);
                if (!isNaN(finalScore) && onNewAnalysis) {
                    console.log('ChatBot: Detected final AI score', finalScore, 'calling onNewAnalysis...');
                    onNewAnalysis(finalScore); // Call the prop function with the final score
                }
            }

            // A save will be triggered by the useEffect due to messages changing

        } catch (error) {
            console.error('Error in handleSendMessage:', error);
            const errorMessage = {
                role: 'assistant',
                content: formatMessage(`Sorry, I'm having trouble processing your response. Please try again. ${error.message}`),
                type: 'error',
                timestamp: formatTime()
            };
            const updatedMessages = [...newMessages, errorMessage];
            setMessages(updatedMessages);
            // Attempt to save the error state
            if (chatId) {
                // A save will be triggered by the useEffect due to messages changing
            }
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