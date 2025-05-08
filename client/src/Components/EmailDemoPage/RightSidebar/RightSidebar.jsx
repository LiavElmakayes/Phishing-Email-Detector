import React from 'react';
import { Calendar, CheckSquare, Users, Layers } from "lucide-react";
import './RightSidebar.css';

const RightSidebar = () => {
    return (
        <div className="right-sidebar">
            <div className="sidebar-buttons">
                <button className="sidebar-button calendar-button" onClick={() => { }}>
                    <Calendar className="sidebar-icon" />
                </button>
                <button className="sidebar-button tasks-button" onClick={() => { }}>
                    <CheckSquare className="sidebar-icon" />
                </button>
                <button className="sidebar-button contacts-button" onClick={() => { }}>
                    <Users className="sidebar-icon" />
                </button>
                <button className="sidebar-button keep-button" onClick={() => { }}>
                    <Layers className="sidebar-icon" />
                </button>
            </div>
        </div>
    );
};

export default RightSidebar; 