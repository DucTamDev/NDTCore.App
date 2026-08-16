import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { StoreService } from '../services/StoreService';
import {
  storesLoadStarted,
  storesLoaded,
  storesLoadFailed,
  storeSelected,
  selectAvailableStores,
  selectStoresLoading,
  selectStoresError,
} from '../store/storeSlice';

export const useStoreSelection = () => {
  const dispatch = useDispatch<AppDispatch>();
  const stores = useSelector((state: RootState) => selectAvailableStores(state));
  const isLoading = useSelector((state: RootState) => selectStoresLoading(state));
  const error = useSelector((state: RootState) => selectStoresError(state));
  const cancelledRef = useRef(false);

  const fetchStores = useCallback(async (): Promise<void> => {
    dispatch(storesLoadStarted());
    try {
      const result = await StoreService.fetchStores();
      if (cancelledRef.current) return;
      dispatch(storesLoaded(result));
      if (result.length === 1) {
        StoreService.saveStoreId(result[0].id);
        dispatch(storeSelected(result[0].id));
      }
    } catch (err) {
      if (cancelledRef.current) return;
      dispatch(storesLoadFailed(err instanceof Error ? err.message : 'Không thể tải danh sách cửa hàng'));
    }
  }, [dispatch]);

  useEffect(() => {
    cancelledRef.current = false;
    fetchStores();

    return () => {
      cancelledRef.current = true;
    };
  }, [fetchStores]);

  const selectStore = (storeId: number): void => {
    StoreService.saveStoreId(storeId);
    dispatch(storeSelected(storeId));
  };

  return { stores, isLoading, error, selectStore, retry: fetchStores };
};
