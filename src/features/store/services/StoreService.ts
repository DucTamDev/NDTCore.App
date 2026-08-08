import { storeApi } from '../api/storeApi';
import { StorageService } from '../../../services/StorageService';
import type { StoreDto, StoreViewModel } from '../types/store.types';

const CURRENT_STORE_ID_KEY = 'store.currentId';

const toViewModel = (dto: StoreDto): StoreViewModel => ({
  id: dto.Id,
  name: dto.Name,
  code: dto.Code,
  logoUrl: dto.LogoUrl ?? null,
  isActive: dto.IsActive,
  isAcceptingOrders: dto.IsAcceptingOrders,
  address: dto.Address ?? null,
  district: dto.District ?? null,
  province: dto.Province ?? null,
});

const fetchStores = async (): Promise<StoreViewModel[]> => {
  const response = await storeApi.getPagedAsync();

  if (!response.IsSuccess) {
    throw new Error(response.Error?.Message ?? 'Không thể tải danh sách cửa hàng');
  }

  return (response.Data ?? []).map(toViewModel);
};

const saveStoreId = (storeId: number): void => {
  StorageService.setItem(CURRENT_STORE_ID_KEY, storeId);
};

const getStoredStoreId = (): number | null => StorageService.getItem<number>(CURRENT_STORE_ID_KEY);

const clearStoreId = (): void => {
  StorageService.removeItem(CURRENT_STORE_ID_KEY);
};

export const StoreService = { fetchStores, saveStoreId, getStoredStoreId, clearStoreId };
