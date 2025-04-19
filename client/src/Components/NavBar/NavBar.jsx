import React from 'react'
import './NavBar.css'
import { MdOutlineSecurity } from "react-icons/md";

const NavBar = () => {
    return (
        <div className="NavBar">
            <MdOutlineSecurity
                size={30}
                className="navbar-icon"
            />
            Phishing Email Detector
        </div>
    )
}

export default NavBar