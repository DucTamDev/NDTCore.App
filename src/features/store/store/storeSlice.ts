import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { StoreService } from '../services/StoreService';
import { loggedOut } from '../../auth/store/authSlice';
import type { StoreViewModel } from '../types/store.types';

interface StoreSliceState {
  storeId: number | null;
  availableStores: StoreViewModel[];
  isLoading: boolean;
  error: string | null;
}

const initialState: StoreSliceState = {
  storeId: StoreService.getStoredStoreId(),
  availableStores: [],
  isLoading: false,
  error: null,
};

const storeSlice = createSlice({
  name: 'currentStore',
  initialState,
  reducers: {
    storesLoadStarted(state) {
      state.isLoading = true;
      state.error = null;
    },
    storesLoaded(state, action: PayloadAction<StoreViewModel[]>) {
      state.availableStores = action.payload;
      state.isLoading = false;
    },
    storesLoadFailed(state, action: PayloadAction<string>) {
      state.isLoading = false;
      state.error = action.payload;
    },
    storeSelected(state, action: PayloadAction<number>) {
      state.storeId = action.payload;
    },
    storeCleared(state) {
      state.storeId = null;
      state.availableStores = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loggedOut, (state) => {
      state.storeId = null;
      state.availableStores = [];
      state.error = null;
    });
  },
});

export const { storesLoadStarted, storesLoaded, storesLoadFailed, storeSelected, storeCleared } =
  storeSlice.actions;

interface StateWithCurrentStore {
  currentStore: StoreSliceState;
}

export const selectCurrentStoreId = (state: StateWithCurrentStore): number | null => state.currentStore.storeId;
export const selectAvailableStores = (state: StateWithCurrentStore): StoreViewModel[] =>
  state.currentStore.availableStores;
export const selectCurrentStore = (state: StateWithCurrentStore): StoreViewModel | null =>
  state.currentStore.availableStores.find((s) => s.id === state.currentStore.storeId) ?? null;
export const selectStoresLoading = (state: StateWithCurrentStore): boolean => state.currentStore.isLoading;
export const selectStoresError = (state: StateWithCurrentStore): string | null => state.currentStore.error;

export default storeSlice.reducer;
