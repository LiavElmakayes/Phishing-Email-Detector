import React from 'react'
import './NavBar.css'
import { MdOutlineSecurity } from "react-icons/md";
import { Link } from 'react-router-dom';

const NavBar = () => {
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
                <Link to="/" className="nav-link">Upload Email</Link>
                <Link to="/demo" className="nav-link">Email Demo</Link>
            </div>
        </div>
    )
}

export default NavBar