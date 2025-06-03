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

// Chat endpoint
router.post('/chat', async (req, res) => {
    try {
        const { message, conversation = [], email } = req.body;

        // Enhanced logging for debugging
        console.log('=== EMAIL DATA DEBUG ===');
        console.log('Full email object:', JSON.stringify(email, null, 2));
        console.log('Email subject:', email?.subject);
        console.log('Email sender:', email?.sender);
        console.log('Email content length:', email?.content?.length || 0);
        console.log('SpamAssassin score:', email?.metadata?.spamAssassinScore);
        console.log('Legitimacy status:', email?.metadata?.legitimacy);
        console.log('========================');

        // Validate required fields
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Safely extract email information with proper fallbacks
        const emailSubject = email?.subject || 'No subject available';
        const emailSender = email?.sender || 'Sender information not available';
        const emailContent = email?.content || 'Email content not available';
        const spamScore = email?.metadata?.spamAssassinScore || 'Not scanned';
        const legitimacyStatus = email?.metadata?.legitimacy || 'Not determined';

        // Create a clean summary of scan results for the AI
        let scanResultsSummary = 'No scan results available';
        if (email?.metadata?.spamAssassinDetails) {
            try {
                const details = typeof email.metadata.spamAssassinDetails === 'string'
                    ? JSON.parse(email.metadata.spamAssassinDetails)
                    : email.metadata.spamAssassinDetails;
                scanResultsSummary = `Scan completed with score: ${spamScore}, Status: ${legitimacyStatus}`;
            } catch (e) {
                console.log('Error parsing scan details:', e.message);
            }
        }

        // Prepare the conversation history with generic system prompt
        const messages = [
            {
                role: 'system',
                content: `You are a friendly cybersecurity expert specializing in email analysis and phishing detection. Your role is to help users identify potentially dangerous emails by asking simple, non-technical questions and analyzing email metadata.

BEHAVIOR RULES:
1. Start with a warm greeting ONLY at the beginning of the conversation
2. For follow-up questions, use simple transitions like "Thanks for your answer" or "I see"
3. Never repeat the greeting in subsequent messages
4. Ask only ONE question at a time
5. Keep explanations simple and non-technical
6. After all questions are answered, provide a summary and calculate a new phishing risk score
7. Always maintain a professional and clear communication style
8. Generate contextual questions based on the email content and previous answers
9. Provide brief analysis before each question

FORMATTING GUIDELINES:
- Use # for main headings
- Use ## for subheadings
- Use ### for section headings
- Use **text** for bold text
- Use __text__ for underlined text
- Use [color=color_name]text[/color] for colored text (e.g., [color=red]warning[/color])
- Use bullet points for lists
- Use proper spacing between sections

Example of well-formatted first message:
# Email Security Analysis

Hi there! I'm your email security assistant. I'll help you check if this email is safe.

## Initial Observations
I notice this email claims to be from **Coinbase** but comes from an unusual domain ([color=red]firesonic.ca[/color]).

## Question
Were you expecting any transaction notifications from Coinbase recently?

Example of well-formatted follow-up:
## Analysis Update
Thanks for your answer. I see this email is about account activity, which is a common phishing tactic.

## Concerns
- The sender's address looks unusual for Coinbase
- The domain [color=red]firesonic.ca[/color] is not associated with Coinbase
- The email contains urgent language

## Question
Have you received any legitimate emails from this address before?

Example of well-formatted summary:
# Final Analysis

## Key Findings
1. The email was unexpected
2. The sender's address is suspicious
3. It uses urgent language
4. Contains suspicious links
5. Requests immediate action

## Risk Assessment
Taking into account the SpamAssassin score and your responses, I calculate a phishing risk score of [color=red]85%[/color]. This email shows multiple signs of being a phishing attempt and should be treated with caution.

EMAIL CONTEXT:
- Subject: "${emailSubject}"
- Sender: "${emailSender}"
- SpamAssassin Score: ${spamScore}
- Legitimacy Status: ${legitimacyStatus}

ANALYSIS APPROACH:
1. Start with greeting and brief metadata analysis
2. Generate contextual questions based on:
   - Email content and subject
   - Sender information
   - Previous user responses
   - SpamAssassin score
   - Any suspicious patterns noticed
3. Before each question:
   - Briefly analyze the previous answer
   - Explain why the next question is relevant
   - Ask a contextual question
4. After all questions are answered, provide:
   - A summary of the analysis
   - A new phishing risk score (0-100%)

PHISHING RISK SCORE CALCULATION:
1. Start with SpamAssassin score (convert to 0-100% scale)
2. Add points based on user responses and email analysis:
   - Unexpected email: +20%
   - Unfamiliar sender: +20%
   - Urgent action requested: +20%
   - Spelling/grammar mistakes: +15%
   - Requests personal info: +25%
   - Suspicious links or attachments: +20%
   - Mismatched sender/company: +15%
3. Final score should be between 0-100%`
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

        // Log what we're sending to API (but truncate long content)
        console.log('=== API REQUEST DEBUG ===');
        console.log('Message count:', messages.length);
        console.log('System prompt length:', messages[0].content.length);
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
                    'X-Title': 'Email Security Assistant'
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
        console.error('Error in chat endpoint:', error.message);
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