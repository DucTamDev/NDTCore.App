// src/features/catalog/hooks/useCatalog.ts
import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { CatalogService } from '../services/CatalogService';
import { selectCurrentStoreId } from '../../store/store/storeSlice';
import {
  catalogLoadStarted,
  catalogLoaded,
  catalogLoadFailed,
  selectCategories,
  selectProducts,
  selectCatalogLoading,
  selectCatalogError,
} from '../store/catalogSlice';

export const useCatalog = () => {
  const dispatch = useDispatch<AppDispatch>();
  const storeId = useSelector((state: RootState) => selectCurrentStoreId(state));
  const categories = useSelector((state: RootState) => selectCategories(state));
  const products = useSelector((state: RootState) => selectProducts(state));
  const isLoading = useSelector((state: RootState) => selectCatalogLoading(state));
  const error = useSelector((state: RootState) => selectCatalogError(state));
  const cancelledRef = useRef(false);

  const fetchCatalog = useCallback(async (): Promise<void> => {
    if (storeId === null) return;

    dispatch(catalogLoadStarted());
    try {
      const result = await CatalogService.fetchCatalog(storeId);
      if (cancelledRef.current) return;
      dispatch(catalogLoaded(result));
    } catch (err) {
      if (cancelledRef.current) return;
      dispatch(catalogLoadFailed(err instanceof Error ? err.message : 'Không thể tải danh sách sản phẩm'));
    }
  }, [dispatch, storeId]);

  useEffect(() => {
    cancelledRef.current = false;
    fetchCatalog();

    return () => {
      cancelledRef.current = true;
    };
  }, [fetchCatalog]);

  return { categories, products, isLoading, error, retry: fetchCatalog };
};
