// App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import EmailUploader from './Components/EmailUploader/EmailUploader';
import ScanResult from './Components/ScanResult/ScanResult';
import ChatbotPopup from './Components/ChatbotPopup/ChatbotPopup';
import EmailDemoPage from './Components/EmailDemoPage/EmailDemoPage';
import Auth from './Auth/AuthPage/Auth';
import './App.css';
import NavBar from './Components/NavBar/NavBar';
import Footer from './Components/Footer/Footer';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useDispatch, useSelector } from 'react-redux';
import { setUser } from './store/AuthReducer';

function App() {
  const [scanResult, setScanResult] = useState(null);
  const [showChatbot, setShowChatbot] = useState(false);
  const [loading, setLoading] = useState(true);

  const dispatch = useDispatch();
  const user = useSelector((state) => state.AuthReducer.user);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      dispatch(setUser(user));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [dispatch]);

  const handleScanResult = (result) => {
    setScanResult({
      ...result,
      filename: result.filename || 'Unknown File'
    });
    setTimeout(() => setShowChatbot(true), 1000);
  };

  const closeChatbot = () => {
    setShowChatbot(false);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <div className="app-container">
        <NavBar />
        <main className="app">
          <Routes>
            <Route
              path="/"
              element={user ? (
                <>
                  <EmailUploader onScanResult={handleScanResult} />
                  {scanResult && <ScanResult {...scanResult} />}
                  {showChatbot && <ChatbotPopup onClose={closeChatbot} />}
                </>
              ) : (
                <Navigate to="/auth" replace />
              )}
            />
            <Route
              path="/auth"
              element={user ? <Navigate to="/" replace /> : <Auth />}
            />
            <Route
              path="/demo"
              element={user ? <EmailDemoPage /> : <Navigate to="/auth" replace />}
            />
            <Route
              path="/demo/:id"
              element={user ? <EmailDemoPage /> : <Navigate to="/auth" replace />}
            />
            <Route
              path="*"
              element={<Navigate to="/" replace />}
            />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;