import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/store/authSlice';
import cartReducer from '../features/cart/store/cartSlice';
import catalogReducer from '../features/catalog/store/catalogSlice';
import currentStoreReducer from '../features/store/store/storeSlice';
import applicationReducer from '../features/application/store/applicationSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    catalog: catalogReducer,
    currentStore: currentStoreReducer,
    application: applicationReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
