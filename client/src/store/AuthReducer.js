import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    loading: false,
    error: null,
    user: null
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setLoading: (state, action) => {
            state.loading = action.payload;
        },
        setError: (state, action) => {
            state.error = action.payload;
        },
        setUser: (state, action) => {
            // Only store essential user data
            if (action.payload) {
                state.user = {
                    uid: action.payload.uid,
                    email: action.payload.email,
                    displayName: action.payload.displayName,
                    photoURL: action.payload.photoURL,
                    emailVerified: action.payload.emailVerified
                };
            } else {
                state.user = null;
            }
        },
        clearError: (state) => {
            state.error = null;
        }
    }
});

export const { setLoading, setError, setUser, clearError } = authSlice.actions;
export default authSlice.reducer; 