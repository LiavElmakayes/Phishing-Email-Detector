const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { exec } = require('child_process');
const { simpleParser } = require('mailparser');
const chatbotRouter = require('./chatbot');
const scanChatbotRouter = require('./scanChatbot');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Set up multer to handle file uploads
const upload = multer({ dest: 'uploads/' });

// Use the chatbot router
app.use('/api', chatbotRouter);

// Add the scan chatbot route
app.use('/api', scanChatbotRouter);

// Function to format sender information
const formatSender = (parsed) => {
    if (!parsed.from) return 'Unknown Sender';

    console.log('Raw from object:', parsed.from);

    // If we have the value array with sender details
    if (parsed.from.value && parsed.from.value.length > 0) {
        const sender = parsed.from.value[0];
        console.log('Sender details:', sender);

        if (sender.name && sender.address) {
            return `${sender.name} <${sender.address}>`;
        }
        return sender.address || 'Unknown Sender';
    }

    // If we have the text representation
    if (parsed.from.text) {
        console.log('Using text representation:', parsed.from.text);
        return parsed.from.text;
    }

    return 'Unknown Sender';
};

// Endpoint to get all emails
app.get('/emails', async (req, res) => {
    try {
        const emailsDir = path.join(__dirname, 'emails');
        const files = fs.readdirSync(emailsDir).filter(f => f.endsWith('.eml'));
        const emails = [];

        for (const file of files) {
            const emlPath = path.join(emailsDir, file);
            const emlContent = fs.readFileSync(emlPath);
            const parsed = await simpleParser(emlContent);

            const sender = formatSender(parsed);
            console.log(`Formatted sender for ${file}:`, sender);

            emails.push({
                id: file,
                sender: sender,
                subject: parsed.subject || 'No Subject',
                content: parsed.text || parsed.html || 'No content',
                snippet: parsed.text?.slice(0, 100) || parsed.html?.slice(0, 100) || 'No content',
                time: parsed.date || new Date(),
                read: false,
                starred: false,
                important: false,
                hasAttachment: parsed.attachments?.length > 0,
                category: 'primary'
            });
        }

        res.json(emails);
    } catch (error) {
        console.error('Error reading emails:', error);
        res.status(500).json({ error: 'Failed to read emails' });
    }
});

// Endpoint to get a specific email
app.get('/emails/:id', async (req, res) => {
    try {
        const emailId = req.params.id;
        const emlPath = path.join(__dirname, 'emails', emailId);

        console.log('Attempting to read email file:', emlPath);

        if (!fs.existsSync(emlPath)) {
            console.error('Email file not found:', emlPath);
            return res.status(404).json({ error: 'Email not found' });
        }

        const emlContent = fs.readFileSync(emlPath, 'utf8');
        console.log('Email file read successfully');

        const parsed = await simpleParser(emlContent);
        console.log('Email parsed successfully');
        console.log('Raw parsed from:', parsed.from);

        const sender = formatSender(parsed);
        console.log('Formatted sender:', sender);

        const responseData = {
            id: emailId,
            sender: sender,
            subject: parsed.subject || 'No Subject',
            content: parsed.text || parsed.html || 'No content',
            time: parsed.date || new Date(),
            attachments: parsed.attachments || []
        };

        console.log('Sending response:', JSON.stringify(responseData, null, 2));

        res.json(responseData);
    } catch (error) {
        console.error('Error reading email:', error);
        res.status(500).json({
            error: 'Failed to read email',
            details: error.message
        });
    }
});

// Endpoint to get raw .eml file
app.get('/emails/:id/raw', (req, res) => {
    try {
        const emailId = req.params.id;
        const emlPath = path.join(__dirname, 'emails', emailId);

        if (!fs.existsSync(emlPath)) {
            console.error('Email file not found:', emlPath);
            return res.status(404).json({ error: 'Email not found' });
        }

        // Send the raw .eml file
        res.sendFile(emlPath);
    } catch (error) {
        console.error('Error reading email file:', error);
        res.status(500).json({
            error: 'Failed to read email file',
            details: error.message
        });
    }
});

app.post('/analyze', upload.single('emlFile'), async (req, res) => {
    // Ensure the file path is in WSL-compatible format with forward slashes
    const filePath = path.join(__dirname, req.file.path).replace(/\\/g, '/');

    console.log('File Path:', filePath);  // Debugging: log the file path

    // Check if the uploaded file exists
    fs.access(filePath, fs.constants.F_OK, async (err) => {
        if (err) {
            console.error('File does not exist:', filePath);  // Log the error with file path
            return res.status(500).json({ error: 'File does not exist' });
        }

        try {
            // First, parse the .eml file to get email details
            const emlContent = fs.readFileSync(filePath);
            const parsed = await simpleParser(emlContent);

            // Extract sender domain from the email address
            const senderEmail = parsed.from?.value?.[0]?.address || '';
            const senderDomain = senderEmail.split('@')[1] || 'Unknown domain';

            // Clean up the content
            let cleanContent = '';
            if (parsed.text) {
                // If we have plain text, use that
                cleanContent = parsed.text;
            } else if (parsed.html) {
                // If we only have HTML, strip HTML tags and decode entities
                cleanContent = parsed.html
                    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
                    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
                    .replace(/&amp;/g, '&') // Replace &amp; with &
                    .replace(/&lt;/g, '<') // Replace &lt; with <
                    .replace(/&gt;/g, '>') // Replace &gt; with >
                    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                    .trim(); // Remove leading/trailing whitespace
            }

            // Use spamassassin to analyze the uploaded .eml file
            exec(`spamassassin < "${filePath}"`, (error, stdout, stderr) => {
                if (error) {
                    return res.status(500).json({ error: stderr });
                }

                // Parse the result - assuming stdout is a plain number or text
                console.log('SpamAssassin Output:', stdout);  // Log the full output

                const result = parseSpamassassinResult(stdout); // Use the function to parse the output

                // Combine SpamAssassin result with email details
                const response = {
                    ...result,
                    subject: parsed.subject || 'No subject',
                    senderDomain: senderDomain,
                    content: cleanContent || 'No content available',
                    emailData: {
                        subject: parsed.subject || 'No subject',
                        senderDomain: senderDomain,
                        content: cleanContent || 'No content available',
                        from: parsed.from?.text || 'Unknown sender',
                        to: parsed.to?.text || 'Unknown recipient',
                        date: parsed.date || 'Unknown date'
                    },
                    raw: result.raw // Include the raw SpamAssassin output
                };

                console.log('Sending response:', JSON.stringify(response, null, 2));
                res.json(response);
            });
        } catch (error) {
            console.error('Error processing email:', error);
            res.status(500).json({
                error: 'Failed to process email',
                details: error.message
            });
        }
    });
});

// Function to parse SpamAssassin output
const parseSpamassassinResult = (stdout) => {
    try {
        // Extract the score
        const scoreMatch = stdout.match(/score=([0-9]+\.[0-9]+)/);
        const score = scoreMatch ? parseFloat(scoreMatch[1]) : null;
        const legitimacy = score >= 5.0 ? 'Phishing' : 'Legitimate';

        // Extract SpamAssassin headers
        const spamStatus = stdout.match(/X-Spam-Status: (.*?)(?:\n|$)/)?.[1];
        const spamLevel = stdout.match(/X-Spam-Level: (.*?)(?:\n|$)/)?.[1];
        const spamCheckerVersion = stdout.match(/X-Spam-Checker-Version: (.*?)(?:\n|$)/)?.[1];
        const spamFlag = stdout.match(/X-Spam-Flag: (.*?)(?:\n|$)/)?.[1];

        // Parse tests from Spam-Status
        let tests = [];
        if (spamStatus) {
            const testsMatch = spamStatus.match(/tests=(.*?)(?:\s|$)/);
            if (testsMatch) {
                tests = testsMatch[1].split(',').map(test => {
                    const [name, score] = test.split('=');
                    return {
                        name: name.trim(),
                        score: score ? parseFloat(score) : 0
                    };
                });
            }
        }

        // Parse authentication results
        const authResults = stdout.match(/Authentication-Results: (.*?)(?:\n|$)/)?.[1];
        const spfResult = stdout.match(/Received-SPF: (.*?)(?:\n|$)/)?.[1];
        const dkimResult = authResults?.match(/dkim=(.*?)(?:\s|$)/)?.[1];
        const dmarcResult = authResults?.match(/dmarc=(.*?)(?:\s|$)/)?.[1];

        // Parse email headers
        const received = stdout.match(/Received: (.*?)(?:\n(?![ \t])|$)/gs)?.map(h => h.trim()) || [];
        const messageId = stdout.match(/Message-Id: (.*?)(?:\n|$)/)?.[1];
        const returnPath = stdout.match(/Return-Path: (.*?)(?:\n|$)/)?.[1];
        const senderIP = stdout.match(/X-Sender-IP: (.*?)(?:\n|$)/)?.[1];
        const contentType = stdout.match(/Content-Type: (.*?)(?:\n|$)/)?.[1];
        const date = stdout.match(/Date: (.*?)(?:\n|$)/)?.[1];

        // Parse content analysis details
        const contentAnalysis = stdout.match(/Content analysis details:\s*\((.*?)\)\s*\n\n(.*?)(?:\n\n|$)/s);
        let analysisDetails = [];
        if (contentAnalysis) {
            const detailsLines = contentAnalysis[2].split('\n');
            analysisDetails = detailsLines
                .filter(line => line.match(/^\s*[0-9.-]+\s+\w+/))
                .map(line => {
                    const [points, rule, ...desc] = line.trim().split(/\s+/);
                    return {
                        points: parseFloat(points),
                        rule: rule,
                        description: desc.join(' ')
                    };
                });
        }

        return {
            result: score,
            legitimacy,
            metadata: {
                spamAssassinScore: score,
                spamStatus,
                spamLevel,
                spamCheckerVersion,
                spamFlag,
                tests,
                authentication: {
                    spf: spfResult,
                    dkim: dkimResult,
                    dmarc: dmarcResult
                },
                analysisDetails
            },
            headers: {
                received,
                messageId,
                returnPath,
                senderIP,
                contentType,
                date
            },
            raw: stdout // Include the complete raw output
        };
    } catch (error) {
        console.error('Error parsing SpamAssassin output:', error);
        return {
            result: null,
            legitimacy: 'Phishing',
            metadata: {
                spamAssassinScore: null,
                error: 'Failed to parse SpamAssassin output'
            },
            raw: stdout
        };
    }
};

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
