import React from 'react'; // Importing React library
import './Auth.css'; // Importing CSS for styling
import { VscEditSession } from "react-icons/vsc"; // Importing icon for session
import { useState } from "react"; // Importing useState hook to manage state
import { useDispatch, useSelector } from 'react-redux';
import { auth } from '../../firebase';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile
} from 'firebase/auth';
import { setLoading, setError, setUser, clearError } from '../../store/AuthReducer';

const Auth = () => {
    const [isSignUp, setIsSignUp] = useState(true); // State to toggle between signup and login forms
    const dispatch = useDispatch();
    const loading = useSelector((state) => state.AuthReducer.loading);
    const error = useSelector((state) => state.AuthReducer.error);
    const [data, setData] = useState({
        email: "",
        password: "",
        confirmPassword: "",
        displayName: ""
    }); // State to hold form data

    const [confirmpassword, setConfirmPassword] = useState(true); // State to handle password confirmation check

    // Function to handle form field changes
    const handleChange = (e) => {
        setData({ ...data, [e.target.name]: e.target.value }); // Updating the respective field
        dispatch(clearError());
    };

    // Function to handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault(); // Preventing default form submission
        dispatch(clearError());
        dispatch(setLoading(true));

        try {
            if (isSignUp) {
                if (data.password !== data.confirmPassword) {
                    setConfirmPassword(false);
                    dispatch(setLoading(false));
                    return;
                }

                // Create user with email and password
                const userCredential = await createUserWithEmailAndPassword(
                    auth,
                    data.email,
                    data.password
                );

                // Update profile with display name
                await updateProfile(userCredential.user, {
                    displayName: data.displayName
                });

                // Only pass serializable user data
                const userData = {
                    uid: userCredential.user.uid,
                    email: userCredential.user.email,
                    displayName: userCredential.user.displayName,
                    photoURL: userCredential.user.photoURL,
                    emailVerified: userCredential.user.emailVerified
                };
                dispatch(setUser(userData));

            } else {
                // Sign in with email and password
                const userCredential = await signInWithEmailAndPassword(
                    auth,
                    data.email,
                    data.password
                );
                // Only pass serializable user data
                const userData = {
                    uid: userCredential.user.uid,
                    email: userCredential.user.email,
                    displayName: userCredential.user.displayName,
                    photoURL: userCredential.user.photoURL,
                    emailVerified: userCredential.user.emailVerified
                };
                dispatch(setUser(userData));
            }
        } catch (error) {
            dispatch(setError(getErrorMessage(error.code)));
        } finally {
            dispatch(setLoading(false));
        }
    };

    const getErrorMessage = (errorCode) => {
        switch (errorCode) {
            case 'auth/email-already-in-use':
                return 'This email is already registered';
            case 'auth/invalid-email':
                return 'Invalid email address';
            case 'auth/operation-not-allowed':
                return 'Email/password accounts are not enabled';
            case 'auth/weak-password':
                return 'Password should be at least 6 characters';
            case 'auth/user-disabled':
                return 'This account has been disabled';
            case 'auth/user-not-found':
                return 'No account found with this email';
            case 'auth/wrong-password':
                return 'Incorrect password';
            default:
                return 'An error occurred. Please try again';
        }
    };

    // Function to reset the form fields
    const resetForm = () => {
        setData({
            email: "",
            password: "",
            confirmPassword: "",
            displayName: ""
        });
        setConfirmPassword(true); // Reset password confirmation state
        dispatch(clearError());
    };

    return (
        <div className="Auth">
            {/* Left side of the Auth component */}
            <div className="a-left">
                <div className="VscEditSession">
                    <VscEditSession size={90} /> {/* Session icon */}
                </div>
                <div className="Webname">
                    <h1>Phishing Email Detector</h1> {/* Webname */}
                    <h6>Secure your inbox from phishing threats</h6> {/* Web description */}
                </div>
            </div>

            {/* Right side of the Auth component */}
            <div className="a-right">
                <form className="InfoForm AuthForm" onSubmit={handleSubmit}> {/* Form for login/signup */}
                    <h3>{isSignUp ? "Sign Up" : "Log In"}</h3> {/* Dynamic heading based on signup/login */}

                    {isSignUp && (
                        <div>
                            {/* Fields for signup form */}
                            <input
                                type="text"
                                placeholder='Display Name'
                                className='InfoInput'
                                name='displayName'
                                onChange={handleChange}
                                value={data.displayName}
                                required
                            />
                        </div>
                    )}

                    {/* Common fields for both signup and login */}
                    <div>
                        <input
                            type="email"
                            placeholder='Email'
                            className="InfoInput"
                            name='email'
                            onChange={handleChange}
                            value={data.email}
                            required
                            autoComplete="username"
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            placeholder='Password'
                            className="InfoInput"
                            name='password'
                            onChange={handleChange}
                            value={data.password}
                            required
                            autoComplete={isSignUp ? "new-password" : "current-password"}
                        />

                        {/* Password confirmation field for signup */}
                        {isSignUp && (
                            <input
                                type="password"
                                placeholder='Confirm Password'
                                className="InfoInput"
                                name='confirmPassword'
                                onChange={handleChange}
                                value={data.confirmPassword}
                                required
                                autoComplete="new-password"
                            />
                        )}
                    </div>

                    {error && (
                        <span style={{
                            color: 'red',
                            fontSize: '12px',
                            alignSelf: "flex-end",
                            marginRight: '5px'
                        }}>
                            {error}
                        </span>
                    )}

                    {/* Show error message if passwords don't match */}
                    <span style={{
                        display: confirmpassword ? "none" : "block",
                        color: 'red',
                        fontSize: '12px',
                        alignSelf: "flex-end",
                        marginRight: '5px'
                    }}>
                        * Passwords do not match
                    </span>

                    {/* Toggle between SignUp and LogIn */}
                    <div>
                        <span
                            onClick={() => { setIsSignUp((prev) => !prev); resetForm(); }} // Switch between forms
                            className='pointer'>
                            {isSignUp ? "Already have an account? Login!" : "Don't have an account? Sign Up!"}
                        </span>
                    </div>

                    {/* Submit button */}
                    <button className="button InfoButton" type="submit" disabled={loading}>
                        {loading ? "Loading..." : isSignUp ? "SignUp" : "LogIn"}</button>
                </form>
            </div>
        </div>
    );
};

export default Auth;
