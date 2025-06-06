import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ref, onValue, query, orderByChild, remove } from "firebase/database";
import { useSelector } from 'react-redux';
import { database } from '../../firebase';
import { FaFileAlt, FaCalendarAlt, FaCheckCircle, FaTimesCircle, FaEnvelope, FaChartLine, FaSearch, FaFilter, FaGlobe, FaExternalLinkAlt, FaTrash } from 'react-icons/fa';
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
    const [deleteConfirmation, setDeleteConfirmation] = useState(null);
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

    // Function to parse and render links in the content
    const renderEmailContent = (content) => {
        if (!content) return null;

        // Check if content is HTML
        const isHtml = content.includes('<html') || content.includes('<body') || content.includes('<div');

        if (isHtml) {
            // Create a temporary div to parse HTML content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;

            // Process all links in the HTML content
            const links = tempDiv.getElementsByTagName('a');
            Array.from(links).forEach(link => {
                const url = link.href;
                if (url) {
                    link.setAttribute('target', '_blank');
                    link.setAttribute('rel', 'noopener noreferrer');
                    link.className = 'history-email-link';
                    link.title = `Opens in new tab: ${url}`;

                    // Add external link icon
                    const icon = document.createElement('span');
                    icon.innerHTML = '<svg class="history-external-link-icon" viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>';
                    link.appendChild(icon);
                }
            });

            // Process all images
            const images = tempDiv.getElementsByTagName('img');
            Array.from(images).forEach(img => {
                img.className = 'history-email-image';
                // Add alt text if missing
                if (!img.alt) {
                    img.alt = 'Email image';
                }
                // Add loading="lazy" for better performance
                img.loading = 'lazy';
            });

            return (
                <div
                    className="history-email-html-content"
                    dangerouslySetInnerHTML={{ __html: tempDiv.innerHTML }}
                />
            );
        }

        // For plain text content, handle URLs and base64 images
        const parts = [];
        let lastIndex = 0;

        // Regular expression to match URLs and base64 images
        const urlRegex = /(https?:\/\/[^\s\]]+)/g;
        const base64Regex = /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g;

        // Combine both patterns
        const combinedRegex = new RegExp(`(${urlRegex.source}|${base64Regex.source})`, 'g');

        let match;
        while ((match = combinedRegex.exec(content)) !== null) {
            // Add text before the match, removing any trailing brackets
            if (match.index > lastIndex) {
                const text = content.slice(lastIndex, match.index).replace(/[[\]]/g, '');
                if (text.trim()) {
                    parts.push(text);
                }
            }

            const matchedText = match[0];

            // Check if it's a base64 image
            if (matchedText.startsWith('data:image/')) {
                try {
                    parts.push(
                        <div key={match.index} className="history-email-image-container">
                            <img
                                src={matchedText}
                                alt="Email attachment"
                                className="history-email-image"
                                loading="lazy"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    console.log('Failed to load image');
                                }}
                            />
                        </div>
                    );
                } catch (error) {
                    console.error('Error rendering image:', error);
                }
            } else {
                // It's a URL
                const cleanUrl = matchedText.replace(/[[\]]/g, '');
                parts.push(
                    <a
                        key={match.index}
                        href={cleanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="history-email-link"
                        title={`Opens in new tab: ${cleanUrl}`}
                    >
                        {cleanUrl}
                        <FaExternalLinkAlt className="history-external-link-icon" />
                    </a>
                );
            }

            lastIndex = match.index + matchedText.length;
        }

        // Add any remaining text, removing any brackets
        if (lastIndex < content.length) {
            const text = content.slice(lastIndex).replace(/[[\]]/g, '');
            if (text.trim()) {
                parts.push(text);
            }
        }

        return parts;
    };

    const handleDelete = async (scanId) => {
        try {
            const historyRef = ref(database, `users/${user.uid}/emailHistory/${scanId}`);
            await remove(historyRef);
            setDeleteConfirmation(null);
        } catch (error) {
            console.error('Error deleting scan:', error);
            setError('Failed to delete scan history');
        }
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

            <p className="showing-scans-text">
                {scanHistory.length === 0
                    ? "You don't have any scans yet"
                    : scanHistory.length === 1
                        ? `Showing 1 scan`
                        : filteredScans.length === scanHistory.length
                            ? `Showing all ${scanHistory.length} scans`
                            : `Showing ${filteredScans.length} of ${scanHistory.length} scans${searchTerm ? ` for "${searchTerm}"` : ''}${filterStatus !== 'All Status' ? ` (${filterStatus})` : ''}`
                }
            </p>

            {filteredScans.length === 0 && scanHistory.length > 0 ? (
                <div className="no-results">
                    <FaSearch size={48} />
                    <p>No results found for your search/filter criteria.</p>
                </div>
            ) : filteredScans.length === 0 && scanHistory.length === 0 ? (
                <div className="no-history">
                    <div className="no-history-content">
                        <div className="no-history-icon-wrapper">
                            <FaFileAlt size={64} />
                        </div>
                        <h3 className="no-history-title">No Scan History Available</h3>
                        <p className="no-history-description">Upload and scan an email to see your analysis results here</p>
                        <div className="no-history-decoration">
                            <div className="decoration-circle"></div>
                            <div className="decoration-circle"></div>
                            <div className="decoration-circle"></div>
                        </div>
                    </div>
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

                            <div className="card-actions">
                                <button
                                    className="view-email-btn"
                                    onClick={() => setSelectedEmail(scan)}
                                >
                                    <FaEnvelope /> View Email
                                </button>
                                <button
                                    className="delete-scan-btn"
                                    onClick={() => setDeleteConfirmation(scan)}
                                >
                                    <FaTrash /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmation && (
                <div className="delete-modal">
                    <div className="delete-modal-content">
                        <h3>Delete Scan History</h3>
                        <p>Are you sure you want to delete this scan history? This action cannot be undone.</p>
                        <div className="delete-modal-actions">
                            <button
                                className="cancel-delete-btn"
                                onClick={() => setDeleteConfirmation(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="confirm-delete-btn"
                                onClick={() => handleDelete(deleteConfirmation.id)}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for Email Content */}
            {selectedEmail && (
                <div className="history-scan-modal">
                    <div className="history-modal-content">
                        <button className="history-close-button" onClick={() => setSelectedEmail(null)}>×</button>
                        <h2>Email Details</h2>
                        <div className="history-email-header">
                            <div className="history-email-info-grid">
                                <div className="history-email-info-item">
                                    <div className="history-info-icon">
                                        <FaFileAlt />
                                    </div>
                                    <div className="history-info-content">
                                        <span className="history-info-label">Filename</span>
                                        <span className="history-info-value">{selectedEmail.filename}</span>
                                    </div>
                                </div>
                                <div className="history-email-info-item">
                                    <div className="history-info-icon">
                                        <FaEnvelope />
                                    </div>
                                    <div className="history-info-content">
                                        <span className="history-info-label">Subject</span>
                                        <span className="history-info-value">{selectedEmail.subject || 'No subject'}</span>
                                    </div>
                                </div>
                                <div className="history-email-info-item">
                                    <div className="history-info-icon">
                                        <FaGlobe />
                                    </div>
                                    <div className="history-info-content">
                                        <span className="history-info-label">From</span>
                                        <span className="history-info-value">{selectedEmail.senderDomain || 'Unknown domain'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <h2>Email Content</h2>
                        <div className="history-email-body">
                            <div className="history-email-content-text">
                                {selectedEmail.emailContent ? (
                                    <pre>{renderEmailContent(selectedEmail.emailContent)}</pre>
                                ) : (
                                    <p className="history-no-content">No email content available</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmailHistory; 