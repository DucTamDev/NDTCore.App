import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { loggedOut } from '../../auth/store/authSlice';
import { storeCleared } from '../../store/store/storeSlice';
import { CartService } from '../services/CartService';
import type { CartItem, ServiceType } from '../types/cart.types';

interface CartSliceState {
  items: CartItem[];
  serviceType: ServiceType;
  note: string;
}

const initialState: CartSliceState = {
  items: [],
  serviceType: 'TakeAway',
  note: '',
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    itemAdded(state, action: PayloadAction<CartItem>) {
      const existing = state.items.find((item) => item.key === action.payload.key);
      if (existing) {
        existing.quantity += action.payload.quantity;
      } else {
        state.items.push(action.payload);
      }
    },
    itemQuantityChanged(state, action: PayloadAction<{ key: string; quantity: number }>) {
      if (action.payload.quantity <= 0) {
        state.items = state.items.filter((item) => item.key !== action.payload.key);
        return;
      }
      const existing = state.items.find((item) => item.key === action.payload.key);
      if (existing) {
        existing.quantity = action.payload.quantity;
      }
    },
    itemRemoved(state, action: PayloadAction<{ key: string }>) {
      state.items = state.items.filter((item) => item.key !== action.payload.key);
    },
    serviceTypeChanged(state, action: PayloadAction<ServiceType>) {
      state.serviceType = action.payload;
    },
    noteChanged(state, action: PayloadAction<string>) {
      state.note = action.payload;
    },
    cartCleared(state) {
      state.items = [];
      state.note = '';
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loggedOut, () => initialState);
    builder.addCase(storeCleared, () => initialState);
  },
});

export const { itemAdded, itemQuantityChanged, itemRemoved, serviceTypeChanged, noteChanged, cartCleared } =
  cartSlice.actions;

interface StateWithCart {
  cart: CartSliceState;
}

export const selectCartItems = (state: StateWithCart): CartItem[] => state.cart.items;
export const selectServiceType = (state: StateWithCart): ServiceType => state.cart.serviceType;
export const selectCartNote = (state: StateWithCart): string => state.cart.note;
export const selectCartItemCount = (state: StateWithCart): number =>
  CartService.calculateCartItemCount(state.cart.items);
export const selectCartTotal = (state: StateWithCart): number => CartService.calculateCartTotal(state.cart.items);

export default cartSlice.reducer;
