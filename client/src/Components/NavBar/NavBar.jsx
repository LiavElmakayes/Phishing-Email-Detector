import React from 'react'
import './NavBar.css'
import { MdOutlineSecurity } from "react-icons/md";
import { FaComments } from "react-icons/fa";
import { Link, NavLink } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useSelector } from 'react-redux';

const NavBar = () => {
    const user = useSelector((state) => state.AuthReducer.user);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            // Redux state will be updated by onAuthStateChanged listener in App.js
            // which will trigger the navigation via protected routes
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    return (
        <div className="NavBar">
            <Link to="/" className="navbar-left">
                <div className="icon-wrapper">
                    <MdOutlineSecurity
                        size={24}
                        className="navbar-icon"
                    />
                </div>
                <span className="navbar-title">Phishing Email Detector</span>
            </Link>
            <div className="navbar-right">
                {/* Show these links only when logged in */}
                {user && (
                    <>
                        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            Upload Email
                        </NavLink>
                        <NavLink to="/history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            Scan History
                        </NavLink>
                        <NavLink to="/chat-history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <FaComments className="nav-icon" /> Chat History
                        </NavLink>
                        <NavLink to="/demo" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            Email Demo
                        </NavLink>
                        {/* Logout Button */}
                        <button onClick={handleLogout} className="nav-link logout-button">
                            Logout
                        </button>
                    </>
                )}
                {/* Show Auth link only when logged out */}
                {!user && (
                    <Link to="/auth" className="nav-link">Login / Sign Up</Link>
                )}
            </div>
        </div>
    )
}

export default NavBar