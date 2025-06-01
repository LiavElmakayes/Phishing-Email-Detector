import React, { useState, useRef } from 'react';
import './EmailUploader.css';
import { GrUpload } from "react-icons/gr";
import { FaSpinner } from "react-icons/fa";
import { ref, push, set, get } from "firebase/database";
import { useSelector } from 'react-redux';
import { database } from '../../firebase';

const EmailUploader = ({ onScanResult }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showScrollPrompt, setShowScrollPrompt] = useState(false);
    const fileInputRef = useRef(null);
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit
    const user = useSelector((state) => state.AuthReducer.user);

    const saveScanToHistory = async (scanData) => {
        if (!user) {
            console.log('No user found, cannot save scan');
            return;
        }

        console.log('Saving scan data:', scanData);

        const scanRef = ref(database, `users/${user.uid}/emailHistory`);
        const newScanRef = push(scanRef);

        const historyEntry = {
            ...scanData,
            scanDate: new Date().toISOString(),
            scanType: 'manual_upload',
            filename: scanData.filename,
            riskLevel: scanData.legitimacy === 'Legitimate' ? 'Low' : 'High',
            legitimacy: scanData.legitimacy
        };

        console.log('History entry to save:', historyEntry);

        try {
            await set(newScanRef, historyEntry);
            console.log('Scan saved successfully with ID:', newScanRef.key);

            // Verify the data was saved
            const savedData = await get(newScanRef);
            console.log('Verified saved data:', savedData.val());
        } catch (error) {
            console.error('Error saving scan to history:', error);
            console.error('Error details:', {
                code: error.code,
                message: error.message,
                stack: error.stack
            });
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
                    setIsLoading(false);
                    const scanResult = {
                        ...data,
                        filename: file.name
                    };
                    onScanResult(scanResult);
                    // Save to Firebase history
                    saveScanToHistory(scanResult);
                    setShowScrollPrompt(true);
                    setTimeout(() => setShowScrollPrompt(false), 5000);
                })
                .catch(error => {
                    console.error('Error uploading file:', error);
                    setIsLoading(false);
                    setError('There was an error scanning the file. Please try again.');
                });
        }
    };

    return (
        <div>
            <div className='title-area'>
                <h1
                    className='title'>Check Your Email for Phishing Threats
                </h1>
            </div>

            <div className="center-upload-area">
                <div className="upload-area-container">
                    {showScrollPrompt && (
                        <div className="scroll-prompt">
                            <p>Analysis complete! Scroll down to see results</p>
                            <div className="scroll-arrow">↓</div>
                        </div>
                    )}
                    <div
                        className={`upload-area ${isDragging ? 'drag-active' : ''} ${isLoading ? 'loading' : ''} ${error ? 'error' : ''}`}
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        {isLoading ? (
                            <>
                                <div className="loading-spinner">
                                    <FaSpinner className="spinner-icon" />
                                </div>
                                <p className="loading-text">Analyzing your email...</p>
                            </>
                        ) : (
                            <>
                                <p className='description'>Upload your suspicious email file (.eml) and we'll analyze it for potential phishing indicators.</p>
                                {/* <div className="circle">
                                    <GrUpload size={25} className="upload-icon" />
                                </div> */}
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
                            </>
                        )}
                    </div>
                    {error && <p className="error-message">{error}</p>}
                </div>
            </div>
        </div>
    );
};

export default EmailUploader;