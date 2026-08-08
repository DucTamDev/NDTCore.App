# Store Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sau đăng nhập, xác định `storeId` thu ngân làm việc — tự động chọn nếu tài khoản chỉ có 1 cửa hàng, hiện màn chọn nếu có nhiều, lưu lựa chọn qua các lần mở app, và gate navigation dựa trên đó.

**Architecture:** `HttpClient` thêm `getPaged<T>` để đọc response phân trang của backend (pagination field ngang hàng với `Data`, không lồng bên trong). `storeSlice` (Redux, reducer thuần — không `createAsyncThunk`, khớp pattern `authSlice`/`printerSlice`) giữ `storeId` + danh sách store; orchestration async nằm trong hook `useStoreSelection` (khớp pattern `useAuth`). `RootNavigator` thêm nhánh thứ 3 (`StoreSelectStack`) giữa `AuthStack` và `AppTabs`.

**Tech Stack:** Redux Toolkit, react-native-paper (`TouchableRipple`, `Chip`), không thêm dependency mới.

## Global Constraints

- TypeScript strict, không dùng `any`.
- Không có path alias — mọi import dùng relative path.
- Toàn bộ text hiển thị cho người dùng: tiếng Việt.
- Redux slice trong project này luôn là reducer thuần — không dùng `createAsyncThunk`. Orchestration async nằm trong hook.
- File logic thuần (service, slice, http client) có test riêng. Component UI thuần trình bày / hook orchestration không có test riêng — verify qua type-check + lint + chạy thử.
- Chạy `npm run verify` (type-check + lint + test) trước mỗi commit.
- Endpoint: `GET /admin/store` — backend tự scope theo quyền tài khoản (cùng Bearer token đã có từ Auth), không lọc phía client.
- Ngoài phạm vi: CRUD store, quản lý thành viên store, ca làm việc/catalog/đơn hàng (sub-project kế tiếp), phân trang thật cho danh sách store.

---

### Task 1: `PagedApiResponse<T>` & `HttpClient.getPaged`

**Files:**
- Modify: `src/types/ApiResponse.ts`
- Modify: `src/services/http/HttpClient.ts`
- Modify: `src/services/http/HttpClient.test.ts`

**Interfaces:**
- Consumes: `AxiosInstance`/`instance` đã có trong `createHttpClient` (không đổi cấu trúc closure hiện có).
- Produces: `export interface PagedApiResponse<T> extends ApiResponse<T[]>` (dùng ở Task 2 — `storeApi`). `getPaged: <T>(url: string, config?: Partial<HttpRequestConfig>) => Promise<PagedApiResponse<T>>` — method mới trên object trả về từ `createHttpClient`/`HttpClient`, dùng ở Task 2.

- [ ] **Step 1: Thêm `PagedApiResponse<T>` vào `ApiResponse.ts`**

Thêm vào cuối `src/types/ApiResponse.ts` (giữ nguyên `ApiResponseError`/`ApiResponse<T>` hiện có):

```ts
export interface PagedApiResponse<T> extends ApiResponse<T[]> {
  PageNumber: number;
  PageSize: number;
  TotalCount: number;
  TotalPages: number;
  HasPreviousPage: boolean;
  HasNextPage: boolean;
}
```

- [ ] **Step 2: Viết test cho `getPaged` (thất bại trước vì method chưa tồn tại)**

Thêm vào cuối `describe('HttpClient', ...)` trong `src/services/http/HttpClient.test.ts` (giữ nguyên toàn bộ test case hiện có, chỉ thêm case mới):

```ts
  it('getPaged returns the full paged envelope, not just Data', async () => {
    setStoredTokens('access-1', 'refresh-1');
    mock.onGet('/items').reply(200, {
      IsSuccess: true,
      Data: [{ id: 1 }, { id: 2 }],
      Message: null,
      Error: null,
      PageNumber: 1,
      PageSize: 20,
      TotalCount: 2,
      TotalPages: 1,
      HasPreviousPage: false,
      HasNextPage: false,
    });

    const result = await client.getPaged<{ id: number }>('/items');
    expect(result.Data).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.TotalCount).toBe(2);
    expect(result.PageNumber).toBe(1);
  });
```

- [ ] **Step 3: Chạy test, xác nhận FAIL**

Run: `npx jest HttpClient.test.ts -t "getPaged"`
Expected: FAIL — `client.getPaged is not a function`.

- [ ] **Step 4: Thêm `getPaged` vào `createHttpClient`'s return object**

Trong `src/services/http/HttpClient.ts`, sửa `return { get: ..., post: ... }` ở cuối `createHttpClient` thành (thêm `getPaged`, giữ nguyên `get`/`post`):

```ts
  return {
    get: async <T>(url: string, config?: Partial<HttpRequestConfig>): Promise<ApiResponse<T>> => {
      const response = await instance.get<ApiResponse<T>>(url, config);
      return response.data;
    },
    getPaged: async <T>(url: string, config?: Partial<HttpRequestConfig>): Promise<PagedApiResponse<T>> => {
      const response = await instance.get<PagedApiResponse<T>>(url, config);
      return response.data;
    },
    post: async <T, D = unknown>(
      url: string,
      data?: D,
      config?: Partial<HttpRequestConfig>,
    ): Promise<ApiResponse<T>> => {
      const response = await instance.post<ApiResponse<T>>(url, data, config);
      return response.data;
    },
  };
```

Thêm import `PagedApiResponse` vào đầu file (cùng dòng import `ApiResponse` hiện có):

```ts
import type { ApiResponse, PagedApiResponse } from '../../types/ApiResponse';
```

- [ ] **Step 5: Chạy test, xác nhận PASS**

Run: `npx jest HttpClient.test.ts`
Expected: PASS — toàn bộ test hiện có + test mới đều xanh.

- [ ] **Step 6: Verify toàn bộ**

Run: `npm run verify`

- [ ] **Step 7: Commit**

```bash
git add src/types/ApiResponse.ts src/services/http/HttpClient.ts src/services/http/HttpClient.test.ts
git commit -m "feat: add PagedApiResponse type and HttpClient.getPaged"
```

---

### Task 2: Store types & `storeApi`

**Files:**
- Create: `src/features/store/types/store.types.ts`
- Create: `src/features/store/api/storeApi.ts`

**Interfaces:**
- Consumes: `HttpClient.getPaged` (Task 1), `PagedApiResponse<T>` (Task 1).
- Produces: `StoreDto { Id, Name, Code, LogoUrl, IsActive, IsAcceptingOrders, Address, District, Province }`, `StoreViewModel { id, name, code, logoUrl, isActive, isAcceptingOrders, address, district, province }` (dùng ở Task 3). `storeApi.getPagedAsync(): Promise<PagedApiResponse<StoreDto>>` (dùng ở Task 3 — `StoreService`).

- [ ] **Step 1: Tạo `store.types.ts`**

```ts
// src/features/store/types/store.types.ts
export interface StoreDto {
  Id: number;
  Name: string;
  Code: string;
  LogoUrl?: string | null;
  IsActive: boolean;
  IsAcceptingOrders: boolean;
  Address?: string | null;
  District?: string | null;
  Province?: string | null;
}

export interface StoreViewModel {
  id: number;
  name: string;
  code: string;
  logoUrl: string | null;
  isActive: boolean;
  isAcceptingOrders: boolean;
  address: string | null;
  district: string | null;
  province: string | null;
}
```

- [ ] **Step 2: Tạo `storeApi.ts`**

```ts
// src/features/store/api/storeApi.ts
import { HttpClient } from '../../../services/http/HttpClient';
import type { PagedApiResponse } from '../../../types/ApiResponse';
import type { StoreDto } from '../types/store.types';

export const storeApi = {
  getPagedAsync(): Promise<PagedApiResponse<StoreDto>> {
    return HttpClient.getPaged('/admin/store', { params: { PageNumber: 1, PageSize: 100 } });
  },
};
```

- [ ] **Step 3: Verify (type/api thuần khai báo — không có test riêng theo Global Constraints)**

Run: `npm run type-check && npm run lint`
Expected: 0 lỗi.

- [ ] **Step 4: Commit**

```bash
git add src/features/store/types/store.types.ts src/features/store/api/storeApi.ts
git commit -m "feat: add store types and storeApi"
```

---

### Task 3: `StoreService`

**Files:**
- Create: `src/features/store/services/StoreService.ts`
- Create: `src/features/store/services/StoreService.test.ts`

**Interfaces:**
- Consumes: `storeApi` (Task 2), `StorageService` (`src/services/StorageService.ts`), `StoreDto`/`StoreViewModel` (Task 2).
- Produces: `StoreService.fetchStores(): Promise<StoreViewModel[]>` (ném lỗi nếu thất bại — message tiếng Việt từ backend), `StoreService.saveStoreId(storeId: number): void`, `StoreService.getStoredStoreId(): number | null` (đồng bộ), `StoreService.clearStoreId(): void` — dùng ở Task 4 (`storeSlice` initial state), Task 5 (`useStoreSelection`), Task 6 (`SettingsSidebar` "Đổi cửa hàng").

- [ ] **Step 1: Viết test cho `StoreService` (thất bại trước vì file chưa tồn tại)**

```ts
// src/features/store/services/StoreService.test.ts
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
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest StoreService.test.ts`
Expected: FAIL — Cannot find module `./StoreService`.

- [ ] **Step 3: Viết implementation**

```ts
// src/features/store/services/StoreService.ts
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
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx jest StoreService.test.ts`
Expected: PASS — 4 test đều xanh.

- [ ] **Step 5: Verify toàn bộ**

Run: `npm run verify`

- [ ] **Step 6: Commit**

```bash
git add src/features/store/services/StoreService.ts src/features/store/services/StoreService.test.ts
git commit -m "feat: add StoreService for fetching and persisting the current store"
```

---

### Task 4: `storeSlice`

**Files:**
- Create: `src/features/store/store/storeSlice.ts`
- Create: `src/features/store/store/storeSlice.test.ts`
- Modify: `src/store/index.ts`

**Interfaces:**
- Consumes: `StoreService.getStoredStoreId()` (Task 3, để tính initial state đồng bộ — giống cách `authSlice` đọc token qua `AuthService.getStoredToken()`), `StoreViewModel` (Task 2).
- Produces: reducer đăng ký dưới key `currentStore` trong `store/index.ts` (đặt tên khác `store` — trùng với chính Redux store gốc sẽ gây nhầm lẫn `state.store.storeId` đọc rất khó hiểu). Actions: `storesLoadStarted()`, `storesLoaded(stores: StoreViewModel[])`, `storesLoadFailed(message: string)`, `storeSelected(storeId: number)`, `storeCleared()`. Selectors: `selectCurrentStoreId(state): number | null`, `selectAvailableStores(state): StoreViewModel[]`, `selectStoresLoading(state): boolean`, `selectStoresError(state): string | null`. Dùng ở Task 5 (`useStoreSelection`) và Task 6 (`RootNavigator`, `SettingsSidebar`).

- [ ] **Step 1: Viết test cho `storeSlice` (thất bại trước vì file chưa tồn tại)**

```ts
// src/features/store/store/storeSlice.test.ts
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
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest storeSlice.test.ts`
Expected: FAIL — Cannot find module `./storeSlice`.

- [ ] **Step 3: Viết implementation**

```ts
// src/features/store/store/storeSlice.ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { StoreService } from '../services/StoreService';
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
    },
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
export const selectStoresLoading = (state: StateWithCurrentStore): boolean => state.currentStore.isLoading;
export const selectStoresError = (state: StateWithCurrentStore): string | null => state.currentStore.error;

export default storeSlice.reducer;
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx jest storeSlice.test.ts`
Expected: PASS — 6 test đều xanh.

- [ ] **Step 5: Thêm `currentStore` reducer vào store**

```ts
// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/store/authSlice';
import currentStoreReducer from '../features/store/store/storeSlice';
import printerReducer from '../features/printer/store/printerSlice';
import settingsReducer from '../features/settings/store/settingsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    currentStore: currentStoreReducer,
    printer: printerReducer,
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

- [ ] **Step 6: Verify toàn bộ**

Run: `npm run verify`

- [ ] **Step 7: Commit**

```bash
git add src/features/store/store/storeSlice.ts src/features/store/store/storeSlice.test.ts src/store/index.ts
git commit -m "feat: add storeSlice and wire it into the Redux store"
```

---

### Task 5: `useStoreSelection` hook & `StoreSelectScreen`

**Files:**
- Create: `src/features/store/hooks/useStoreSelection.ts`
- Create: `src/features/store/screens/StoreSelectScreen.tsx`

**Interfaces:**
- Consumes: `StoreService` (Task 3), `storesLoadStarted`/`storesLoaded`/`storesLoadFailed`/`storeSelected`/`selectAvailableStores`/`selectStoresLoading`/`selectStoresError` (Task 4), `EmptyState`/`LoadingOverlay` (`src/components/`, không đổi).
- Produces: `StoreSelectScreen: React.FC` — dùng ở Task 6 (`StoreSelectStack`).

- [ ] **Step 1: Tạo `useStoreSelection.ts`**

```ts
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
```

- [ ] **Step 2: Tạo `StoreSelectScreen.tsx`**

```tsx
// src/features/store/screens/StoreSelectScreen.tsx
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, TouchableRipple, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
import { useStoreSelection } from '../hooks/useStoreSelection';
import type { StoreViewModel } from '../types/store.types';

export const StoreSelectScreen: React.FC = () => {
  const { stores, isLoading, error, selectStore } = useStoreSelection();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Text variant="headlineSmall" style={styles.title}>
        Chọn cửa hàng
      </Text>
      {isLoading ? <LoadingOverlay /> : null}
      {!isLoading && error ? <EmptyState message={error} /> : null}
      {!isLoading && !error && stores.length === 0 ? (
        <EmptyState message="Tài khoản chưa được gán cửa hàng nào — liên hệ quản trị viên" />
      ) : null}
      {!isLoading && !error && stores.length > 0 ? (
        <ScrollView contentContainerStyle={styles.grid}>
          {stores.map((store) => (
            <StoreCard key={store.id} store={store} onPress={() => selectStore(store.id)} />
          ))}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
};

interface StoreCardProps {
  store: StoreViewModel;
  onPress: () => void;
}

const StoreCard: React.FC<StoreCardProps> = ({ store, onPress }) => {
  const addressLine = [store.address, store.district, store.province].filter(Boolean).join(', ');

  return (
    <TouchableRipple style={styles.card} onPress={onPress} disabled={!store.isActive}>
      <View>
        <Text variant="titleMedium">{store.name}</Text>
        <Text variant="bodySmall" style={styles.code}>
          {store.code}
        </Text>
        {addressLine ? (
          <Text variant="bodySmall" style={styles.address}>
            {addressLine}
          </Text>
        ) : null}
        {store.isAcceptingOrders ? (
          <Chip compact style={styles.chip}>
            Đang nhận đơn
          </Chip>
        ) : null}
      </View>
    </TouchableRipple>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'white' },
  title: { padding: 24, paddingBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 24, paddingTop: 12 },
  card: {
    width: 260,
    padding: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  code: { color: '#6B7280', marginTop: 2 },
  address: { color: '#6B7280', marginTop: 8 },
  chip: { marginTop: 8, alignSelf: 'flex-start' },
});
```

- [ ] **Step 3: Verify (hook orchestration + component UI thuần trình bày — không viết test riêng theo Global Constraints)**

Run: `npm run type-check && npm run lint`
Expected: 0 lỗi.

- [ ] **Step 4: Commit**

```bash
git add src/features/store/hooks/useStoreSelection.ts src/features/store/screens/StoreSelectScreen.tsx
git commit -m "feat: add StoreSelectScreen with auto-select-if-one behavior"
```

---

### Task 6: Navigation gating (3 trạng thái) & "Đổi cửa hàng"

**Files:**
- Modify: `src/navigation/RootNavigator.tsx`
- Modify: `src/features/settings/components/SettingsSidebar.tsx`

**Interfaces:**
- Consumes: `StoreSelectScreen` (Task 5), `selectCurrentStoreId`/`storeCleared` (Task 4), `StoreService.clearStoreId` (Task 3).
- Produces: `RootNavigator` render 1 trong 3 nhánh (`AuthStack` / `StoreSelectStack` / `AppTabs`) theo `isLoggedIn` + `storeId`. `SettingsSidebar` thêm item "Đổi cửa hàng" hoạt động thật.

- [ ] **Step 1: Sửa `RootNavigator.tsx`**

```tsx
// src/navigation/RootNavigator.tsx
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { SettingsScreen } from '../features/settings/screens/SettingsScreen';
import { SalesScreen } from '../features/sales/screens/SalesScreen';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { StoreSelectScreen } from '../features/store/screens/StoreSelectScreen';
import { selectIsLoggedIn, loggedOut } from '../features/auth/store/authSlice';
import { selectCurrentStoreId } from '../features/store/store/storeSlice';
import { onSessionExpired } from '../services/http/sessionEvents';
import type { AppDispatch, RootState } from '../store';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

const SalesTabIcon = ({ color, size }: { color: string; size: number }) => (
  <Icon source="point-of-sale" color={color} size={size} />
);

const SettingsTabIcon = ({ color, size }: { color: string; size: number }) => (
  <Icon source="cog" color={color} size={size} />
);

const AppTabs: React.FC = () => (
  <Tab.Navigator initialRouteName="Sales" screenOptions={{ headerShown: false }}>
    <Tab.Screen
      name="Sales"
      component={SalesScreen}
      options={{
        title: 'Bán hàng',
        tabBarIcon: SalesTabIcon,
      }}
    />
    <Tab.Screen
      name="Settings"
      component={SettingsScreen}
      options={{
        title: 'Cài đặt',
        tabBarIcon: SettingsTabIcon,
      }}
    />
  </Tab.Navigator>
);

type AuthStackParamList = {
  Login: undefined;
};

const AuthNativeStack = createNativeStackNavigator<AuthStackParamList>();

const AuthStack: React.FC = () => (
  <AuthNativeStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthNativeStack.Screen name="Login" component={LoginScreen} />
  </AuthNativeStack.Navigator>
);

type StoreSelectStackParamList = {
  StoreSelect: undefined;
};

const StoreSelectNativeStack = createNativeStackNavigator<StoreSelectStackParamList>();

const StoreSelectStack: React.FC = () => (
  <StoreSelectNativeStack.Navigator screenOptions={{ headerShown: false }}>
    <StoreSelectNativeStack.Screen name="StoreSelect" component={StoreSelectScreen} />
  </StoreSelectNativeStack.Navigator>
);

export const RootNavigator: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const isLoggedIn = useSelector((state: RootState) => selectIsLoggedIn(state));
  const storeId = useSelector((state: RootState) => selectCurrentStoreId(state));

  useEffect(() => onSessionExpired(() => dispatch(loggedOut())), [dispatch]);

  let content: React.ReactElement;
  if (!isLoggedIn) {
    content = <AuthStack />;
  } else if (!storeId) {
    content = <StoreSelectStack />;
  } else {
    content = <AppTabs />;
  }

  return <NavigationContainer>{content}</NavigationContainer>;
};
```

- [ ] **Step 2: Sửa `SettingsSidebar.tsx`**

```tsx
// src/features/settings/components/SettingsSidebar.tsx
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TouchableRipple, Icon } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { StatusDot } from '../../../components/StatusDot';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { selectPrinters } from '../../printer/store/printerSlice';
import { PrinterService } from '../../printer/services/PrinterService';
import { useAuth } from '../../auth/hooks/useAuth';
import { StoreService } from '../../store/services/StoreService';
import { storeCleared } from '../../store/store/storeSlice';

const placeholderItems: Array<{ icon: string; label: string; group: 'device' | 'app' }> = [
  { icon: 'barcode-scan', label: 'Máy quét mã vạch', group: 'device' },
  { icon: 'account', label: 'Tài khoản', group: 'app' },
  { icon: 'translate', label: 'Ngôn ngữ', group: 'app' },
  { icon: 'cloud-outline', label: 'Đồng bộ dữ liệu', group: 'app' },
  { icon: 'information-outline', label: 'Về ứng dụng', group: 'app' },
];

export const SettingsSidebar: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const printers = useSelector((state: RootState) => selectPrinters(state));
  const hasConnectedPrinter = printers.some((p) => PrinterService.getStatus(p.id) === 'connected');
  const { logout } = useAuth();
  const [confirmLogoutVisible, setConfirmLogoutVisible] = useState(false);
  const [confirmChangeStoreVisible, setConfirmChangeStoreVisible] = useState(false);

  const confirmLogout = (): void => {
    setConfirmLogoutVisible(false);
    logout();
  };

  const confirmChangeStore = (): void => {
    setConfirmChangeStoreVisible(false);
    StoreService.clearStoreId();
    dispatch(storeCleared());
  };

  return (
    <View style={styles.container}>
      <Text style={styles.groupLabel}>Thiết bị</Text>
      <TouchableRipple style={[styles.item, styles.itemActive]}>
        <View style={styles.itemRow}>
          <Icon source="printer" size={16} />
          <Text style={styles.itemLabelActive}>Quản lý máy in</Text>
          {hasConnectedPrinter ? <StatusDot status="connected" /> : null}
        </View>
      </TouchableRipple>
      {placeholderItems
        .filter((item) => item.group === 'device')
        .map((item) => (
          <View key={item.label} style={styles.item}>
            <View style={styles.itemRow}>
              <Icon source={item.icon} size={16} />
              <Text style={styles.itemLabelDisabled}>{item.label}</Text>
            </View>
          </View>
        ))}

      <Text style={styles.groupLabel}>Ứng dụng</Text>
      {placeholderItems
        .filter((item) => item.group === 'app')
        .map((item) => (
          <View key={item.label} style={styles.item}>
            <View style={styles.itemRow}>
              <Icon source={item.icon} size={16} />
              <Text style={styles.itemLabelDisabled}>{item.label}</Text>
            </View>
          </View>
        ))}

      <View style={styles.spacer} />
      <TouchableRipple style={styles.item} onPress={() => setConfirmChangeStoreVisible(true)}>
        <View style={styles.itemRow}>
          <Icon source="store-outline" size={16} />
          <Text style={styles.itemLabelActive}>Đổi cửa hàng</Text>
        </View>
      </TouchableRipple>
      <TouchableRipple style={styles.item} onPress={() => setConfirmLogoutVisible(true)}>
        <View style={styles.itemRow}>
          <Icon source="logout" size={16} />
          <Text style={styles.itemLabelActive}>Đăng xuất</Text>
        </View>
      </TouchableRipple>

      <ConfirmDialog
        visible={confirmChangeStoreVisible}
        title="Đổi cửa hàng"
        message="Quay lại màn chọn cửa hàng?"
        confirmLabel="Đổi cửa hàng"
        onConfirm={confirmChangeStore}
        onCancel={() => setConfirmChangeStoreVisible(false)}
      />
      <ConfirmDialog
        visible={confirmLogoutVisible}
        title="Đăng xuất"
        message="Bạn có chắc muốn đăng xuất không?"
        confirmLabel="Đăng xuất"
        onConfirm={confirmLogout}
        onCancel={() => setConfirmLogoutVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: 220, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#E5E7EB', padding: 8 },
  groupLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 8, marginBottom: 4, marginLeft: 6 },
  item: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
  itemActive: { backgroundColor: '#EFF6FF' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemLabelActive: { fontSize: 13, color: '#2563EB', flex: 1 },
  itemLabelDisabled: { fontSize: 13, color: '#9CA3AF', flex: 1 },
  spacer: { flex: 1 },
});
```

- [ ] **Step 3: Verify toàn bộ**

Run: `npm run verify`
Expected: type-check + lint + toàn bộ test suite (bao gồm `__tests__/App.test.tsx` render qua `RootNavigator` mới — store fresh không có token lẫn `storeId` → mặc định render `AuthStack`/`LoginScreen`, không đổi so với trước) đều PASS.

- [ ] **Step 4: Commit**

```bash
git add src/navigation/RootNavigator.tsx src/features/settings/components/SettingsSidebar.tsx
git commit -m "feat: gate navigation on store selection and wire change-store action"
```

---

### Task 7: Manual verify — chọn store thật trên thiết bị/emulator/web

**Files:** không tạo/sửa file — bước xác nhận thủ công.

- [ ] **Step 1: Build và chạy app**

Run: `npm run android` (hoặc `npm run web`)
Expected: đăng nhập xong (tài khoản thật), nếu tài khoản quản lý nhiều store → hiện màn "Chọn cửa hàng" với danh sách card thật; nếu chỉ 1 store → tự động vào thẳng Sales.

- [ ] **Step 2: Chọn store (nếu có nhiều)**

Bấm vào 1 card store hợp lệ (`isActive`).
Expected: chuyển sang tab "Bán hàng" ngay. Đóng/mở lại app (hoặc reload web) → vẫn ở Sales, không quay lại màn chọn store — xác nhận `storeId` đã lưu và đọc lại đúng lúc khởi động.

- [ ] **Step 3: Đổi cửa hàng**

Vào tab "Cài đặt" → bấm "Đổi cửa hàng" → xác nhận trong dialog.
Expected: quay lại màn "Chọn cửa hàng" (không bị đăng xuất — vẫn còn token, chỉ mất `storeId`).

- [ ] **Step 4: Tài khoản không có store nào (nếu test được)**

Nếu có tài khoản test không được gán store nào, đăng nhập bằng tài khoản đó.
Expected: hiện "Tài khoản chưa được gán cửa hàng nào — liên hệ quản trị viên", không crash.

- [ ] **Step 5: Xác nhận và báo cáo**

Nếu các bước trên đạt, sub-project Store selection hoàn tất.
