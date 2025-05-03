import React from 'react';
import { Calendar, CheckSquare, Users, Layers } from "lucide-react";
import './RightSidebar.css';

const RightSidebar = () => {
    return (
        <div className="right-sidebar">
            <div className="sidebar-buttons">
                <button className="sidebar-button">
                    <Calendar className="sidebar-icon" />
                </button>
                <button className="sidebar-button">
                    <CheckSquare className="sidebar-icon" />
                </button>
                <button className="sidebar-button">
                    <Users className="sidebar-icon" />
                </button>
                <button className="sidebar-button">
                    <Layers className="sidebar-icon" />
                </button>
            </div>
        </div>
    );
};

export default RightSidebar; 