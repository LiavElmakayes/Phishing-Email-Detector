import React from 'react';
import {
    Mail,
    Inbox,
    Star,
    Clock,
    AlertCircle,
    Send,
    File,
    ChevronDown,
    Tag
} from "lucide-react";
import './Sidebar.css';

const Sidebar = () => {
    return (
        <div className="sidebar">
            {/* Gmail Logo */}
            <div className="logo-container">
                <Mail className="logo-icon" />
                <span className="logo-text">Gmail</span>
            </div>

            {/* Compose Button */}
            <div className="compose-button">
                <button>
                    <span>Compose</span>
                </button>
            </div>

            {/* Navigation Menu */}
            <nav className="nav-menu">
                <ul>
                    <li className="nav-item">
                        <button className="nav-button">
                            <Inbox className="nav-icon" />
                            <span>Inbox</span>
                            <span className="badge">11,674</span>
                        </button>
                    </li>
                    <li className="nav-item">
                        <button className="nav-button">
                            <Star className="nav-icon" />
                            <span>Starred</span>
                        </button>
                    </li>
                    <li className="nav-item">
                        <button className="nav-button">
                            <Clock className="nav-icon" />
                            <span>Snoozed</span>
                        </button>
                    </li>
                    <li className="nav-item">
                        <button className="nav-button">
                            <AlertCircle className="nav-icon" />
                            <span>Important</span>
                        </button>
                    </li>
                    <li className="nav-item">
                        <button className="nav-button">
                            <Send className="nav-icon" />
                            <span>Sent</span>
                        </button>
                    </li>
                    <li className="nav-item">
                        <button className="nav-button">
                            <File className="nav-icon" />
                            <span>Drafts</span>
                            <span className="badge">30</span>
                        </button>
                    </li>
                    <li className="nav-item">
                        <button className="nav-button">
                            <Tag className="nav-icon" />
                            <span>Categories</span>
                        </button>
                    </li>
                    <li className="nav-item">
                        <button className="nav-button">
                            <ChevronDown className="nav-icon" />
                            <span>More</span>
                        </button>
                    </li>
                </ul>
            </nav>

            {/* Labels */}
            <div className="labels-section">
                <div className="labels-header">
                    <span className="labels-title">Labels</span>
                    <button className="add-label-button">
                        <span className="add-label-icon">+</span>
                    </button>
                </div>
                <ul>
                    <li className="label-item">
                        <span className="label-color"></span>
                        <span>Unwanted</span>
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default Sidebar; 