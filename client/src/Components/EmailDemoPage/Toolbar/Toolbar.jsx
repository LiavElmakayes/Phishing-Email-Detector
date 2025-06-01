import React, { useState } from 'react';
import { ChevronDown, RefreshCw, MoreHorizontal } from "lucide-react";
import './Toolbar.css';

const Toolbar = () => {
    const [isChecked, setIsChecked] = useState(false);

    const handleCheckboxChange = () => {
        setIsChecked(!isChecked);
    };

    return (
        <div className="toolbar">
            <input
                type="checkbox"
                className="checkbox"
                checked={isChecked}
                onChange={handleCheckboxChange}
            />

            <button className="dropdown-button">
                <ChevronDown className="dropdown-icon" />
            </button>

            <button className="toolbar-button">
                <RefreshCw className="toolbar-icon" />
            </button>

            <button className="toolbar-button">
                <MoreHorizontal className="toolbar-icon" />
            </button>

            <div className="pagination">
                1-50 of 13,624
            </div>
        </div>
    );
};

export default Toolbar; 