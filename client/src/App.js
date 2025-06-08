// App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import EmailUploader from './Components/EmailUploader/EmailUploader';
import ScanResult from './Components/ScanResult/ScanResult';
import EmailDemoPage from './Components/EmailDemoPage/EmailDemoPage';
import EmailHistory from './Components/EmailHistory/EmailHistory';
import ChatHistory from './Components/ChatHistory/ChatHistory';
import Auth from './Auth/Auth';
import './App.css';
import NavBar from './Components/NavBar/NavBar';
import Footer from './Components/Footer/Footer';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useDispatch } from 'react-redux';
import { setUser } from './store/AuthReducer';

// Create a wrapper component to handle the Footer rendering
const AppContent = ({ user, handleScanResult, scanResult, isLoading }) => {
  const location = useLocation();
  const isEmailDemoPage = location.pathname.startsWith('/demo');

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
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
            path="/history"
            element={user ? <EmailHistory /> : <Navigate to="/auth" replace />}
          />
          <Route
            path="/chat-history"
            element={user ? <ChatHistory /> : <Navigate to="/auth" replace />}
          />
          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </main>
      {!isEmailDemoPage && <Footer />}
    </div>
  );
};

function App() {
  const [user, setUserState] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const dispatch = useDispatch();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserState(user);
        dispatch(setUser(user));
      } else {
        setUserState(null);
        dispatch(setUser(null));
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [dispatch]);

  const handleScanResult = useCallback((result) => {
    setScanResult(result);
  }, []);

  return (
    <Router>
      <AppContent
        user={user}
        handleScanResult={handleScanResult}
        scanResult={scanResult}
        isLoading={isLoading}
      />
    </Router>
  );
}

export default App;