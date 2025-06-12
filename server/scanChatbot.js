const axios = require('axios');
const express = require('express');
const router = express.Router();
require('dotenv').config();

// OpenRouter API configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Validate API key on startup
if (!OPENROUTER_API_KEY) {
    console.error('ERROR: OPENROUTER_API_KEY is not set in environment variables');
    console.error('Please create a .env file in the server directory with:');
    console.error('OPENROUTER_API_KEY=your_api_key_here');
    process.exit(1);
}

// Scan chat endpoint
router.post('/scan-chat', async (req, res) => {
    try {
        const { message, conversation = [], scanData } = req.body;

        // Enhanced logging for debugging
        console.log('=== SCAN DATA DEBUG ===');
        console.log('Full scan data:', JSON.stringify(scanData, null, 2));
        console.log('SpamAssassin score:', scanData?.metadata?.spamAssassinScore);
        console.log('Legitimacy status:', scanData?.metadata?.legitimacy);
        console.log('========================');

        // Validate required fields
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (!scanData) {
            return res.status(400).json({ error: 'Scan data is required' });
        }

        // Prepare the conversation history with scan-specific system prompt
        const messages = [
            {
                role: 'system',
                content: `You are a helpful email security expert specializing in explaining email scan results. Your role is to help users understand the technical details of their email scan results.

BEHAVIOR RULES:
1. Focus on explaining the SpamAssassin results, headers, and other technical aspects
2. Be clear and concise in your explanations
3. Use technical terms but explain them in simple language
4. If asked about specific scan results, provide detailed explanations
5. If asked about general email security concepts, provide educational context
6. Always maintain a professional and helpful tone
7. If you don't know something, admit it rather than making up information

FORMATTING GUIDELINES:
- Use # for main headings
- Use ## for subheadings
- Use ### for section headings
- Use **text** for bold text
- Use __text__ for underlined text
- Use [color=color_name]text[/color] for colored text (e.g., [color=red]warning[/color])
- Use bullet points for lists
- Use proper spacing between sections

SCAN DATA CONTEXT:
- SpamAssassin Score: ${scanData?.metadata?.spamAssassinScore || 'Not available'}
- Legitimacy Status: ${scanData?.metadata?.legitimacy || 'Not determined'}
- Email Subject: ${scanData?.subject || 'No subject available'}
- Sender Domain: ${scanData?.senderDomain || 'Unknown domain'}

ANALYSIS APPROACH:
1. When explaining scan results:
   - Start with the overall assessment
   - Break down specific findings
   - Explain technical terms
   - Provide context for why certain results matter
2. When answering general questions:
   - Provide educational context
   - Use examples when helpful
   - Link back to the specific scan results when relevant
3. When explaining technical terms:
   - Define the term
   - Explain its significance
   - Provide real-world context
   - Link to the specific scan results if applicable`
            }
        ];

        // Add conversation history
        if (Array.isArray(conversation)) {
            messages.push(...conversation.filter(msg => msg.role !== 'system'));
        }

        // Add the current message
        messages.push({
            role: 'user',
            content: message
        });

        // Log what we're sending to API
        console.log('=== API REQUEST DEBUG ===');
        console.log('Message count:', messages.length);
        console.log('User message:', message);
        console.log('========================');

        // Make request to OpenRouter API
        const response = await axios.post(
            OPENROUTER_API_URL,
            {
                model: 'deepseek/deepseek-chat-v3-0324:free',
                messages: messages,
                temperature: 0.3,
                max_tokens: 1000,
                top_p: 0.9,
                frequency_penalty: 0.5,
                presence_penalty: 0.5
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'Email Scan Assistant'
                }
            }
        );

        // Extract the AI response
        const aiResponse = response.data.choices[0].message.content;

        // Log the response for debugging
        console.log('=== AI RESPONSE DEBUG ===');
        console.log('Response:', aiResponse);
        console.log('Response length:', aiResponse.length);
        console.log('========================');

        res.json({
            response: aiResponse
        });

    } catch (error) {
        console.error('Error in scan chat endpoint:', error.message);
        console.error('Full error:', error);

        let errorMessage = 'Failed to process chat message';
        if (error.response?.status === 429) {
            errorMessage = 'Rate limit exceeded. Please try again in a few minutes.';
        } else if (error.response?.status === 401) {
            errorMessage = 'API key is invalid or expired. Please check your OpenRouter API key.';
        } else if (error.response?.status === 400) {
            errorMessage = 'Invalid request format. Please check the request parameters.';
        }

        res.status(500).json({
            error: errorMessage,
            details: error.response?.data?.error?.message || error.message
        });
    }
});

module.exports = router; 