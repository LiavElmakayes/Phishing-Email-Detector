const axios = require('axios');
const express = require('express');
const router = express.Router();

// OpenRouter API configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Chat endpoint with OpenRouter integration
router.post('/chat', async (req, res) => {
    try {
        const { message, conversation, email, initialScanResult } = req.body;

        console.log('Received chat request:', {
            message,
            conversationLength: conversation?.length,
            hasEmail: !!email,
            hasScanResult: !!initialScanResult
        });

        // Prepare the conversation history for the API
        const messages = [
            {
                role: 'system',
                content: `You are a friendly and helpful AI assistant. Keep your responses brief and conversational.
                For any questions about the current email, use this information:
                - Subject: "${email?.subject || 'Not available'}"
                - Sender: "${email?.sender || 'Not available'}"
                - Content: "${email?.content || 'Not available'}"
                - Scan Result: ${JSON.stringify(initialScanResult || {})}
                
                Always keep responses under 2-3 sentences.`
            },
            ...conversation.filter(msg => msg.role !== 'system').map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            {
                role: 'user',
                content: message
            }
        ];

        console.log('Sending request to OpenRouter with messages:', messages);

        // Make request to OpenRouter API
        const response = await axios.post(
            OPENROUTER_API_URL,
            {
                model: 'microsoft/phi-4-reasoning-plus:free',
                messages: messages,
                temperature: 0.2,
                max_tokens: 100,  // Reduced to ensure shorter responses
                presence_penalty: 1.0,
                frequency_penalty: 1.0
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'Phishing Detector Chat'
                }
            }
        );

        console.log('Received response from OpenRouter:', response.data);

        // Extract the AI response
        const aiResponse = response.data.choices[0].message.content;

        res.json({
            response: aiResponse
        });

    } catch (error) {
        console.error('Error in chat endpoint:', error);
        console.error('Error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            headers: error.response?.headers
        });
        res.status(500).json({
            error: 'Failed to process chat message',
            details: error.message,
            response: error.response?.data
        });
    }
});

module.exports = router; 