import React from 'react';
import { ChevronDown, RefreshCw, MoreHorizontal } from "lucide-react";
import './Toolbar.css';

const Toolbar = () => {
    return (
        <div className="toolbar">
            <div className="checkbox-container">
                <input type="checkbox" className="checkbox" />
                <button className="dropdown-button">
                    <ChevronDown className="dropdown-icon" />
                </button>
            </div>

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