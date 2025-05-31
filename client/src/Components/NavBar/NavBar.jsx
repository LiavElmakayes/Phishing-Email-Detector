import React from 'react'
import './NavBar.css'
import { MdOutlineSecurity } from "react-icons/md";
import { Link } from 'react-router-dom';
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
            <div className="navbar-left">
                <MdOutlineSecurity
                    size={30}
                    className="navbar-icon"
                />
                <Link to="/" className="navbar-title">Phishing Email Detector</Link>
            </div>
            <div className="navbar-right">
                {/* Show these links only when logged in */}
                {user && (
                    <>
                        <Link to="/" className="nav-link">Upload Email</Link>
                        <Link to="/demo" className="nav-link">Email Demo</Link>
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