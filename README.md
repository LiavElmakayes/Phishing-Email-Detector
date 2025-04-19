# 🛡️ Phishing Email Detector

This project is a full-stack web application designed to detect phishing emails using content analysis and SpamAssassin. It allows users to upload `.eml` files and receive a classification indicating whether the email is **Phishing** or **Legitimate**.

## 📦 Tech Stack

### 🌐 Frontend
- React (with functional components)
- Axios for HTTP requests
- Responsive design with accessible UI
- Organized component structure:
  - `NavBar`, `Footer`, `EmailUploader`, `ScanResult`, `ChatBotPopup`

### 🧠 Backend
- Node.js + Express
- Multer for handling `.eml` file uploads
- SpamAssassin integration for email content analysis
- Output parsing and scoring logic
- CORS enabled for client-server communication

## 🖥️ How It Works

1. User uploads an `.eml` file via the frontend.
2. The file is sent to the Express backend.
3. The backend uses SpamAssassin to scan the email and parse the output score.
4. The result is sent back to the frontend with a classification.
5. If the score is borderline or unclear, a chatbot is triggered to ask the user questions for better judgment (coming soon).

## 🔍 SpamAssassin Output Interpretation
SpamAssassin assigns a **spam score** based on email content.  
In this project, we convert that score into a **Phishing Likelihood Percentage** and always display the result as "`X% Phishing`".  

- Higher scores indicate higher likelihood of phishing.
- For example: a score of 5.0 might display as "50% Phishing", while a score of 8.6 would show "86% Phishing".
- This approach gives users a better sense of **risk level**, rather than a strict yes/no label.


## 🐳 Docker Setup for SpamAssassin

To run SpamAssassin without installing it directly on your system, use Docker.
1. Make sure Docker Desktop is running.
2. Open a terminal (e.g., Command Prompt, PowerShell, or a terminal app on Linux/Mac), and run the following commands:
```
docker pull instantlinux/spamassassin
docker run -d --name spamassassin -p 783:783 instantlinux/spamassassin
```
This will start the SpamAssassin server in a container on port 783, which the Node.js backend connects to for scanning emails.

## 🚀 Getting Started (Setup Guide)

### 📥 Clone the Repo
```
git clone https://github.com/LiavElmakayes/Phishing-Email-Detector.git
cd Phishing-Email-Detector
```
### 📦 Backend Setup
💡 The backend should be run from within the Ubuntu terminal if you're using WSL/Linux.  
Make sure SpamAssassin is also running (via Docker) before starting the server.
```
cd server
npm install 
node index.js
```

### 💻 Frontend Setup
```
cd client
npm install
npm start
```

Frontend runs on: http://localhost:3000  
Backend runs on: http://localhost:5000

### 💬 Future Features
Chatbot guidance for borderline cases
Enhanced visual analytics

### 🧑‍💻 Developed By  
Liav Elmakayes & Yuval Sangur  
🎓 Third-year Computer Science students at SCE  
💻 Full Stack Developers  
