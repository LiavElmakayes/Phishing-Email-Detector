// App.jsx
import React, { useState } from 'react';
import EmailUploader from './Components/EmailUploader/EmailUploader';
import ScanResult from './Components/ScanResult/ScanResult';
import ChatbotPopup from './Components/ChatbotPopup/ChatbotPopup';
import './App.css';
import NavBar from './Components/NavBar/NavBar';
import Footer from './Components/Footer/Footer';


function App() {
  const [scanResult, setScanResult] = useState(null);
  const [showChatbot, setShowChatbot] = useState(false);

  const handleScanResult = (result) => {
    setScanResult(result);
    setTimeout(() => setShowChatbot(true), 1000); // Show chatbot after a 1-second delay
  };

  const closeChatbot = () => {
    setShowChatbot(false);
  };

  return (
    <>  
      <NavBar />
      <div className="app">
        <EmailUploader onScanResult={handleScanResult} />
        {scanResult && <ScanResult {...scanResult} />}
        {showChatbot && <ChatbotPopup onClose={closeChatbot} />}
      </div>
      <Footer />
    </>
  );
}

export default App;