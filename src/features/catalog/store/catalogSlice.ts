import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { loggedOut } from '../../auth/store/authSlice';
import { storeCleared } from '../../store/store/storeSlice';
import type { CategoryViewModel, ProductViewModel } from '../types/catalog.types';

interface CatalogSliceState {
  categories: CategoryViewModel[];
  products: ProductViewModel[];
  isLoading: boolean;
  error: string | null;
}

const initialState: CatalogSliceState = {
  categories: [],
  products: [],
  isLoading: false,
  error: null,
};

const catalogSlice = createSlice({
  name: 'catalog',
  initialState,
  reducers: {
    catalogLoadStarted(state) {
      state.isLoading = true;
      state.error = null;
    },
    catalogLoaded(state, action: PayloadAction<{ categories: CategoryViewModel[]; products: ProductViewModel[] }>) {
      state.categories = action.payload.categories;
      state.products = action.payload.products;
      state.isLoading = false;
    },
    catalogLoadFailed(state, action: PayloadAction<string>) {
      state.isLoading = false;
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    // useCatalog's fetch effect runs after mount commit, not before — ProductArea's
    // first render after a store change/logout would otherwise show a stale frame
    // of the previous store's catalog (or its stale error state) until the effect's
    // dispatch lands. Reset on both action types that lead to a fresh store context.
    builder.addCase(loggedOut, () => initialState);
    builder.addCase(storeCleared, () => initialState);
  },
});

export const { catalogLoadStarted, catalogLoaded, catalogLoadFailed } = catalogSlice.actions;

interface StateWithCatalog {
  catalog: CatalogSliceState;
}

export const selectCategories = (state: StateWithCatalog): CategoryViewModel[] => state.catalog.categories;
export const selectProducts = (state: StateWithCatalog): ProductViewModel[] => state.catalog.products;
export const selectCatalogLoading = (state: StateWithCatalog): boolean => state.catalog.isLoading;
export const selectCatalogError = (state: StateWithCatalog): string | null => state.catalog.error;

export default catalogSlice.reducer;
