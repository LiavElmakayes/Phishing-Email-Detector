import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
    apiKey: "AIzaSyAPexm4GqT40f5Rq_GqBw0R3o4yejW8-8M",
    authDomain: "phishing-email-detector-8d22f.firebaseapp.com",
    projectId: "phishing-email-detector-8d22f",
    storageBucket: "phishing-email-detector-8d22f.firebasestorage.app",
    messagingSenderId: "753698977653",
    appId: "1:753698977653:web:fa74116ae41571dec7053c",
    measurementId: "G-626QBY399K",
    databaseURL: "https://phishing-email-detector-8d22f-default-rtdb.europe-west1.firebasedatabase.app/"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
export default app; 