import React, { useEffect } from 'react';
import './ScanDataModal.css';
import { FaTimes, FaCopy } from 'react-icons/fa';

const ScanDataModal = ({ isOpen, onClose, scanData }) => {
    // Debug log to see what data the modal receives
    useEffect(() => {
        if (isOpen) {
            console.log('ScanDataModal received scanData:', scanData);
            console.log('ScanData type:', typeof scanData);
            console.log('Is scanData null?', scanData === null);
            console.log('Is scanData undefined?', scanData === undefined);
            console.log('ScanData structure:', {
                result: scanData?.result,
                legitimacy: scanData?.legitimacy,
                details: scanData?.details,
                raw: scanData?.raw,
                metadata: scanData?.metadata,
                emailData: scanData?.emailData,
                spamAssassinResults: scanData?.spamAssassinResults
            });
        }
    }, [isOpen, scanData]);

    if (!isOpen) return null;

    const formatScanData = (scanData) => {
        try {
            if (!scanData) {
                console.error('No scan data provided to formatScanData');
                return {
                    error: 'No scan data available',
                    summary: 'No data to display'
                };
            }

            console.log('Formatting scan data:', scanData);

            // Extract SpamAssassin details from raw data
            const rawData = scanData.raw || '';

            // Extract X-Spam-Status with full details
            const spamStatusMatch = rawData.match(/X-Spam-Status: (.*?)(?:\n(?:\t| )|$)/is);
            const spamStatus = spamStatusMatch ? spamStatusMatch[1].trim() : null;

            // Extract score from Spam-Status
            const scoreMatch = spamStatus ? spamStatus.match(/score=([\d.]+)/i) : null;
            const spamScore = scoreMatch ? scoreMatch[1] : scanData.result || 'Not available';

            // Extract tests from Spam-Status
            const testsMatch = spamStatus ? spamStatus.match(/tests=([^,]+)/i) : null;
            const tests = testsMatch ? testsMatch[1].split(',').map(test => test.trim()) : [];

            // Extract X-Spam-Level (asterisks)
            const spamLevelMatch = rawData.match(/X-Spam-Level: (.*?)(?:\n|$)/i);
            const spamLevel = spamLevelMatch ? spamLevelMatch[1].trim() : null;

            // Extract Authentication Results
            const authResultsMatch = rawData.match(/Authentication-Results: (.*?)(?:\n(?:\t| )|$)/is);
            const authResults = authResultsMatch ? authResultsMatch[1].trim() : null;

            // Extract SPF result
            const spfMatch = rawData.match(/Received-SPF: (.*?)(?:\n(?:\t| )|$)/is);
            const spfResult = spfMatch ? spfMatch[1].trim() : null;

            // Extract DKIM and DMARC from Authentication-Results
            const dkimMatch = authResults ? authResults.match(/dkim=([^;]+)/i) : null;
            const dmarcMatch = authResults ? authResults.match(/dmarc=([^;]+)/i) : null;

            // Extract Return-Path
            const returnPathMatch = rawData.match(/Return-Path: (.*?)(?:\n|$)/i);
            const returnPath = returnPathMatch ? returnPathMatch[1].trim() : null;

            // Extract X-Sender-IP
            const senderIPMatch = rawData.match(/X-Sender-IP: (.*?)(?:\n|$)/i);
            const senderIP = senderIPMatch ? senderIPMatch[1].trim() : null;

            // Extract Microsoft SCL
            const msExchangeSCL = rawData.match(/X-MS-Exchange-Organization-SCL: (\d+)/i)?.[1] ?? 'Not available';

            const formattedData = {
                summary: {
                    result: spamScore,
                    legitimacy: scanData.legitimacy ?? 'Unknown',
                    filename: scanData.filename ?? 'Unknown',
                    timestamp: new Date().toLocaleString()
                },
                emailDetails: {
                    subject: scanData.emailData?.subject ?? scanData.subject ?? 'Not available',
                    from: scanData.emailData?.from ?? 'Not available',
                    to: scanData.emailData?.to ?? 'Not available',
                    date: scanData.emailData?.date ?? scanData.headers?.date ?? 'Not available'
                },
                spamAssassinResults: {
                    spamStatus: spamStatus ?? 'Not available',
                    spamLevel: spamLevel ?? 'Not available',
                    spamScore: spamScore,
                    msExchangeSCL: msExchangeSCL,
                    tests: tests,
                    authentication: {
                        results: authResults ?? 'Not available',
                        spf: spfResult ?? 'Not available',
                        dkim: dkimMatch ? dkimMatch[1].trim() : 'Not available',
                        dmarc: dmarcMatch ? dmarcMatch[1].trim() : 'Not available'
                    }
                },
                headers: {
                    returnPath: returnPath ?? 'Not available',
                    senderIP: senderIP ?? 'Not available'
                },
                raw: scanData.raw ?? 'No raw data available'
            };

            console.log('Formatted data:', formattedData);
            return formattedData;
        } catch (error) {
            console.error('Error formatting scan data:', error);
            return {
                error: 'Error formatting scan data',
                summary: 'Failed to format data'
            };
        }
    };

    const handleCopyData = () => {
        try {
            const jsonString = JSON.stringify(scanData, null, 2);
            navigator.clipboard.writeText(jsonString)
                .then(() => {
                    alert('Scan data copied to clipboard!');
                })
                .catch(err => {
                    console.error('Failed to copy data:', err);
                    alert('Failed to copy data to clipboard');
                });
        } catch (error) {
            console.error('Error copying data:', error);
            alert('Error preparing data for clipboard');
        }
    };

    try {
        const formattedData = formatScanData(scanData);

        return (
            <div className="scan-data-modal-overlay" onClick={onClose}>
                <div className="scan-data-modal-container" onClick={e => e.stopPropagation()}>
                    <div className="scan-data-modal-header">
                        <h2>Email Scan Results</h2>
                        <div className="scan-data-modal-actions">
                            <button onClick={handleCopyData} className="scan-data-modal-copy-button">
                                Copy Data
                            </button>
                            <button onClick={onClose} className="scan-data-modal-close-button">
                                ×
                            </button>
                        </div>
                    </div>
                    <div className="scan-data-modal-content">
                        {formattedData.error ? (
                            <div className="scan-data-modal-error">
                                <h3>Error</h3>
                                <p>{formattedData.error}</p>
                            </div>
                        ) : (
                            <>
                                <div className="scan-data-modal-summary">
                                    <h3>Summary</h3>
                                    <div className="scan-data-modal-summary-grid">
                                        <div className="scan-data-modal-summary-item">
                                            <span className="scan-data-modal-label">Risk Score:</span>
                                            <span className={`scan-data-modal-value ${formattedData.summary.legitimacy.toLowerCase()}`}>
                                                {formattedData.spamAssassinResults.spamScore}
                                            </span>
                                        </div>
                                        <div className="scan-data-modal-summary-item">
                                            <span className="scan-data-modal-label">Legitimacy:</span>
                                            <span className={`scan-data-modal-value ${formattedData.summary.legitimacy.toLowerCase()}`}>
                                                {formattedData.summary.legitimacy}
                                            </span>
                                        </div>
                                        <div className="scan-data-modal-summary-item">
                                            <span className="scan-data-modal-label">Microsoft SCL:</span>
                                            <span className={`scan-data-modal-value ${parseInt(formattedData.spamAssassinResults.msExchangeSCL) >= 5 ? 'phishing' : 'legitimate'}`}>
                                                {formattedData.spamAssassinResults.msExchangeSCL}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="scan-data-modal-details">
                                    <h3>Email Details</h3>
                                    <div className="scan-data-modal-details-grid">
                                        <div className="scan-data-modal-details-item">
                                            <span className="scan-data-modal-label">Subject:</span>
                                            <span className="scan-data-modal-value">{formattedData.emailDetails.subject}</span>
                                        </div>
                                        <div className="scan-data-modal-details-item">
                                            <span className="scan-data-modal-label">From:</span>
                                            <span className="scan-data-modal-value">{formattedData.emailDetails.from}</span>
                                        </div>
                                        <div className="scan-data-modal-details-item">
                                            <span className="scan-data-modal-label">To:</span>
                                            <span className="scan-data-modal-value">{formattedData.emailDetails.to}</span>
                                        </div>
                                        <div className="scan-data-modal-details-item">
                                            <span className="scan-data-modal-label">Date:</span>
                                            <span className="scan-data-modal-value">{formattedData.emailDetails.date}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="scan-data-modal-results">
                                    <h3>SpamAssassin Analysis</h3>
                                    <div className="scan-data-modal-results-grid">
                                        <div className="scan-data-modal-results-section">
                                            <h4>Spam Status</h4>
                                            <div className="scan-data-modal-status-grid">
                                                <div className="scan-data-modal-status-item scan-data-modal-full-width">
                                                    <span className="scan-data-modal-label">X-Spam-Status:</span>
                                                    <span className="scan-data-modal-value">{formattedData.spamAssassinResults.spamStatus}</span>
                                                </div>
                                                <div className="scan-data-modal-status-item">
                                                    <span className="scan-data-modal-label">X-Spam-Level:</span>
                                                    <span className="scan-data-modal-value">{formattedData.spamAssassinResults.spamLevel}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {formattedData.spamAssassinResults.tests.length > 0 && (
                                            <div className="scan-data-modal-results-section">
                                                <h4>Tests Performed</h4>
                                                <div className="scan-data-modal-tests-list">
                                                    {formattedData.spamAssassinResults.tests.map((test, index) => (
                                                        <div key={index} className="scan-data-modal-test-item">
                                                            <span className="scan-data-modal-test-name">{test}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="scan-data-modal-results-section">
                                            <h4>Authentication Results</h4>
                                            <div className="scan-data-modal-auth-grid">
                                                <div className="scan-data-modal-auth-item scan-data-modal-full-width">
                                                    <span className="scan-data-modal-label">Authentication-Results:</span>
                                                    <span className="scan-data-modal-value">{formattedData.spamAssassinResults.authentication.results}</span>
                                                </div>
                                                <div className="scan-data-modal-auth-item">
                                                    <span className="scan-data-modal-label">Received-SPF:</span>
                                                    <span className="scan-data-modal-value">{formattedData.spamAssassinResults.authentication.spf}</span>
                                                </div>
                                                <div className="scan-data-modal-auth-item">
                                                    <span className="scan-data-modal-label">DKIM:</span>
                                                    <span className="scan-data-modal-value">{formattedData.spamAssassinResults.authentication.dkim}</span>
                                                </div>
                                                <div className="scan-data-modal-auth-item">
                                                    <span className="scan-data-modal-label">DMARC:</span>
                                                    <span className="scan-data-modal-value">{formattedData.spamAssassinResults.authentication.dmarc}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="scan-data-modal-results-section">
                                            <h4>Additional Headers</h4>
                                            <div className="scan-data-modal-headers-grid">
                                                <div className="scan-data-modal-header-item">
                                                    <span className="scan-data-modal-label">Return-Path:</span>
                                                    <span className="scan-data-modal-value">{formattedData.headers.returnPath}</span>
                                                </div>
                                                <div className="scan-data-modal-header-item">
                                                    <span className="scan-data-modal-label">X-Sender-IP:</span>
                                                    <span className="scan-data-modal-value">{formattedData.headers.senderIP}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="scan-data-modal-raw">
                                    <h3>Raw Data</h3>
                                    <pre className="scan-data-modal-raw-content">{formattedData.raw}</pre>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    } catch (error) {
        console.error('Error rendering ScanDataModal:', error);
        return (
            <div className="scan-data-modal-overlay" onClick={onClose}>
                <div className="scan-data-modal-container" onClick={e => e.stopPropagation()}>
                    <div className="scan-data-modal-header">
                        <h2>Error Displaying Scan Data</h2>
                        <button
                            className="scan-data-modal-close-button"
                            onClick={onClose}
                            title="Close"
                        >
                            <FaTimes />
                        </button>
                    </div>
                    <div className="scan-data-modal-content">
                        <p className="scan-data-modal-error-message">
                            There was an error displaying the scan data. Please try again or contact support if the issue persists.
                        </p>
                        <pre className="scan-data-modal-error-details">
                            {error.message}
                        </pre>
                    </div>
                </div>
            </div>
        );
    }
};

export default ScanDataModal; 