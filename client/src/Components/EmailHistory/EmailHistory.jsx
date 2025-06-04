import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ref, onValue, query, orderByChild } from "firebase/database";
import { useSelector } from 'react-redux';
import { database } from '../../firebase';
import { FaFileAlt, FaCalendarAlt, FaCheckCircle, FaTimesCircle, FaEnvelope, FaChartLine, FaSearch, FaFilter } from 'react-icons/fa';
import './EmailHistory.css';

// Custom Dropdown Component
const CustomDropdown = ({ filterStatus, setFilterStatus }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const options = [
        { value: "All Status", label: "All Status" },
        { value: "Legitimate", label: "Legitimate" },
        { value: "Phishing", label: "Phishing" },
        { value: "Suspicious", label: "Suspicious" }
    ];

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (value) => {
        setFilterStatus(value);
        setIsOpen(false);
    };

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className="custom-dropdown-container" ref={dropdownRef}>
            <FaFilter className="filter-icon" />

            <button
                type="button"
                className={`custom-dropdown-button ${isOpen ? 'open' : ''}`}
                onClick={toggleDropdown}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
            >
                <span className="dropdown-text">{filterStatus}</span>
                <svg
                    className={`dropdown-arrow ${isOpen ? 'rotated' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <polyline points="6,9 12,15 18,9" />
                </svg>
            </button>

            {isOpen && (
                <div className="custom-dropdown-options">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={`dropdown-option ${filterStatus === option.value ? 'selected' : ''}`}
                            onClick={() => handleSelect(option.value)}
                            role="option"
                            aria-selected={filterStatus === option.value}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const EmailHistory = () => {
    const [scanHistory, setScanHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All Status');
    const user = useSelector((state) => state.AuthReducer.user);

    useEffect(() => {
        if (!user) return;

        const historyRef = ref(database, `users/${user.uid}/emailHistory`);
        // Order by scanDate, descending
        const historyQuery = query(historyRef, orderByChild('scanDate'));

        const unsubscribe = onValue(historyQuery, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const historyArray = Object.entries(data).map(([id, scan]) => ({
                    id,
                    ...scan
                })).sort((a, b) => new Date(b.scanDate) - new Date(a.scanDate)); // Sort descending

                setScanHistory(historyArray);
                setError(null);
            } else {
                setScanHistory([]); // Set to empty array if no data
                setError(null); // Clear error if data is just empty
            }
            setLoading(false);
        }, (error) => {
            setError(`Error loading scan history: ${error.message}`);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const filteredScans = useMemo(() => {
        return scanHistory.filter(scan => {
            const filenameMatch = scan.filename.toLowerCase().includes(searchTerm.toLowerCase());
            const statusMatch = filterStatus === 'All Status' || scan.legitimacy === filterStatus;
            return filenameMatch && statusMatch;
        });
    }, [scanHistory, searchTerm, filterStatus]);

    const totalScans = scanHistory.length;
    const legitimateScans = scanHistory.filter(scan => scan.legitimacy === 'Legitimate').length;
    const suspiciousScans = scanHistory.filter(scan => scan.legitimacy === 'Phishing' || scan.legitimacy === 'Suspicious').length;
    const totalRisk = scanHistory.reduce((sum, scan) => sum + (scan.result || 0), 0);
    const averageRisk = totalScans > 0 ? ((totalRisk / totalScans) * 10).toFixed(0) : 0;

    const getRiskLevelColor = (result) => {
        const scaledResult = (result || 0) * 10;
        if (scaledResult <= 33) return '#4CAF50'; // Low risk - Green
        if (scaledResult <= 66) return '#FFC107'; // Medium risk - Yellow
        return '#F44336'; // High risk - Red
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading scan history...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <div className="error-message">
                    <h3>Error</h3>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="email-history">
            <div className="history-header">
                <h2>Scan History</h2>
                <p className="history-subtitle">Track your email security analysis results</p>
            </div>

            {/* Summary Statistics */}
            <div className="summary-statistics">
                <div className="stat-card">
                    <div className="stat-icon total-scans-icon"><FaFileAlt /></div>
                    <div className="stat-info">
                        <div className="stat-value">{totalScans}</div>
                        <div className="stat-label">Total Scans</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon legitimate-icon"><FaCheckCircle /></div>
                    <div className="stat-info">
                        <div className="stat-value">{legitimateScans}</div>
                        <div className="stat-label">Legitimate</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon suspicious-icon"><FaTimesCircle /></div>
                    <div className="stat-info">
                        <div className="stat-value">{suspiciousScans}</div>
                        <div className="stat-label">Suspicious</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon average-risk-icon"><FaChartLine /></div>
                    <div className="stat-info">
                        <div className="stat-value">{averageRisk}/100</div>
                        <div className="stat-label">Average Risk</div>
                    </div>
                </div>
            </div>

            {/* Updated Search and Filter Bar */}
            <div className="filter-bar">
                <div className="filter-controls-container">
                    <div className="search-input-container">
                        <FaSearch className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search by filename..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                    <CustomDropdown
                        filterStatus={filterStatus}
                        setFilterStatus={setFilterStatus}
                    />
                </div>
            </div>

            <p className="showing-scans-text">Showing {filteredScans.length} of {totalScans} scans</p>

            {filteredScans.length === 0 && scanHistory.length > 0 ? (
                <div className="no-results">
                    <FaSearch size={48} />
                    <p>No results found for your search/filter criteria.</p>
                </div>
            ) : filteredScans.length === 0 && scanHistory.length === 0 ? (
                <div className="no-history">
                    <FaFileAlt size={48} />
                    <p>No scan history available</p>
                    <p className="sub-text">Upload and scan an email to see results here</p>
                </div>
            ) : (
                <div className="history-grid">
                    {filteredScans.map((scan) => (
                        <div key={scan.id} className="history-card">
                            <div className="card-header">
                                <div className="file-info">
                                    <FaFileAlt className="file-icon" />
                                    <span className="filename">{scan.filename}</span>
                                </div>
                                <div className="scan-date">
                                    <FaCalendarAlt />
                                    <span>{new Date(scan.scanDate).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <div className="card-legitimacy-status">
                                {scan.legitimacy === 'Legitimate' ? (
                                    <span className="legitimacy-badge legitimate"><FaCheckCircle /> Legitimate</span>
                                ) : scan.legitimacy === 'Phishing' ? (
                                    <span className="legitimacy-badge phishing"><FaTimesCircle /> Phishing</span>
                                ) : (
                                    <span className="legitimacy-badge suspicious"><FaTimesCircle /> Suspicious</span>
                                )}
                            </div>


                            <div className="card-risk-level">
                                <div className="risk-level-text">Risk Level:</div>
                                <div className="risk-score-container">
                                    <span className="risk-score" style={{ color: getRiskLevelColor(scan.result) }}>{((scan.result || 0) * 10).toFixed(0) || 'N/A'}/100</span>
                                </div>
                            </div>
                            <div className="risk-progress-bar-container">
                                <div
                                    className="risk-progress-bar"
                                    style={{
                                        width: `${((scan.result || 0) * 10)}%`,
                                        backgroundColor: getRiskLevelColor(scan.result),
                                    }}
                                ></div>
                            </div>

                            {/* Removed scanResult details from card content */}
                            {/* Re-add if needed elsewhere or in modal */}

                            <button
                                className="view-email-btn"
                                onClick={() => setSelectedEmail(scan)}
                            >
                                <FaEnvelope /> View Email
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal for Email Content */}
            {selectedEmail && (
                <div className="scan-modal">
                    <div className="modal-content">
                        <button className="close-button" onClick={() => setSelectedEmail(null)}>×</button>
                        <h2>Email Details</h2>
                        <div className="email-content">
                            <div className="email-header">
                                <div className="email-info-row">
                                    <span className="info-label">Filename:</span>
                                    <span className="info-value">{selectedEmail.filename}</span>
                                </div>
                                <div className="email-info-row">
                                    <span className="info-label">Subject:</span>
                                    <span className="info-value">{selectedEmail.subject || 'No subject'}</span>
                                </div>
                                <div className="email-info-row">
                                    <span className="info-label">Sender's Domain:</span>
                                    <span className="info-value">{selectedEmail.senderDomain || 'Unknown domain'}</span>
                                </div>
                            </div>
                            <div className="email-body">
                                <h3>Email Content</h3>
                                <div className="email-content-text">
                                    {selectedEmail.emailContent ? (
                                        <pre>{selectedEmail.emailContent}</pre>
                                    ) : (
                                        <p className="no-content">No email content available</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmailHistory; 