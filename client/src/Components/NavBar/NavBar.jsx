import React, { useState, useEffect, useRef } from 'react'
import './NavBar.css'
import { MdOutlineSecurity } from "react-icons/md";
import { FaComments } from "react-icons/fa";
import { HiMenuAlt3 } from "react-icons/hi";
import { IoClose } from "react-icons/io5";
import { Link, NavLink } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useSelector } from 'react-redux';

const NavBar = () => {
    const user = useSelector((state) => state.AuthReducer.user);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setIsMenuOpen(false);
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const closeMenu = () => {
        setIsMenuOpen(false);
    };

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                closeMenu();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Prevent body scroll when menu is open
    useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isMenuOpen]);

    const NavLinks = () => (
        <>
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                Upload Email
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                Scan History
            </NavLink>
            <NavLink to="/chat-history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                <FaComments className="nav-icon" /> Chat History
            </NavLink>
            <NavLink to="/demo" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                Email Demo
            </NavLink>
            <button onClick={handleLogout} className="nav-link logout-button">
                Logout
            </button>
        </>
    );

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

            {/* Desktop Navigation */}
            <div className="navbar-right desktop-nav">
                {user ? <NavLinks /> : (
                    <Link to="/auth" className="nav-link">Login / Sign Up</Link>
                )}
            </div>

            {/* Mobile Navigation */}
            {user && (
                <div className="mobile-nav" ref={menuRef}>
                    <button
                        className="hamburger-button"
                        onClick={toggleMenu}
                        aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                        aria-expanded={isMenuOpen}
                    >
                        {isMenuOpen ? <IoClose size={24} /> : <HiMenuAlt3 size={24} />}
                    </button>

                    <div className={`mobile-menu ${isMenuOpen ? 'open' : ''}`}>
                        <div className="mobile-menu-content">
                            <NavLinks />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default NavBar