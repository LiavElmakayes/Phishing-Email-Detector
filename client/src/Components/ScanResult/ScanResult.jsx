// ScanResult.jsx
import React from 'react';
import './ScanResult.css';
import { FaShieldAlt, FaExclamationTriangle } from 'react-icons/fa';

const ScanResult = ({ result }) => {
    const percentage = result * 10;
    const isLegitimate = percentage < 50;

    const icon = isLegitimate
        ? <FaShieldAlt size={36} className="legitimate-icon" />
        : <FaExclamationTriangle size={36} className="alert-icon" />;

    const getProgressBarColor = (percentage) => {
        let r, g, b;

        if (percentage <= 25) {
            // Deep green to mid green (pure green transition)
            const ratio = percentage / 25;
            r = Math.round(0 + (76 - 0) * ratio);     // 0 → 76
            g = Math.round(200 + (175 - 200) * ratio); // 200 → 175 (slightly richer green)
            b = Math.round(0 + (80 - 0) * ratio);     // 0 → 80
        } else if (percentage <= 50) {
            // Green to Orange transition
            const ratio = (percentage - 25) / 25;
            r = Math.round(76 + (255 - 76) * ratio);   // 76 → 255
            g = Math.round(175 + (152 - 175) * ratio); // 175 → 152
            b = Math.round(80 + (0 - 80) * ratio);     // 80 → 0
        } else {
            // Orange to Red transition
            const ratio = (percentage - 50) / 50;
            r = Math.round(255 + (244 - 255) * ratio); // 255 → 244
            g = Math.round(152 + (67 - 152) * ratio);  // 152 → 67
            b = Math.round(0 + (54 - 0) * ratio);      // 0 → 54
        }

        return `rgb(${r}, ${g}, ${b})`;
    };



    const progressBarColor = getProgressBarColor(percentage);

    return (
        <div className={`scan-result ${isLegitimate ? 'legitimate' : 'phishing'}`}>
            <div className="result-icon">{icon}</div>
            <div className="result-text">
                <span className="result-percentage">{percentage}%</span>
                <span>Phishing</span>
            </div>
            <div className="progress-bar">
                <div
                    className="progress-bar-fill"
                    style={{ width: `${percentage}%`, backgroundColor: progressBarColor }}
                ></div>
            </div>
            <div className="result-details">
                {isLegitimate ? (
                    <p>This email appears to be legitimate - No phishing indicators found.</p>
                ) : (
                    <p>This email has been flagged as potentially phishing - Proceed with caution.</p>
                )}
            </div>
        </div>
    );
};

export default ScanResult;
