const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Set up multer to handle file uploads
const upload = multer({ dest: 'uploads/' });

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
