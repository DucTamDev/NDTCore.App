import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { AuthService } from '../services/AuthService';

interface AuthState {
  isLoggedIn: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  isLoggedIn: AuthService.getStoredToken() !== null,
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStarted(state) {
      state.isLoading = true;
      state.error = null;
    },
    loginSucceeded(state) {
      state.isLoggedIn = true;
      state.isLoading = false;
      state.error = null;
    },
    loginFailed(state, action: PayloadAction<string>) {
      state.isLoggedIn = false;
      state.isLoading = false;
      state.error = action.payload;
    },
    loggedOut(state) {
      state.isLoggedIn = false;
      state.isLoading = false;
      state.error = null;
    },
  },
});

export const { loginStarted, loginSucceeded, loginFailed, loggedOut } = authSlice.actions;

interface StateWithAuth {
  auth: AuthState;
}

export const selectIsLoggedIn = (state: StateWithAuth): boolean => state.auth.isLoggedIn;
export const selectAuthLoading = (state: StateWithAuth): boolean => state.auth.isLoading;
export const selectAuthError = (state: StateWithAuth): string | null => state.auth.error;

export default authSlice.reducer;
