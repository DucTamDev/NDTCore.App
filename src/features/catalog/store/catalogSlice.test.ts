import reducer, {
  catalogLoadStarted,
  catalogLoaded,
  catalogLoadFailed,
  selectCategories,
  selectProducts,
  selectCatalogLoading,
  selectCatalogError,
} from './catalogSlice';
import { loggedOut } from '../../auth/store/authSlice';
import { storeCleared } from '../../store/store/storeSlice';
import type { CategoryViewModel, ProductViewModel } from '../types/catalog.types';

const sampleCategory: CategoryViewModel = { id: 1, parentId: null, name: 'Trà sữa', productCount: 1, children: [] };
const sampleProduct: ProductViewModel = {
  id: 10,
  categoryId: 1,
  name: 'Trà sữa Olong',
  price: 45000,
  imageUrl: null,
  isAvailable: true,
  sku: 'TS001',
  badgeLabel: null,
  badgeColorHex: null,
  badgeTextColorHex: null,
  optionGroups: [],
};

describe('catalogSlice', () => {
  const initialState = reducer(undefined, { type: '@@INIT' });

  it('catalogLoadStarted sets isLoading and clears error', () => {
    const state = reducer({ ...initialState, error: 'previous error' }, catalogLoadStarted());
    expect(state.isLoading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('catalogLoaded stores categories and products and clears loading', () => {
    const state = reducer(
      { ...initialState, isLoading: true },
      catalogLoaded({ categories: [sampleCategory], products: [sampleProduct] }),
    );
    expect(state.categories).toEqual([sampleCategory]);
    expect(state.products).toEqual([sampleProduct]);
    expect(state.isLoading).toBe(false);
  });

  it('catalogLoadFailed stores the error message and clears loading', () => {
    const state = reducer(
      { ...initialState, isLoading: true },
      catalogLoadFailed('Không thể tải danh sách sản phẩm'),
    );
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('Không thể tải danh sách sản phẩm');
  });

  it('loggedOut resets categories, products, isLoading, and error to initial state', () => {
    const loadedState = reducer(
      initialState,
      catalogLoaded({ categories: [sampleCategory], products: [sampleProduct] }),
    );
    const state = reducer(loadedState, loggedOut());
    expect(state).toEqual(initialState);
  });

  it('storeCleared resets categories, products, isLoading, and error to initial state', () => {
    const loadedState = reducer(
      initialState,
      catalogLoaded({ categories: [sampleCategory], products: [sampleProduct] }),
    );
    const state = reducer(loadedState, storeCleared());
    expect(state).toEqual(initialState);
  });

  it('selectors read the catalog slice from RootState-shaped object', () => {
    const rootState = {
      catalog: { categories: [sampleCategory], products: [sampleProduct], isLoading: false, error: 'x' },
    };
    expect(selectCategories(rootState)).toEqual([sampleCategory]);
    expect(selectProducts(rootState)).toEqual([sampleProduct]);
    expect(selectCatalogLoading(rootState)).toBe(false);
    expect(selectCatalogError(rootState)).toBe('x');
  });
});
