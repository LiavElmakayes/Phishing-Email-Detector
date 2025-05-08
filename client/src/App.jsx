import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EmailDemoPage from './Components/EmailDemoPage/EmailDemoPage';
import EmailViewPage from './Components/EmailDemoPage/EmailViewPage/EmailViewPage';

const App = () => {
    return (
        <Router>
            <Routes>
                <Route path="/demo" element={<EmailDemoPage />} />
                <Route path="/demo/:id" element={<EmailViewPage />} />
            </Routes>
        </Router>
    );
};

export default App; 