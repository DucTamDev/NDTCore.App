import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/store/authSlice';
import printerReducer from '../features/printer/store/printerSlice';
import settingsReducer from '../features/settings/store/settingsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    printer: printerReducer,
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
