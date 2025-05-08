// App.jsx
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EmailUploader from './Components/EmailUploader/EmailUploader';
import ScanResult from './Components/ScanResult/ScanResult';
import ChatbotPopup from './Components/ChatbotPopup/ChatbotPopup';
import EmailDemoPage from './Components/EmailDemoPage/EmailDemoPage';
import EmailViewPage from './Components/EmailDemoPage/EmailViewPage/EmailViewPage';
import './App.css';
import NavBar from './Components/NavBar/NavBar';
import Footer from './Components/Footer/Footer';

function App() {
  const [scanResult, setScanResult] = useState(null);
  const [showChatbot, setShowChatbot] = useState(false);

  const handleScanResult = (result) => {
    setScanResult({
      ...result,
      filename: result.filename || 'Unknown File'
    });
    setTimeout(() => setShowChatbot(true), 1000); // Show chatbot after a 1-second delay
  };

  const closeChatbot = () => {
    setShowChatbot(false);
  };

  return (
    <Router>
      <div className="app-container">
        <NavBar />
        <main className="app">
          <Routes>
            <Route path="/" element={
              <>
                <EmailUploader onScanResult={handleScanResult} />
                {scanResult && <ScanResult {...scanResult} />}
                {showChatbot && <ChatbotPopup onClose={closeChatbot} />}
              </>
            } />
            <Route path="/demo" element={<EmailDemoPage />} />
            <Route path="/demo/:id" element={<EmailDemoPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;