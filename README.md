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

- `score >= 5.0` → Email is classified as **Phishing**
- `score < 5.0` → Email is classified as **Legitimate**

## 🐳 Docker Setup for SpamAssassin

To run SpamAssassin without installing it directly on your system, use Docker:

```bash
docker pull instantlinux/spamassassin
docker run -d --name spamassassin -p 783:783 instantlinux/spamassassin
This will start the SpamAssassin server in a container on port 783, which the Node.js backend connects to for scanning emails.
```
Make sure Docker Desktop is running before executing these commands.

## 🚀 Getting Started

### Clone the repo
```bash
git clone https://github.com/LiavElmakayes/Phishing-Email-Detector.git
cd Phishing-Email-Detector
📦 Backend Setup
cd server
npm install express multer cors
node index.js
💡 The backend should be run from within the Ubuntu terminal if you're using WSL/Linux. Make sure SpamAssassin is also running (via Docker) before starting the server.

💻 Frontend Setup
cd ../client
npm install
npm start

Frontend runs on: http://localhost:3000
Backend runs on: http://localhost:5000

💬 Future Features
AI-based phishing classification using LLMs (BERT/GPT)

Chatbot guidance for borderline cases

Enhanced visual analytics

🧑‍💻 Developed By
Liav Elmakayes & Yuval Sangur
🎓 Third-year Computer Science students at SCE
💻 Full Stack Developers
