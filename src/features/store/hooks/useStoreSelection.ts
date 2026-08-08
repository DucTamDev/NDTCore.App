// src/features/store/hooks/useStoreSelection.ts
import { useEffect } from 'react';
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

  useEffect(() => {
    let cancelled = false;

    const fetchStores = async (): Promise<void> => {
      dispatch(storesLoadStarted());
      try {
        const result = await StoreService.fetchStores();
        if (cancelled) return;
        dispatch(storesLoaded(result));
        if (result.length === 1) {
          StoreService.saveStoreId(result[0].id);
          dispatch(storeSelected(result[0].id));
        }
      } catch (err) {
        if (cancelled) return;
        dispatch(storesLoadFailed(err instanceof Error ? err.message : 'Không thể tải danh sách cửa hàng'));
      }
    };

    fetchStores();

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const selectStore = (storeId: number): void => {
    StoreService.saveStoreId(storeId);
    dispatch(storeSelected(storeId));
  };

  return { stores, isLoading, error, selectStore };
};
