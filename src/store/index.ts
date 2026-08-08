import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/store/authSlice';
import currentStoreReducer from '../features/store/store/storeSlice';
import printerReducer from '../features/printer/store/printerSlice';
import settingsReducer from '../features/settings/store/settingsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    currentStore: currentStoreReducer,
    printer: printerReducer,
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
