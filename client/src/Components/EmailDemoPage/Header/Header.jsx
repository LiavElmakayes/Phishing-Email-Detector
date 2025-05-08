import React from 'react';
import { Menu, Search, Settings, Bell, Grid } from "lucide-react";
import './Header.css';

const Header = () => {
    return (
        <header className="header">
            <button className="menu-button">
                <Menu className="menu-icon" />
            </button>

            {/* Search Bar */}
            <div className="search-container">
                <div className="search-input-container">
                    <div className="search-icon-container">
                        <Search className="search-icon" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search mail"
                        className="search-input"
                    />
                </div>
            </div>

            {/* Right Icons */}
            <div className="controls">
                <button className="control-button">
                    <Settings className="control-icon" />
                </button>
                <button className="control-button">
                    <Bell className="control-icon" />
                </button>
                <button className="control-button">
                    <Grid className="control-icon" />
                </button>
                <button className="user-avatar">
                    U
                </button>
            </div>
        </header>
    );
};

export default Header; 