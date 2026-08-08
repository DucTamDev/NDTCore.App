import { StoreService } from './StoreService';
import { storeApi } from '../api/storeApi';
import { StorageService } from '../../../services/StorageService';

jest.mock('../api/storeApi', () => ({
  storeApi: { getPagedAsync: jest.fn() },
}));

const CURRENT_STORE_ID_KEY = 'store.currentId';

describe('StoreService', () => {
  afterEach(() => {
    StorageService.removeItem(CURRENT_STORE_ID_KEY);
    jest.clearAllMocks();
  });

  it('getStoredStoreId returns null when nothing is stored', () => {
    expect(StoreService.getStoredStoreId()).toBeNull();
  });

  it('fetchStores maps DTOs to view models on success', async () => {
    (storeApi.getPagedAsync as jest.Mock).mockResolvedValue({
      IsSuccess: true,
      Data: [
        {
          Id: 1,
          Name: 'Chi nhánh Quận 1',
          Code: 'CN01',
          LogoUrl: null,
          IsActive: true,
          IsAcceptingOrders: true,
          Address: '123 Lê Lợi',
          District: 'Quận 1',
          Province: 'TP.HCM',
        },
      ],
      Message: null,
      Error: null,
      PageNumber: 1,
      PageSize: 100,
      TotalCount: 1,
      TotalPages: 1,
      HasPreviousPage: false,
      HasNextPage: false,
    });

    const result = await StoreService.fetchStores();

    expect(result).toEqual([
      {
        id: 1,
        name: 'Chi nhánh Quận 1',
        code: 'CN01',
        logoUrl: null,
        isActive: true,
        isAcceptingOrders: true,
        address: '123 Lê Lợi',
        district: 'Quận 1',
        province: 'TP.HCM',
      },
    ]);
  });

  it('fetchStores throws the backend error message on failure', async () => {
    (storeApi.getPagedAsync as jest.Mock).mockResolvedValue({
      IsSuccess: false,
      Data: null,
      Message: null,
      Error: { ErrorCode: 'FORBIDDEN', Message: 'Không có quyền truy cập' },
      PageNumber: 1,
      PageSize: 100,
      TotalCount: 0,
      TotalPages: 0,
      HasPreviousPage: false,
      HasNextPage: false,
    });

    await expect(StoreService.fetchStores()).rejects.toThrow('Không có quyền truy cập');
  });

  it('saveStoreId/getStoredStoreId/clearStoreId round-trip', () => {
    StoreService.saveStoreId(42);
    expect(StoreService.getStoredStoreId()).toBe(42);
    StoreService.clearStoreId();
    expect(StoreService.getStoredStoreId()).toBeNull();
  });
});
