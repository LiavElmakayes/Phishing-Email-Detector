import React from 'react';
import { Inbox, Tag, Users, Bell } from "lucide-react";
import './Tabs.css';

const Tabs = ({ selectedTab, setSelectedTab }) => {
    return (
        <div className="tabs-container">
            <button
                className={`tab-button ${selectedTab === 'primary' ? 'active' : ''}`}
                onClick={() => setSelectedTab('primary')}
            >
                <span className="tab-content">
                    <Inbox className="tab-icon" />
                    Primary
                </span>
            </button>

            <button
                className={`tab-button ${selectedTab === 'promotions' ? 'active' : ''}`}
                onClick={() => { }}
            >
                <span className="tab-content">
                    <Tag className="tab-icon" />
                    Promotions
                    <span className="badge secondary">60 new</span>
                </span>
            </button>

            <button
                className={`tab-button ${selectedTab === 'social' ? 'active' : ''}`}
                onClick={() => { }}
            >
                <span className="tab-content">
                    <Users className="tab-icon" />
                    Social
                    <span className="badge primary">18 new</span>
                </span>
            </button>

            <button
                className={`tab-button ${selectedTab === 'updates' ? 'active' : ''}`}
                onClick={() => { }}
            >
                <span className="tab-content">
                    <Bell className="tab-icon" />
                    Updates
                    <span className="badge tertiary">45 new</span>
                </span>
            </button>
        </div>
    );
};

export default Tabs; 