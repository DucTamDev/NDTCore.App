# Product Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay `ProductAreaPlaceholder` tĩnh trong Sales Screen bằng catalog thật — tải danh mục + sản phẩm của cửa hàng hiện tại, cho chuyển danh mục và tìm kiếm.

**Architecture:** Module mới `src/features/catalog/` (types/api/service/slice/hook/components) theo đúng pattern feature module đã có (`auth`, `store`). `CatalogService` chứa toàn bộ logic lọc/tìm kiếm thuần (dễ test); `useCatalog` chỉ orchestration fetch. `ProductArea` (trong `features/sales/components/`) ghép các component catalog + giữ state UI cục bộ (danh mục đang chọn, từ khoá) — không đưa state UI này vào Redux vì không nơi nào khác cần đọc.

**Tech Stack:** Redux Toolkit (reducer thuần, không `createAsyncThunk`), React Native `FlatList` (virtualization có sẵn), react-native-paper (`Searchbar`, `TouchableRipple`, `Text`, `Button`).

## Global Constraints

- TypeScript strict, không dùng `any`.
- Không có path alias — mọi import dùng relative path.
- Toàn bộ text hiển thị cho người dùng: tiếng Việt.
- Redux slice trong project này luôn là reducer thuần — không dùng `createAsyncThunk`.
- File logic thuần (service, slice) có test riêng. Component UI thuần trình bày / hook orchestration không có test riêng — verify qua type-check + lint + chạy thử.
- Chạy `npm run verify` (type-check + lint + test) trước mỗi commit.
- Endpoint: `GET /pos/store/{storeId}/catalog` — trả một object duy nhất `{Categories, Products}`, KHÔNG phân trang (khác `getPaged` dùng cho Store selection).
- Ngoài phạm vi: thêm sản phẩm vào giỏ hàng (kể cả sản phẩm không-Modifier), Modifier, Product Detail, offline caching, barcode scanner — dồn sang sub-project "Cart & modifier" kế tiếp. Chạm Product Card trong sub-project này KHÔNG gắn logic nghiệp vụ (chỉ giữ ripple UI feedback).

---

### Task 1: Catalog types & `catalogApi`

**Files:**
- Create: `src/features/catalog/types/catalog.types.ts`
- Create: `src/features/catalog/api/catalogApi.ts`

**Interfaces:**
- Consumes: `HttpClient.get` (`src/services/http/HttpClient.ts`, đã có sẵn), `ApiResponse<T>` (`src/types/ApiResponse.ts`, đã có sẵn).
- Produces: `PosCatalogDto`, `PosCategoryDto`, `PosProductDto`, `PosTagDto`, `PosOptionGroupDto`, `PosOptionDto`, `CategoryViewModel`, `ProductViewModel`, `ALL_CATEGORY_ID`, `CategorySelection` — dùng ở mọi task sau. `catalogApi.getCatalogAsync(storeId: number): Promise<ApiResponse<PosCatalogDto>>` — dùng ở Task 2 (`CatalogService`).

- [ ] **Step 1: Tạo `catalog.types.ts`**

```ts
// src/features/catalog/types/catalog.types.ts
export interface PosTagDto {
  Id: number;
  Name: string;
  ColorHex?: string | null;
  TextColor?: string | null;
  DisplayOrder: number;
}

export interface PosOptionDto {
  Id: number;
  Name: string;
  ResolvedPrice: number;
  IsDefault: boolean;
  IsAvailable: boolean;
  DisplayOrder: number;
}

export interface PosOptionGroupDto {
  GroupId: number;
  GroupName: string;
  UiType: string;
  IsRequired: boolean;
  MinSelect: number;
  MaxSelect: number;
  DisplayOrder: number;
  Options: PosOptionDto[];
}

export interface PosProductDto {
  Id: number;
  CategoryId: number | null;
  Sku: string;
  Name: string;
  ShortDescription?: string | null;
  ResolvedPrice: number;
  IsAvailable: boolean;
  DisplayOrder: number;
  ImageUrl?: string | null;
  Tags: PosTagDto[];
  OptionGroups: PosOptionGroupDto[];
}

export interface PosCategoryDto {
  Id: number;
  ParentId: number | null;
  Name: string;
  ProductCount: number;
  Children: PosCategoryDto[];
}

export interface PosCatalogDto {
  Categories: PosCategoryDto[];
  Products: PosProductDto[];
}

export const ALL_CATEGORY_ID = 'all' as const;
export type CategorySelection = typeof ALL_CATEGORY_ID | number;

export interface CategoryViewModel {
  id: number;
  parentId: number | null;
  name: string;
  productCount: number;
  children: CategoryViewModel[];
}

export interface ProductViewModel {
  id: number;
  categoryId: number | null;
  name: string;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  sku: string;
  badgeLabel: string | null;
  badgeColorHex: string | null;
  badgeTextColorHex: string | null;
}
```

`PosOptionGroupDto`/`PosOptionDto` được khai báo đủ để khớp backend nhưng CHƯA dùng ở ViewModel/UI trong plan này — chuẩn bị sẵn cho sub-project "Cart & modifier".

- [ ] **Step 2: Tạo `catalogApi.ts`**

```ts
// src/features/catalog/api/catalogApi.ts
import { HttpClient } from '../../../services/http/HttpClient';
import type { ApiResponse } from '../../../types/ApiResponse';
import type { PosCatalogDto } from '../types/catalog.types';

export const catalogApi = {
  getCatalogAsync(storeId: number): Promise<ApiResponse<PosCatalogDto>> {
    return HttpClient.get(`/pos/store/${storeId}/catalog`);
  },
};
```

- [ ] **Step 3: Verify (type/api thuần khai báo — không có test riêng theo Global Constraints)**

Run: `npm run type-check && npm run lint`
Expected: 0 lỗi.

- [ ] **Step 4: Commit**

```bash
git add src/features/catalog/types/catalog.types.ts src/features/catalog/api/catalogApi.ts
git commit -m "feat: add catalog types and catalogApi"
```

---

### Task 2: `CatalogService`

**Files:**
- Create: `src/features/catalog/services/CatalogService.ts`
- Create: `src/features/catalog/services/CatalogService.test.ts`

**Interfaces:**
- Consumes: `catalogApi.getCatalogAsync` (Task 1), tất cả type từ Task 1.
- Produces: `CatalogService.fetchCatalog(storeId: number): Promise<{categories: CategoryViewModel[], products: ProductViewModel[]}>`, `CatalogService.filterByCategory(products: ProductViewModel[], categories: CategoryViewModel[], categoryId: CategorySelection): ProductViewModel[]`, `CatalogService.searchProducts(products: ProductViewModel[], keyword: string): ProductViewModel[]` — dùng ở Task 4 (`useCatalog`) và Task 6 (`ProductArea`).

- [ ] **Step 1: Viết test cho `CatalogService` (thất bại trước vì file chưa tồn tại)**

```ts
// src/features/catalog/services/CatalogService.test.ts
import { CatalogService } from './CatalogService';
import { catalogApi } from '../api/catalogApi';
import { ALL_CATEGORY_ID } from '../types/catalog.types';
import type { CategoryViewModel, ProductViewModel } from '../types/catalog.types';

jest.mock('../api/catalogApi', () => ({
  catalogApi: { getCatalogAsync: jest.fn() },
}));

function makeProduct(overrides: Partial<ProductViewModel>): ProductViewModel {
  return {
    id: 1,
    categoryId: null,
    name: 'Sản phẩm',
    price: 10000,
    imageUrl: null,
    isAvailable: true,
    sku: 'SKU',
    badgeLabel: null,
    badgeColorHex: null,
    badgeTextColorHex: null,
    ...overrides,
  };
}

describe('CatalogService.fetchCatalog', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('maps categories and products from DTO to ViewModel on success', async () => {
    (catalogApi.getCatalogAsync as jest.Mock).mockResolvedValue({
      IsSuccess: true,
      Data: {
        Categories: [
          {
            Id: 1,
            ParentId: null,
            Name: 'Trà sữa',
            ProductCount: 2,
            Children: [{ Id: 2, ParentId: 1, Name: 'Trà sữa size L', ProductCount: 1, Children: [] }],
          },
        ],
        Products: [
          {
            Id: 10,
            CategoryId: 2,
            Sku: 'TS001',
            Name: 'Trà sữa Olong',
            ShortDescription: null,
            ResolvedPrice: 45000,
            IsAvailable: true,
            DisplayOrder: 1,
            ImageUrl: null,
            Tags: [
              { Id: 1, Name: 'HOT', ColorHex: '#EF4444', TextColor: '#FFFFFF', DisplayOrder: 1 },
              { Id: 2, Name: 'NEW', ColorHex: '#10B981', TextColor: '#FFFFFF', DisplayOrder: 2 },
            ],
            OptionGroups: [],
          },
        ],
      },
      Message: null,
      Error: null,
    });

    const result = await CatalogService.fetchCatalog(7);

    expect(result.categories).toEqual([
      {
        id: 1,
        parentId: null,
        name: 'Trà sữa',
        productCount: 2,
        children: [{ id: 2, parentId: 1, name: 'Trà sữa size L', productCount: 1, children: [] }],
      },
    ]);
    expect(result.products).toEqual([
      {
        id: 10,
        categoryId: 2,
        name: 'Trà sữa Olong',
        price: 45000,
        imageUrl: null,
        isAvailable: true,
        sku: 'TS001',
        badgeLabel: 'HOT',
        badgeColorHex: '#EF4444',
        badgeTextColorHex: '#FFFFFF',
      },
    ]);
    expect(catalogApi.getCatalogAsync).toHaveBeenCalledWith(7);
  });

  it('throws the backend error message on failure', async () => {
    (catalogApi.getCatalogAsync as jest.Mock).mockResolvedValue({
      IsSuccess: false,
      Data: null,
      Message: null,
      Error: { ErrorCode: 'FORBIDDEN', Message: 'Không có quyền truy cập cửa hàng này' },
    });

    await expect(CatalogService.fetchCatalog(7)).rejects.toThrow('Không có quyền truy cập cửa hàng này');
  });

  it('maps a product with no tags to a null badge', async () => {
    (catalogApi.getCatalogAsync as jest.Mock).mockResolvedValue({
      IsSuccess: true,
      Data: {
        Categories: [],
        Products: [
          {
            Id: 11,
            CategoryId: null,
            Sku: 'TS002',
            Name: 'Trà đào',
            ShortDescription: null,
            ResolvedPrice: 39000,
            IsAvailable: true,
            DisplayOrder: 1,
            ImageUrl: null,
            Tags: [],
            OptionGroups: [],
          },
        ],
      },
      Message: null,
      Error: null,
    });

    const result = await CatalogService.fetchCatalog(7);
    expect(result.products[0].badgeLabel).toBeNull();
    expect(result.products[0].categoryId).toBeNull();
  });
});

describe('CatalogService.filterByCategory', () => {
  const parent: CategoryViewModel = {
    id: 1,
    parentId: null,
    name: 'Trà sữa',
    productCount: 2,
    children: [{ id: 2, parentId: 1, name: 'Size L', productCount: 1, children: [] }],
  };
  const other: CategoryViewModel = { id: 3, parentId: null, name: 'Coffee', productCount: 1, children: [] };
  const categories = [parent, other];

  const productInChild = makeProduct({ id: 100, categoryId: 2 });
  const productInParentDirectly = makeProduct({ id: 101, categoryId: 1 });
  const productInOther = makeProduct({ id: 102, categoryId: 3 });
  const products = [productInChild, productInParentDirectly, productInOther];

  it('returns all products when categoryId is ALL_CATEGORY_ID', () => {
    expect(CatalogService.filterByCategory(products, categories, ALL_CATEGORY_ID)).toEqual(products);
  });

  it('includes products of child categories when a parent category is selected', () => {
    const result = CatalogService.filterByCategory(products, categories, 1);
    expect(result).toEqual([productInChild, productInParentDirectly]);
  });

  it('returns an empty array when the categoryId does not exist in the tree', () => {
    expect(CatalogService.filterByCategory(products, categories, 999)).toEqual([]);
  });
});

describe('CatalogService.searchProducts', () => {
  const products = [
    makeProduct({ id: 1, sku: 'TD001', name: 'Trà đào cam sả' }),
    makeProduct({ id: 2, sku: 'CF001', name: 'Cà phê đen' }),
    makeProduct({ id: 3, sku: 'TS-DAO', name: 'Trân châu' }),
  ];

  it('returns all products when keyword is empty', () => {
    expect(CatalogService.searchProducts(products, '')).toEqual(products);
  });

  it('matches by SKU first, then by name without diacritics', () => {
    const result = CatalogService.searchProducts(products, 'dao');
    expect(result.map((p) => p.id)).toEqual([3, 1]);
  });

  it('matches case-insensitively with diacritics', () => {
    const result = CatalogService.searchProducts(products, 'CÀ PHÊ');
    expect(result.map((p) => p.id)).toEqual([2]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(CatalogService.searchProducts(products, 'americano')).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest CatalogService.test.ts`
Expected: FAIL — Cannot find module `./CatalogService`.

- [ ] **Step 3: Viết implementation**

```ts
// src/features/catalog/services/CatalogService.ts
import { catalogApi } from '../api/catalogApi';
import { ALL_CATEGORY_ID } from '../types/catalog.types';
import type {
  CategorySelection,
  CategoryViewModel,
  PosCategoryDto,
  PosProductDto,
  PosTagDto,
  ProductViewModel,
} from '../types/catalog.types';

const toBadge = (
  tags: PosTagDto[],
): Pick<ProductViewModel, 'badgeLabel' | 'badgeColorHex' | 'badgeTextColorHex'> => {
  const primary = [...tags].sort((a, b) => a.DisplayOrder - b.DisplayOrder)[0];
  return primary
    ? {
        badgeLabel: primary.Name,
        badgeColorHex: primary.ColorHex ?? null,
        badgeTextColorHex: primary.TextColor ?? null,
      }
    : { badgeLabel: null, badgeColorHex: null, badgeTextColorHex: null };
};

const toProductViewModel = (dto: PosProductDto): ProductViewModel => ({
  id: dto.Id,
  categoryId: dto.CategoryId ?? null,
  name: dto.Name,
  price: dto.ResolvedPrice,
  imageUrl: dto.ImageUrl ?? null,
  isAvailable: dto.IsAvailable,
  sku: dto.Sku,
  ...toBadge(dto.Tags),
});

const toCategoryViewModel = (dto: PosCategoryDto): CategoryViewModel => ({
  id: dto.Id,
  parentId: dto.ParentId ?? null,
  name: dto.Name,
  productCount: dto.ProductCount,
  children: dto.Children.map(toCategoryViewModel),
});

const fetchCatalog = async (
  storeId: number,
): Promise<{ categories: CategoryViewModel[]; products: ProductViewModel[] }> => {
  const response = await catalogApi.getCatalogAsync(storeId);

  if (!response.IsSuccess) {
    throw new Error(response.Error?.Message ?? 'Không thể tải danh sách sản phẩm');
  }

  return {
    categories: (response.Data?.Categories ?? []).map(toCategoryViewModel),
    products: (response.Data?.Products ?? []).map(toProductViewModel),
  };
};

const collectCategoryIds = (category: CategoryViewModel): number[] => [
  category.id,
  ...category.children.flatMap(collectCategoryIds),
];

const findCategory = (nodes: CategoryViewModel[], categoryId: number): CategoryViewModel | null => {
  for (const node of nodes) {
    if (node.id === categoryId) return node;
    const found = findCategory(node.children, categoryId);
    if (found) return found;
  }
  return null;
};

const filterByCategory = (
  products: ProductViewModel[],
  categories: CategoryViewModel[],
  categoryId: CategorySelection,
): ProductViewModel[] => {
  if (categoryId === ALL_CATEGORY_ID) return products;

  const target = findCategory(categories, categoryId);
  if (!target) return [];

  const allowedIds = new Set(collectCategoryIds(target));
  return products.filter((product) => product.categoryId !== null && allowedIds.has(product.categoryId));
};

const stripDiacritics = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

const matchTier = (product: ProductViewModel, lowerKeyword: string): 0 | 1 | 2 | null => {
  const sku = product.sku.toLowerCase();
  const name = product.name.toLowerCase();

  if (sku.includes(lowerKeyword)) return 0;
  if (name.includes(lowerKeyword)) return 1;
  if (stripDiacritics(name).includes(stripDiacritics(lowerKeyword))) return 2;
  return null;
};

const searchProducts = (products: ProductViewModel[], keyword: string): ProductViewModel[] => {
  const lowerKeyword = keyword.trim().toLowerCase();
  if (!lowerKeyword) return products;

  return products
    .map((product) => ({ product, tier: matchTier(product, lowerKeyword) }))
    .filter((entry): entry is { product: ProductViewModel; tier: 0 | 1 | 2 } => entry.tier !== null)
    .sort((a, b) => a.tier - b.tier)
    .map((entry) => entry.product);
};

export const CatalogService = { fetchCatalog, filterByCategory, searchProducts };
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx jest CatalogService.test.ts`
Expected: PASS — toàn bộ test đều xanh.

- [ ] **Step 5: Verify toàn bộ**

Run: `npm run verify`

- [ ] **Step 6: Commit**

```bash
git add src/features/catalog/services/CatalogService.ts src/features/catalog/services/CatalogService.test.ts
git commit -m "feat: add CatalogService with fetch, category filter, and search"
```

---

### Task 3: `catalogSlice`

**Files:**
- Create: `src/features/catalog/store/catalogSlice.ts`
- Create: `src/features/catalog/store/catalogSlice.test.ts`
- Modify: `src/store/index.ts`

**Interfaces:**
- Consumes: `CategoryViewModel`, `ProductViewModel` (Task 1).
- Produces: reducer đăng ký dưới key `catalog` trong `store/index.ts`. Actions: `catalogLoadStarted()`, `catalogLoaded({categories, products})`, `catalogLoadFailed(message: string)`. Selectors: `selectCategories(state): CategoryViewModel[]`, `selectProducts(state): ProductViewModel[]`, `selectCatalogLoading(state): boolean`, `selectCatalogError(state): string | null`. Dùng ở Task 4 (`useCatalog`).

- [ ] **Step 1: Viết test cho `catalogSlice` (thất bại trước vì file chưa tồn tại)**

```ts
// src/features/catalog/store/catalogSlice.test.ts
import reducer, {
  catalogLoadStarted,
  catalogLoaded,
  catalogLoadFailed,
  selectCategories,
  selectProducts,
  selectCatalogLoading,
  selectCatalogError,
} from './catalogSlice';
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
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest catalogSlice.test.ts`
Expected: FAIL — Cannot find module `./catalogSlice`.

- [ ] **Step 3: Viết implementation**

```ts
// src/features/catalog/store/catalogSlice.ts
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
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx jest catalogSlice.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire vào `src/store/index.ts`**

Nội dung hiện tại:

```ts
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

Thay bằng:

```ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/store/authSlice';
import catalogReducer from '../features/catalog/store/catalogSlice';
import currentStoreReducer from '../features/store/store/storeSlice';
import printerReducer from '../features/printer/store/printerSlice';
import settingsReducer from '../features/settings/store/settingsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    catalog: catalogReducer,
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
git add src/features/catalog/store/catalogSlice.ts src/features/catalog/store/catalogSlice.test.ts src/store/index.ts
git commit -m "feat: add catalogSlice and wire it into the Redux store"
```

---

### Task 4: `useCatalog` hook

**Files:**
- Create: `src/features/catalog/hooks/useCatalog.ts`

**Interfaces:**
- Consumes: `CatalogService.fetchCatalog` (Task 2), `catalogLoadStarted`/`catalogLoaded`/`catalogLoadFailed`/`selectCategories`/`selectProducts`/`selectCatalogLoading`/`selectCatalogError` (Task 3), `selectCurrentStoreId` (`src/features/store/store/storeSlice.ts`, đã có sẵn).
- Produces: `useCatalog(): {categories, products, isLoading, error, retry}` — dùng ở Task 6 (`ProductArea`).

- [ ] **Step 1: Tạo `useCatalog.ts`**

```ts
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
```

`storeId === null` chỉ là an toàn phòng thủ — theo kiến trúc navigation hiện tại (`RootNavigator`), `ProductArea` chỉ mount được khi `storeId` đã có.

- [ ] **Step 2: Verify (hook orchestration — không có test riêng theo Global Constraints)**

Run: `npm run type-check && npm run lint`
Expected: 0 lỗi.

- [ ] **Step 3: Commit**

```bash
git add src/features/catalog/hooks/useCatalog.ts
git commit -m "feat: add useCatalog hook"
```

---

### Task 5: Catalog UI components

**Files:**
- Create: `src/utils/formatCurrency.ts`
- Create: `src/features/catalog/components/SearchBar.tsx`
- Create: `src/features/catalog/components/CategoryTabs.tsx`
- Create: `src/features/catalog/components/ProductCardSkeleton.tsx`
- Create: `src/features/catalog/components/ProductCard.tsx`
- Create: `src/features/catalog/components/ProductGrid.tsx`

**Interfaces:**
- Consumes: `CategoryViewModel`, `ProductViewModel`, `CategorySelection`, `ALL_CATEGORY_ID` (Task 1), `EmptyState` (`src/components/EmptyState.tsx`, đã có sẵn, prop `message: string`).
- Produces: `formatCurrency(amount: number): string`. `SearchBar({value, onChangeText})`. `CategoryTabs({categories, selectedCategoryId, onSelect})`. `ProductCard({product})`. `ProductGrid({products, numColumns, isLoading, emptyMessage})`. Tất cả dùng ở Task 6 (`ProductArea`).

- [ ] **Step 1: Tạo `formatCurrency.ts`**

```ts
// src/utils/formatCurrency.ts
export const formatCurrency = (amount: number): string => `${Math.round(amount).toLocaleString('vi-VN')}đ`;
```

- [ ] **Step 2: Tạo `SearchBar.tsx`**

react-native-paper export sẵn `Searchbar` (MD3), đã có nút xoá tự động khi có nội dung — không cần tự xây lại.

```tsx
// src/features/catalog/components/SearchBar.tsx
import React from 'react';
import { Searchbar } from 'react-native-paper';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChangeText }) => (
  <Searchbar placeholder="Tìm món, mã món..." value={value} onChangeText={onChangeText} />
);
```

- [ ] **Step 3: Tạo `CategoryTabs.tsx`**

```tsx
// src/features/catalog/components/CategoryTabs.tsx
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';
import { ALL_CATEGORY_ID } from '../types/catalog.types';
import type { CategorySelection, CategoryViewModel } from '../types/catalog.types';

export interface CategoryTabsProps {
  categories: CategoryViewModel[];
  selectedCategoryId: CategorySelection;
  onSelect: (categoryId: CategorySelection) => void;
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({ categories, selectedCategoryId, onSelect }) => {
  const theme = useTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      <Tab
        label="Tất cả"
        active={selectedCategoryId === ALL_CATEGORY_ID}
        activeColor={theme.colors.primary}
        onPress={() => onSelect(ALL_CATEGORY_ID)}
      />
      {categories.map((category) => (
        <Tab
          key={category.id}
          label={category.name}
          active={selectedCategoryId === category.id}
          activeColor={theme.colors.primary}
          onPress={() => onSelect(category.id)}
        />
      ))}
    </ScrollView>
  );
};

interface TabProps {
  label: string;
  active: boolean;
  activeColor: string;
  onPress: () => void;
}

const Tab: React.FC<TabProps> = ({ label, active, activeColor, onPress }) => (
  <TouchableRipple style={styles.tab} onPress={onPress}>
    <Text variant="labelLarge" style={active ? { color: activeColor, fontWeight: '700' } : styles.tabLabel}>
      {label}
    </Text>
  </TouchableRipple>
);

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  tab: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  tabLabel: { color: '#6B7280' },
});
```

- [ ] **Step 4: Tạo `ProductCardSkeleton.tsx`**

```tsx
// src/features/catalog/components/ProductCardSkeleton.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';

export const ProductCardSkeleton: React.FC = () => (
  <View style={styles.card}>
    <View style={styles.image} />
    <View style={styles.line} />
    <View style={[styles.line, styles.lineShort]} />
  </View>
);

const styles = StyleSheet.create({
  card: { flex: 1, height: 220, borderRadius: 12, padding: 12, backgroundColor: '#F3F4F6' },
  image: { flex: 1, borderRadius: 8, backgroundColor: '#E5E7EB' },
  line: { height: 12, borderRadius: 4, backgroundColor: '#E5E7EB', marginTop: 8 },
  lineShort: { width: '50%' },
});
```

- [ ] **Step 5: Tạo `ProductCard.tsx`**

```tsx
// src/features/catalog/components/ProductCard.tsx
import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import { formatCurrency } from '../../../utils/formatCurrency';
import type { ProductViewModel } from '../types/catalog.types';

export interface ProductCardProps {
  product: ProductViewModel;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => (
  // onPress chưa gắn thêm-vào-giỏ — nằm ngoài phạm vi sub-project Product catalog,
  // xem docs/superpowers/specs/2026-08-08-product-catalog-design.md. Sub-project
  // "Cart & modifier" kế tiếp sẽ nối logic thật vào đây.
  <TouchableRipple style={styles.card} onPress={() => {}} disabled={!product.isAvailable}>
    <View style={!product.isAvailable ? styles.unavailable : undefined}>
      {product.badgeLabel ? (
        <View style={[styles.badge, { backgroundColor: product.badgeColorHex ?? '#EF4444' }]}>
          <Text
            variant="labelSmall"
            style={[styles.badgeText, product.badgeTextColorHex ? { color: product.badgeTextColorHex } : null]}
          >
            {product.badgeLabel}
          </Text>
        </View>
      ) : null}
      {product.imageUrl ? (
        <Image source={{ uri: product.imageUrl }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text variant="displaySmall">🧋</Text>
        </View>
      )}
      {!product.isAvailable ? (
        <View style={styles.outOfStockOverlay}>
          <Text variant="labelLarge" style={styles.outOfStockText}>
            HẾT HÀNG
          </Text>
        </View>
      ) : null}
      <Text variant="bodyMedium" numberOfLines={2} style={styles.name}>
        {product.name}
      </Text>
      <Text variant="titleSmall" style={styles.price}>
        {formatCurrency(product.price)}
      </Text>
    </View>
  </TouchableRipple>
);

const styles = StyleSheet.create({
  card: { flex: 1, height: 220, borderRadius: 12, padding: 12, backgroundColor: 'white' },
  unavailable: { opacity: 0.5 },
  image: { flex: 1, borderRadius: 8 },
  imagePlaceholder: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: { color: 'white' },
  outOfStockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 8,
  },
  outOfStockText: { color: 'white' },
  name: { marginTop: 8 },
  price: { marginTop: 2, color: '#111827' },
});
```

- [ ] **Step 6: Tạo `ProductGrid.tsx`**

`FlatList` không cho đổi `numColumns` "nóng" mà không remount — dùng `key` gắn theo `numColumns` để buộc remount khi đổi layout (tablet ⇄ phone).

```tsx
// src/features/catalog/components/ProductGrid.tsx
import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { EmptyState } from '../../../components/EmptyState';
import { ProductCard } from './ProductCard';
import { ProductCardSkeleton } from './ProductCardSkeleton';
import type { ProductViewModel } from '../types/catalog.types';

export interface ProductGridProps {
  products: ProductViewModel[];
  numColumns: number;
  isLoading: boolean;
  emptyMessage: string;
}

const SKELETON_COUNT = 6;

export const ProductGrid: React.FC<ProductGridProps> = ({ products, numColumns, isLoading, emptyMessage }) => {
  if (isLoading) {
    return (
      <FlatList
        data={Array.from({ length: SKELETON_COUNT }, (_, index) => index)}
        keyExtractor={(item) => `skeleton-${item}`}
        numColumns={numColumns}
        key={`skeleton-${numColumns}`}
        renderItem={() => <ProductCardSkeleton />}
        columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
        contentContainerStyle={styles.content}
      />
    );
  }

  if (products.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <FlatList
      data={products}
      keyExtractor={(item) => String(item.id)}
      numColumns={numColumns}
      key={`grid-${numColumns}`}
      renderItem={({ item }) => <ProductCard product={item} />}
      columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
      contentContainerStyle={styles.content}
    />
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  row: { gap: 12 },
});
```

- [ ] **Step 7: Verify (component UI thuần trình bày — không có test riêng theo Global Constraints)**

Run: `npm run type-check && npm run lint`
Expected: 0 lỗi.

- [ ] **Step 8: Commit**

```bash
git add src/utils/formatCurrency.ts src/features/catalog/components/SearchBar.tsx src/features/catalog/components/CategoryTabs.tsx src/features/catalog/components/ProductCardSkeleton.tsx src/features/catalog/components/ProductCard.tsx src/features/catalog/components/ProductGrid.tsx
git commit -m "feat: add catalog UI components (search, category tabs, product grid/card)"
```

---

### Task 6: `ProductArea` & tích hợp vào Sales Screen

**Files:**
- Create: `src/features/sales/components/ProductArea.tsx`
- Modify: `src/features/sales/screens/SalesScreen.tsx`
- Delete: `src/features/sales/components/ProductAreaPlaceholder.tsx`

**Interfaces:**
- Consumes: `useCatalog` (Task 4), `CatalogService.filterByCategory`/`searchProducts` (Task 2), `CategoryTabs`/`SearchBar`/`ProductGrid` (Task 5), `ALL_CATEGORY_ID`/`CategorySelection` (Task 1), `useSalesLayoutMode`/`SalesLayoutMode` (`src/features/sales/hooks/useSalesLayoutMode.ts`, đã có sẵn).
- Produces: `ProductArea: React.FC` — dùng trong `SalesScreen.tsx`.

- [ ] **Step 1: Tạo `ProductArea.tsx`**

```tsx
// src/features/sales/components/ProductArea.tsx
import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { EmptyState } from '../../../components/EmptyState';
import { CategoryTabs } from '../../catalog/components/CategoryTabs';
import { SearchBar } from '../../catalog/components/SearchBar';
import { ProductGrid } from '../../catalog/components/ProductGrid';
import { useCatalog } from '../../catalog/hooks/useCatalog';
import { CatalogService } from '../../catalog/services/CatalogService';
import { ALL_CATEGORY_ID } from '../../catalog/types/catalog.types';
import { useSalesLayoutMode } from '../hooks/useSalesLayoutMode';
import type { CategorySelection } from '../../catalog/types/catalog.types';
import type { SalesLayoutMode } from '../hooks/useSalesLayoutMode';

const NUM_COLUMNS_BY_LAYOUT: Record<SalesLayoutMode, number> = {
  'tablet-landscape': 3,
  'tablet-portrait': 2,
  phone: 2,
};

export const ProductArea: React.FC = () => {
  const layoutMode = useSalesLayoutMode();
  const { categories, products, isLoading, error, retry } = useCatalog();
  const [selectedCategoryId, setSelectedCategoryId] = useState<CategorySelection>(ALL_CATEGORY_ID);
  const [searchKeyword, setSearchKeyword] = useState('');

  const filteredProducts = useMemo(() => {
    const byCategory = CatalogService.filterByCategory(products, categories, selectedCategoryId);
    return CatalogService.searchProducts(byCategory, searchKeyword);
  }, [products, categories, selectedCategoryId, searchKeyword]);

  if (!isLoading && error) {
    return (
      <View style={styles.errorWrap}>
        <EmptyState message={error} />
        <Button mode="outlined" onPress={retry}>
          Thử lại
        </Button>
      </View>
    );
  }

  const trimmedKeyword = searchKeyword.trim();

  return (
    <View style={styles.container}>
      <CategoryTabs
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelect={setSelectedCategoryId}
      />
      <SearchBar value={searchKeyword} onChangeText={setSearchKeyword} />
      <ProductGrid
        products={filteredProducts}
        numColumns={NUM_COLUMNS_BY_LAYOUT[layoutMode]}
        isLoading={isLoading}
        emptyMessage={trimmedKeyword ? `Không tìm thấy sản phẩm "${trimmedKeyword}"` : 'Không có sản phẩm'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
});
```

- [ ] **Step 2: Sửa `SalesScreen.tsx`**

Nội dung hiện tại:

```tsx
// src/features/sales/screens/SalesScreen.tsx
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Modal, Portal, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopAppBar } from '../components/TopAppBar';
import { ProductAreaPlaceholder } from '../components/ProductAreaPlaceholder';
import { CartPanelPlaceholder } from '../components/CartPanelPlaceholder';
import { useSalesLayoutMode } from '../hooks/useSalesLayoutMode';

export const SalesScreen: React.FC = () => {
  const theme = useTheme();
  const layoutMode = useSalesLayoutMode();
  const [cartVisible, setCartVisible] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <TopAppBar />
      {layoutMode === 'phone' ? (
        <View style={styles.phoneBody}>
          <ProductAreaPlaceholder />
          <TouchableOpacity
            style={[styles.cartSummaryBar, { backgroundColor: theme.colors.primary }]}
            onPress={() => setCartVisible(true)}
          >
            <Text variant="titleSmall" style={styles.cartSummaryText}>
              0 sản phẩm · 0đ
            </Text>
          </TouchableOpacity>
          <Portal>
            <Modal
              visible={cartVisible}
              onDismiss={() => setCartVisible(false)}
              contentContainerStyle={styles.phoneCartModal}
            >
              <CartPanelPlaceholder />
            </Modal>
          </Portal>
        </View>
      ) : (
        <View style={styles.splitBody}>
          <View style={layoutMode === 'tablet-portrait' ? styles.productAreaPortrait : styles.productArea}>
            <ProductAreaPlaceholder />
          </View>
          <View style={layoutMode === 'tablet-portrait' ? styles.cartPanelPortrait : styles.cartPanel}>
            <CartPanelPlaceholder />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'white' },
  splitBody: { flex: 1, flexDirection: 'row' },
  productArea: { flex: 68 },
  productAreaPortrait: { flex: 55 },
  cartPanel: { flex: 32, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#E5E7EB' },
  cartPanelPortrait: { flex: 45, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#E5E7EB' },
  phoneBody: { flex: 1 },
  cartSummaryBar: {
    padding: 16,
    alignItems: 'center',
  },
  cartSummaryText: { color: 'white' },
  phoneCartModal: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    maxHeight: '80%',
  },
});
```

Thay bằng (chỉ đổi import và 2 chỗ dùng `ProductAreaPlaceholder` → `ProductArea`, giữ nguyên toàn bộ phần còn lại):

```tsx
// src/features/sales/screens/SalesScreen.tsx
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Modal, Portal, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopAppBar } from '../components/TopAppBar';
import { ProductArea } from '../components/ProductArea';
import { CartPanelPlaceholder } from '../components/CartPanelPlaceholder';
import { useSalesLayoutMode } from '../hooks/useSalesLayoutMode';

export const SalesScreen: React.FC = () => {
  const theme = useTheme();
  const layoutMode = useSalesLayoutMode();
  const [cartVisible, setCartVisible] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <TopAppBar />
      {layoutMode === 'phone' ? (
        <View style={styles.phoneBody}>
          <ProductArea />
          <TouchableOpacity
            style={[styles.cartSummaryBar, { backgroundColor: theme.colors.primary }]}
            onPress={() => setCartVisible(true)}
          >
            <Text variant="titleSmall" style={styles.cartSummaryText}>
              0 sản phẩm · 0đ
            </Text>
          </TouchableOpacity>
          <Portal>
            <Modal
              visible={cartVisible}
              onDismiss={() => setCartVisible(false)}
              contentContainerStyle={styles.phoneCartModal}
            >
              <CartPanelPlaceholder />
            </Modal>
          </Portal>
        </View>
      ) : (
        <View style={styles.splitBody}>
          <View style={layoutMode === 'tablet-portrait' ? styles.productAreaPortrait : styles.productArea}>
            <ProductArea />
          </View>
          <View style={layoutMode === 'tablet-portrait' ? styles.cartPanelPortrait : styles.cartPanel}>
            <CartPanelPlaceholder />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'white' },
  splitBody: { flex: 1, flexDirection: 'row' },
  productArea: { flex: 68 },
  productAreaPortrait: { flex: 55 },
  cartPanel: { flex: 32, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#E5E7EB' },
  cartPanelPortrait: { flex: 45, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#E5E7EB' },
  phoneBody: { flex: 1 },
  cartSummaryBar: {
    padding: 16,
    alignItems: 'center',
  },
  cartSummaryText: { color: 'white' },
  phoneCartModal: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    maxHeight: '80%',
  },
});
```

- [ ] **Step 3: Xoá `ProductAreaPlaceholder.tsx`**

```bash
git rm src/features/sales/components/ProductAreaPlaceholder.tsx
```

- [ ] **Step 4: Verify toàn bộ**

Run: `npm run verify`
Expected: type-check + lint + toàn bộ test suite đều PASS (bao gồm `__tests__/App.test.tsx` — vẫn render qua `RootNavigator` như cũ, không đổi hành vi Auth/Store selection).

- [ ] **Step 5: Commit**

```bash
git add src/features/sales/components/ProductArea.tsx src/features/sales/screens/SalesScreen.tsx
git commit -m "feat: replace ProductAreaPlaceholder with real catalog display"
```

---

### Task 7: Manual verify — xem catalog thật trên thiết bị/emulator/web

**Files:** không tạo/sửa file — bước xác nhận thủ công.

- [ ] **Step 1: Build và chạy app**

Run: `npm run android` (hoặc `npm run web`)
Expected: đăng nhập → chọn cửa hàng (nếu cần) → vào Sales, thấy Category Tabs ("Tất cả" + danh mục thật), Search Bar, và lưới sản phẩm thật của cửa hàng (ảnh/placeholder 🧋, tên, giá `xxx.xxxđ`, badge nếu sản phẩm có tag).

- [ ] **Step 2: Đổi danh mục**

Bấm 1 tab danh mục khác "Tất cả".
Expected: lưới chỉ còn sản phẩm thuộc danh mục đó (và danh mục con nếu có), cuộn về đầu, không gọi lại API (không thấy skeleton lần nữa).

- [ ] **Step 3: Tìm kiếm**

Gõ 1 từ khoá khớp tên hoặc SKU 1 sản phẩm.
Expected: lưới lọc real-time không cần Enter, xoá bằng nút ✕ trên Search Bar quay lại danh mục đang chọn.

- [ ] **Step 4: Sản phẩm hết hàng (nếu cửa hàng test có)**

Expected: card mờ, có nhãn "HẾT HÀNG", không bấm được (dù bấm cũng không có hành động — đúng phạm vi đã chốt).

- [ ] **Step 5: Lỗi/rỗng**

Nếu có thể, thử với cửa hàng chưa có sản phẩm hoặc ngắt mạng khi vào Sales.
Expected: `EmptyState` phù hợp + nút "Thử lại" khi lỗi fetch, không crash.

- [ ] **Step 6: Xác nhận và báo cáo**

Nếu các bước trên đạt, sub-project Product catalog hoàn tất.
