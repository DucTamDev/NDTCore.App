import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
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

// Không cần reset khi đăng xuất/đổi cửa hàng: catalog không đọc lại state cũ lúc
// khởi động (khác storeId) — mỗi lần ProductArea mount đều fetch mới và ghi đè
// toàn bộ qua catalogLoaded trước khi render, nên state cũ không có hệ quả.
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
