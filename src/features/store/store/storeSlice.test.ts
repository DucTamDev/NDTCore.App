import reducer, {
  storesLoadStarted,
  storesLoaded,
  storesLoadFailed,
  storeSelected,
  storeCleared,
  selectCurrentStoreId,
  selectAvailableStores,
  selectStoresLoading,
  selectStoresError,
} from './storeSlice';
import type { StoreViewModel } from '../types/store.types';

const sampleStore: StoreViewModel = {
  id: 1,
  name: 'Chi nhánh Quận 1',
  code: 'CN01',
  logoUrl: null,
  isActive: true,
  isAcceptingOrders: true,
  address: null,
  district: null,
  province: null,
};

describe('storeSlice', () => {
  const initialState = reducer(undefined, { type: '@@INIT' });

  it('storesLoadStarted sets isLoading and clears error', () => {
    const state = reducer({ ...initialState, error: 'previous error' }, storesLoadStarted());
    expect(state.isLoading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('storesLoaded stores the list and clears loading', () => {
    const state = reducer({ ...initialState, isLoading: true }, storesLoaded([sampleStore]));
    expect(state.availableStores).toEqual([sampleStore]);
    expect(state.isLoading).toBe(false);
  });

  it('storesLoadFailed stores the error message and clears loading', () => {
    const state = reducer({ ...initialState, isLoading: true }, storesLoadFailed('Không thể tải danh sách cửa hàng'));
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('Không thể tải danh sách cửa hàng');
  });

  it('storeSelected sets storeId', () => {
    const state = reducer(initialState, storeSelected(7));
    expect(state.storeId).toBe(7);
  });

  it('storeCleared resets storeId and availableStores', () => {
    const state = reducer({ ...initialState, storeId: 7, availableStores: [sampleStore] }, storeCleared());
    expect(state.storeId).toBeNull();
    expect(state.availableStores).toEqual([]);
  });

  it('selectors read the currentStore slice from RootState-shaped object', () => {
    const rootState = {
      currentStore: { storeId: 7, availableStores: [sampleStore], isLoading: false, error: 'x' },
    };
    expect(selectCurrentStoreId(rootState)).toBe(7);
    expect(selectAvailableStores(rootState)).toEqual([sampleStore]);
    expect(selectStoresLoading(rootState)).toBe(false);
    expect(selectStoresError(rootState)).toBe('x');
  });
});
