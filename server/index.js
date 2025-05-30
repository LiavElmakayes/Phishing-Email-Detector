const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { exec } = require('child_process');
const { simpleParser } = require('mailparser');
const chatbotRouter = require('./chatbot');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Set up multer to handle file uploads
const upload = multer({ dest: 'uploads/' });

// Use the chatbot router
app.use('/api', chatbotRouter);

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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
