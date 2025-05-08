const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { simpleParser } = require('mailparser');
const axios = require('axios');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Set up multer to handle file uploads
const upload = multer({ dest: 'uploads/' });

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

// New endpoint to get all emails
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

// New endpoint to get a specific email
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

app.post('/analyze', upload.single('emlFile'), (req, res) => {
    // Ensure the file path is in WSL-compatible format with forward slashes
    const filePath = path.join(__dirname, req.file.path).replace(/\\/g, '/');

    console.log('File Path:', filePath);  // Debugging: log the file path

    // Check if the uploaded file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error('File does not exist:', filePath);  // Log the error with file path
            return res.status(500).json({ error: 'File does not exist' });
        }

        // Use spamassassin to analyze the uploaded .eml file
        exec(`spamassassin < "${filePath}"`, (error, stdout, stderr) => {
            if (error) {
                return res.status(500).json({ error: stderr });
            }

            // Parse the result - assuming stdout is a plain number or text
            console.log('SpamAssassin Output:', stdout);  // Log the full output

            const result = parseSpamassassinResult(stdout); // Use the function to parse the output
            res.json(result);
        });
    });
});

// Function to parse SpamAssassin output
const parseSpamassassinResult = (stdout) => {
    // Regex to extract the score from the SpamAssassin output
    const scoreMatch = stdout.match(/score=([0-9]+\.[0-9]+)/);

    if (scoreMatch) {
        const score = parseFloat(scoreMatch[1]);
        const legitimacy = score >= 5.0 ? 'Phishing' : 'Legitimate'; // If score >= 5.0, classify as phishing
        return { result: score, legitimacy };
    }

    // Return default values if no score is found
    return { result: null, legitimacy: 'Phishing' };
};

// New endpoint for analyzing email content directly
app.post('/analyze-content', async (req, res) => {
    try {
        const { subject, content, sender } = req.body;

        // Create a temporary file with the email content
        const tempFilePath = path.join(__dirname, 'temp', `${Date.now()}.eml`);
        const emailContent = `From: ${sender}\nSubject: ${subject}\n\n${content}`;

        // Ensure temp directory exists
        if (!fs.existsSync(path.join(__dirname, 'temp'))) {
            fs.mkdirSync(path.join(__dirname, 'temp'));
        }

        // Write the content to a temporary file
        fs.writeFileSync(tempFilePath, emailContent);

        // Use spamassassin to analyze the content
        exec(`spamassassin < "${tempFilePath}"`, (error, stdout, stderr) => {
            // Clean up the temporary file
            fs.unlinkSync(tempFilePath);

            if (error) {
                console.error('SpamAssassin error:', error);
                return res.status(500).json({ error: stderr });
            }

            const result = parseSpamassassinResult(stdout);
            res.json(result);
        });
    } catch (error) {
        console.error('Error analyzing content:', error);
        res.status(500).json({ error: 'Failed to analyze email content' });
    }
});

// Add this new endpoint
app.post('/api/ai-analyze', async (req, res) => {
    try {
        console.log('=== Node.js Server: Received AI analysis request ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));

        // Validate request body
        if (!req.body.email) {
            console.error('Missing email data in request');
            return res.status(400).json({
                error: 'Missing email data',
                details: 'Request must include email data'
            });
        }

        // Ensure all required fields are present
        const requiredFields = ['subject', 'sender', 'content'];
        for (const field of requiredFields) {
            if (!(field in req.body.email)) {
                console.error(`Missing required field: ${field}`);
                return res.status(400).json({
                    error: 'Invalid email data',
                    details: `Missing required field: ${field}`
                });
            }
        }

        // Ensure initialScanResult is properly formatted
        const initialScanResult = {
            result: req.body.initialScanResult?.result || 0,
            legitimacy: req.body.initialScanResult?.legitimacy || 'Unknown'
        };

        console.log('Formatted initialScanResult:', initialScanResult);

        // Ensure conversation is an array
        const conversation = Array.isArray(req.body.conversation) ? req.body.conversation : [];
        console.log('Formatted conversation:', conversation);

        // Prepare the request to the Python service
        const requestData = {
            email: req.body.email,
            initialScanResult: initialScanResult,
            conversation: conversation
        };

        console.log('=== Sending request to Python service ===');
        console.log('Request data:', JSON.stringify(requestData, null, 2));

        try {
            const response = await axios.post('http://localhost:5001/analyze', requestData);
            console.log('=== Received response from Python service ===');
            console.log('Response status:', response.status);
            console.log('Response data:', JSON.stringify(response.data, null, 2));

            // Forward the response from the Python service
            if (response.status >= 400) {
                console.error('Python service returned error:', response.data);
                res.status(response.status).json(response.data);
            } else {
                res.json(response.data);
            }
        } catch (axiosError) {
            console.error('=== Axios Error ===');
            console.error('Error message:', axiosError.message);
            console.error('Error response:', axiosError.response?.data);
            console.error('Error status:', axiosError.response?.status);
            console.error('Error headers:', axiosError.response?.headers);

            if (axiosError.response?.data) {
                // Forward the error response from the Python service
                res.status(axiosError.response.status).json(axiosError.response.data);
            } else {
                // Handle connection errors
                res.status(500).json({
                    error: 'Failed to connect to AI service',
                    details: axiosError.message
                });
            }
        }
    } catch (error) {
        console.error('=== Error in AI analysis ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);

        res.status(500).json({
            error: 'Failed to analyze email with AI',
            details: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
