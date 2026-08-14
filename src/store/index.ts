import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/store/authSlice';
import cartReducer from '../features/cart/store/cartSlice';
import catalogReducer from '../features/catalog/store/catalogSlice';
import currentStoreReducer from '../features/store/store/storeSlice';
import destinationReducer from '../features/printer/store/destinationSlice';
import printerReducer from '../features/printer/store/printerSlice';
import settingsReducer from '../features/settings/store/settingsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    catalog: catalogReducer,
    currentStore: currentStoreReducer,
    destination: destinationReducer,
    printer: printerReducer,
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
