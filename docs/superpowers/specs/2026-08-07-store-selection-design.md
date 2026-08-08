# Store Selection — Design

> Sub-project thứ hai trong chuỗi "kết nối API POS thật": Auth → **Store selection** → Product catalog → Cart & modifier → Order creation. Bắt buộc trước Product catalog vì mọi endpoint POS (catalog, ca làm việc, đơn hàng...) đều cần `storeId`.
>
> Làm tiếp trên branch `feature/pos-auth-login` (không tách branch mới) — gắn chặt với Auth, không thể test độc lập nếu thiếu đăng nhập.

## 1. Mục tiêu

Sau khi đăng nhập, xác định `storeId` thu ngân sẽ làm việc: tự động chọn nếu tài khoản chỉ quản lý 1 cửa hàng, hoặc hiện màn chọn nếu quản lý nhiều cửa hàng. Lưu lựa chọn để không phải chọn lại mỗi lần mở app. Cho phép đổi cửa hàng từ Settings.

Ngoài phạm vi: tạo/sửa/xoá store (CRUD admin), quản lý thành viên store, dữ liệu POS khác (ca làm việc, catalog, đơn hàng — sub-project kế tiếp).

## 2. Luồng tổng thể

Sau đăng nhập thành công → gọi `GET /admin/store` (cùng Bearer token; backend tự scope kết quả theo quyền tài khoản — không lọc phía client, đúng cách NDTCore.FE đang làm):

- 0 store → hiện trạng thái lỗi "Tài khoản chưa được gán cửa hàng nào — liên hệ quản trị viên".
- 1 store → tự động chọn, lưu `storeId`, vào thẳng Sales.
- ≥2 store → hiện màn chọn, thu ngân bấm để chọn.

`storeId` được lưu qua `StorageService` (giống pattern `auth.tokens`), giữ nguyên qua các lần mở app — chỉ mất khi đăng xuất hoặc thu ngân chủ động bấm "Đổi cửa hàng" trong Settings (không đăng xuất, chỉ xoá `storeId` để quay lại màn chọn).

## 3. HttpClient — hỗ trợ response phân trang

Response phân trang của backend đặt `PageNumber`/`PageSize`/`TotalCount`/`TotalPages`/`HasPreviousPage`/`HasNextPage` **ngang hàng** với `IsSuccess`/`Data`/`Message`/`Error` (không lồng bên trong `Data`) — khác hình dạng `ApiResponse<T>` hiện có.

Thêm vào `src/types/ApiResponse.ts`:

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

Thêm method mới vào `HttpClient` (không đổi `get`/`post` hiện có):

```ts
getPaged: async <T>(url: string, config?: Partial<HttpRequestConfig>): Promise<PagedApiResponse<T>> => {
  const response = await instance.get<PagedApiResponse<T>>(url, config);
  return response.data;
},
```

## 4. Data layer (`src/features/store/`)

Theo đúng pattern feature module đã có (`auth`, `printer`, `settings`, `sales`):

```
src/features/store/
├── types/store.types.ts
│     StoreDto { Id, Name, Code, LogoUrl, IsActive, IsAcceptingOrders,
│                Address, District, Province }         — PascalCase, khớp backend
│                (chỉ field thật sự hiển thị trên card — không lấy hết field
│                backend trả về, vd TenantId/BrandId/Latitude/... không dùng)
│     StoreViewModel — camelCase, tương ứng 1-1 với StoreDto
├── api/storeApi.ts
│     storeApi.getPagedAsync(): Promise<PagedApiResponse<StoreDto>>
│     — GET /admin/store, PageNumber=1, PageSize đủ lớn (vd 100 — 1 tài khoản
│       hiếm khi quản lý quá 100 store, không cần phân trang thật ở UI)
├── services/StoreService.ts
│     fetchStores(): Promise<StoreViewModel[]> — gọi storeApi, map DTO→ViewModel
│     saveStoreId(id): void / getStoredStoreId(): number | null / clearStoreId(): void
│     — qua StorageService, key 'store.currentId'
└── store/storeSlice.ts
      state: { storeId: number | null; availableStores: StoreViewModel[];
               isLoading: boolean; error: string | null }
      initial storeId: đọc đồng bộ từ StoreService.getStoredStoreId() lúc module-load
      (giống cách authSlice đọc token — MMKV/localStorage đều sync)
      reducers thuần: storesLoadStarted, storesLoaded, storesLoadFailed,
                        storeSelected(storeId), storeCleared
```

## 5. Navigation gating (3 trạng thái)

`RootNavigator` hiện chỉ có 2 nhánh (`isLoggedIn` → `AppTabs` hoặc `AuthStack`). Thêm nhánh thứ 3:

```tsx
const isLoggedIn = useSelector(selectIsLoggedIn);
const storeId = useSelector(selectCurrentStoreId);

if (!isLoggedIn) return <AuthStack />;
if (!storeId) return <StoreSelectStack />;
return <AppTabs />;
```

`StoreSelectStack` — native-stack mới, chỉ có `StoreSelectScreen`.

`StoreSelectScreen` tự fetch danh sách store trong `useEffect` lúc mount (không fetch ngay trong `useAuth.login()` — giữ `useAuth` chỉ lo đăng nhập, tách trách nhiệm rõ ràng). Nếu fetch trả về đúng 1 store, tự động lưu `storeId` — Redux cập nhật, `RootNavigator` tự chuyển sang `AppTabs` ngay.

## 6. `StoreSelectScreen` UI

Mirror `SalesView.vue` (FE) nhưng đơn giản hoá — bỏ tìm kiếm/phân trang thật (số store 1 tài khoản quản lý thường nhỏ, không phải danh sách admin toàn hệ thống):

- Tiêu đề "Chọn cửa hàng".
- Grid card cho mỗi store: tên, mã, địa chỉ (`address, district, province` nối bằng dấu phẩy), badge "Đang nhận đơn" nếu `isAcceptingOrders`, disabled nếu `!isActive`. Bấm card để chọn.
- Trạng thái loading (`LoadingOverlay` đã có sẵn), trạng thái rỗng/lỗi (`EmptyState` đã có sẵn, message tương ứng).

**"Đổi cửa hàng"** trong `SettingsSidebar` — thêm 1 item cạnh "Đăng xuất" (cùng `ConfirmDialog` pattern), bấm vào dispatch `storeCleared()` (không đăng xuất) → `RootNavigator` tự quay về `StoreSelectScreen`.

## 7. Testing

`StoreService`, `storeSlice` (logic thuần) có test riêng. `storeApi.ts` (khai báo thuần, giống `authApi.ts`) và `StoreSelectScreen`/`SettingsSidebar` (UI trình bày) không có test riêng — verify qua type-check + lint + chạy thử.

## 8. Ngoài phạm vi

- CRUD store, quản lý thành viên store (`StoreMemberApi`).
- Ca làm việc (shift), catalog sản phẩm, đơn hàng — sub-project kế tiếp.
- Phân trang thật cho danh sách store (giả định 1 tài khoản không quản lý quá ~100 store).
- **Revalidate `storeId` đã lưu lúc khởi động app** — hiện tại app tin tưởng `storeId` trong MMKV vô thời hạn, không gọi lại `GET /admin/store` để xác nhận cửa hàng đó vẫn tồn tại/còn active/tài khoản vẫn còn quyền. Phát hiện trong final review của sub-project này (2026-08-08) — nếu quyền bị thu hồi hoặc store bị vô hiệu hoá phía server, app vẫn tiếp tục hoạt động với `storeId` cũ cho đến khi 1 API POS nào đó trả lỗi (chưa xử lý). Sub-project kế tiếp (Product catalog) nên cân nhắc: khi có `storeId` đã lưu, fetch lại danh sách store ở background lúc khởi động và `storeCleared()` nếu `storeId` không còn trong danh sách trả về — đồng thời đây cũng là chỗ tự nhiên để lấy tên/thông tin cửa hàng hiện tại hiển thị trong Settings (hiện app chỉ biết `storeId`, không biết tên).
