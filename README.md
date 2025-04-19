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

- If `score >= 5.0` → Email is classified as **Phishing**
- Otherwise → Classified as **Legitimate**

## 🚀 Getting Started

### Clone the repo
```bash
git clone https://github.com/LiavElmakayes/Phishing-Email-Detector.git
cd Phishing-Email-Detector
📦 Backend Setup
cd server
npm install express multer cors
Ensure spamassassin is installed on your system and available from the terminal.

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
Third-year Computer Science students at SCE
Full Stack Developers
