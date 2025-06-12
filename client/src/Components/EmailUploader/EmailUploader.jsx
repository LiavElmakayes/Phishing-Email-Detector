import React, { useState, useRef, useEffect } from 'react';
import './EmailUploader.css';
import { GrUpload } from "react-icons/gr";
import { FaSpinner } from "react-icons/fa";
import { ref, push, set, get } from "firebase/database";
import { useSelector } from 'react-redux';
import { database } from '../../firebase';
import ScanChatBot from '../ScanChatBot/ScanChatBot';

const EmailUploader = ({ onScanResult }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [scanData, setScanData] = useState(null);
    const [showChatBot, setShowChatBot] = useState(false);
    const [currentScanId, setCurrentScanId] = useState(null);
    const fileInputRef = useRef(null);
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit
    const user = useSelector((state) => state.AuthReducer.user);
    const prevUserRef = useRef(user);

    // Add effect to clear scan result only when user actually changes
    useEffect(() => {
        if (prevUserRef.current !== user) {
            onScanResult(null);
            prevUserRef.current = user;
        }
    }, [user, onScanResult]);

    const scrollToResults = () => {
        // Wait a short moment for the scan result to be rendered
        setTimeout(() => {
            const scanResultElement = document.querySelector('.scan-result');
            if (scanResultElement) {
                scanResultElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }, 100); // Small delay to ensure the result is rendered
    };

    const saveScanToHistory = async (scanData) => {
        if (!user) {
            console.log('No user found, cannot save scan');
            return Promise.resolve();
        }

        console.log('Saving scan data:', scanData);

        const scanRef = ref(database, `users/${user.uid}/emailHistory`);
        const newScanRef = push(scanRef);

        // Extract email data from the scan result
        const emailData = scanData.emailData || {};

        const historyEntry = {
            ...scanData,
            scanDate: new Date().toISOString(),
            scanType: 'manual_upload',
            filename: scanData.filename,
            riskLevel: scanData.legitimacy === 'Legitimate' ? 'Low' : 'High',
            legitimacy: scanData.legitimacy,
            subject: emailData.subject || scanData.subject || 'No subject',
            senderDomain: emailData.senderDomain || scanData.senderDomain || 'Unknown domain',
            emailContent: emailData.content || scanData.content || 'No content available'
        };

        console.log('History entry to save:', historyEntry);

        try {
            await set(newScanRef, historyEntry);
            console.log('Scan saved successfully with ID:', newScanRef.key);
            setCurrentScanId(newScanRef.key); // Store the scan ID

            // Verify the data was saved
            const savedData = await get(newScanRef);
            console.log('Verified saved data:', savedData.val());
            return Promise.resolve(newScanRef.key); // Return the scan ID
        } catch (error) {
            console.error('Error saving scan to history:', error);
            console.error('Error details:', {
                code: error.code,
                message: error.message,
                stack: error.stack
            });
            return Promise.reject(error);
        }
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    const handleFileChange = (e) => {
        handleFiles(e.target.files);
    };

    const handleFiles = (files) => {
        if (files.length > 0) {
            const file = files[0];

            if (!file.name.endsWith('.eml')) {
                setError('Please upload a .eml file.');
                return;
            }

            if (file.size > MAX_FILE_SIZE) {
                setError('File size exceeds 5MB limit.');
                return;
            }

            setError('');
            setIsLoading(true);
            setShowChatBot(false); // Hide chatbot while loading
            const formData = new FormData();
            formData.append('emlFile', file);

            fetch('http://localhost:5000/analyze', {
                method: 'POST',
                body: formData
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Received data from backend:', data);
                    setIsLoading(false);
                    const scanResult = {
                        ...data,
                        filename: file.name
                    };
                    console.log('Scan result to be saved:', scanResult);
                    console.log('Scan result structure:', {
                        result: scanResult.result,
                        legitimacy: scanResult.legitimacy,
                        details: scanResult.details,
                        raw: scanResult.raw,
                        metadata: scanResult.metadata,
                        emailData: scanResult.emailData,
                        spamAssassinResults: scanResult.spamAssassinResults
                    });

                    // Update the scan data for the chatbot
                    setScanData(scanResult);

                    // Call onScanResult with the complete scan data
                    onScanResult(scanResult);

                    // Save to Firebase history and get the scan ID
                    return saveScanToHistory(scanResult);
                })
                .then((scanId) => {
                    setCurrentScanId(scanId);
                    setShowChatBot(true);
                    scrollToResults();
                })
                .catch(error => {
                    console.error('Error uploading file:', error);
                    setIsLoading(false);
                    setError('There was an error scanning the file. Please try again.');
                    setShowChatBot(false);
                    setCurrentScanId(null);
                });
        }
    };

    return (
        <div className="email-uploader-wrapper">
            <div className='title-area'>
                <h1 className='title'>Check Your Email for Phishing Threats</h1>
            </div>

            <div className="upload-container">
                <div className="upload-box">
                    {isLoading ? (
                        <div className="loading-state">
                            <FaSpinner className="spinner-icon" />
                            <p className="loading-text">Analyzing your email...</p>
                        </div>
                    ) : (
                        <div
                            className={`upload-content ${isDragging ? 'drag-active' : ''}`}
                            onDragEnter={handleDragEnter}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <p className='description'>Upload your suspicious email file (.eml) and we'll analyze it for potential phishing indicators.</p>
                            <p className="first-desc">Drag or Drop the Email <GrUpload size={25} className="upload-icon" /></p>
                            <p className="second-desc">(.eml file only)</p>
                            <input
                                type="file"
                                id="emailFile"
                                accept=".eml"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={handleFileChange}
                            />
                            <label htmlFor="emailFile" className="upload-button">
                                Attach File
                            </label>
                        </div>
                    )}
                </div>
                {error && <p className="error-message">{error}</p>}
            </div>

            {/* Only show ScanChatBot when we have scan data and showChatBot is true */}
            {scanData && showChatBot && (
                <ScanChatBot
                    scanData={scanData}
                    isOpen={true}
                    onClose={() => {
                        setShowChatBot(false);
                        setCurrentScanId(null);
                    }}
                    scanId={currentScanId}
                />
            )}
        </div>
    );
};

export default EmailUploader;