# Auth (Đăng nhập) — Design

> Sub-project đầu tiên trong chuỗi "kết nối API POS thật" (xem thảo luận brainstorming): Auth → Store context → Product catalog → Cart & modifier → Order creation. Auth là nền tảng bắt buộc — mọi endpoint backend khác đều yêu cầu Bearer token.
>
> Mirror kiến trúc `BaseClient`/`authStore` của NDTCore.FE, dùng chung backend production (`https://api.soliteavn.com/api`), cùng endpoint `POST /admin/auth/login` — không có endpoint đăng nhập riêng cho POS.

## 1. Mục tiêu

Cho phép thu ngân đăng nhập trên NDTCore.App bằng email/password, giữ phiên đăng nhập cả ngày làm việc (auto-refresh token khi hết hạn), và gate toàn bộ app (Sales/Settings) sau màn đăng nhập.

Ngoài phạm vi: đăng ký tài khoản mới (POS không cần tự đăng ký), chọn store/cửa hàng (sub-project riêng kế tiếp), bất kỳ API nghiệp vụ nào khác (catalog, order...).

## 2. Cấu hình & HTTP Client

Thêm dependency `react-native-config` — đọc biến môi trường từ file `.env` (root) vào JS qua `Config.API_BASE_URL`, chuẩn bị sẵn hạ tầng multi-env dù hiện tại chỉ có 1 giá trị (giống cách NDTCore.FE đang dùng chung 1 URL cho dev/prod).

```
.env (mới, root, commit vào git — không phải secret, giống .env.development/.env.production của FE)
  API_BASE_URL=https://api.soliteavn.com/api
```

`src/services/http/HttpClient.ts` (mới) — base class dùng `axios`, mirror `BaseClient` của FE:

- Request interceptor: gắn header `Authorization: Bearer <token>` từ `StorageService` (key `auth.tokens`) nếu có, trừ request đánh dấu `skipAuth`.
- Response interceptor:
  - 401 với lỗi hết hạn access token → gọi refresh token (dùng shared promise — nhiều request 401 cùng lúc chỉ trigger 1 lần refresh, các request khác chờ chung kết quả), gắn token mới, replay request gốc.
  - Refresh thất bại (refresh token cũng hết hạn) → phát event `session-expired` (dùng `EventEmitter` sẵn có của Node/RN polyfill, không cần thư viện mới) — `authSlice` lắng nghe và tự logout.
  - Lỗi 5xx (429/500/502/503/504) trên request idempotent (GET/HEAD/PUT/DELETE) → retry với backoff (tối đa 3 lần), giữ nguyên policy của FE.
- Parse response theo `ApiResponse<T>` (mục 4).

`axios` là dependency mới (chưa có trong `NDTCore.App`) — cần thiết vì interceptor là cách duy nhất làm auto-refresh + retry gọn, dùng `fetch` trần sẽ phải tự viết lại cơ chế này bằng tay.

## 3. Auth feature module (`src/features/auth/`)

Theo đúng pattern feature module đã có (`printer`, `settings`, `sales`):

```
src/features/auth/
├── types/auth.types.ts
│     LoginRequest { email: string; password: string }              — camelCase, dùng trong form/internal
│     LoginResponseDto { AccessToken, RefreshToken,
│                         AccessTokenExpiration, RefreshTokenExpiration }  — PascalCase, khớp response backend
│     AuthTokenModel { accessToken, refreshToken,
│                       accessTokenExpiration, refreshTokenExpiration }    — camelCase, lưu storage
├── schemas/loginFormSchema.ts     — Zod: email đúng định dạng, password không rỗng
├── api/authApi.ts                 — loginAsync(payload: LoginRequest): Promise<ApiResponse<LoginResponseDto>>
│                                     refreshAsync(refreshToken: string): Promise<ApiResponse<LoginResponseDto>>
│                                     (cả hai gọi qua HttpClient, POST /admin/auth/login và /admin/auth/refresh)
├── services/AuthService.ts        — login(payload): gọi authApi.loginAsync → map DTO → AuthTokenModel → StorageService.setItem('auth.tokens', ...)
│                                     logout(): StorageService.removeItem('auth.tokens')
│                                     getStoredToken(): AuthTokenModel | null — đọc đồng bộ từ StorageService
├── store/authSlice.ts             — Redux Toolkit
│                                     state: { isLoggedIn: boolean; isLoading: boolean; error: string | null }
│                                     initial state tính đồng bộ: isLoggedIn = AuthService.getStoredToken() !== null
│                                     thunk login(payload), action logout()
│                                     subscribe HttpClient's 'session-expired' event → dispatch logout()
├── components/LoginForm.tsx       — email/password field (AppInput), nút submit (AppButton)
└── screens/LoginScreen.tsx        — layout căn giữa, LoginForm, hiển thị error
```

**Khác biệt có chủ đích so với FE:** FE dùng Pinia store với `initialize()` async (đọc token, phải chờ trước khi biết `isLoggedIn`). NDTCore.App dùng MMKV (native) / localStorage (web) — cả hai đều đọc **đồng bộ** — nên `isLoggedIn` tính được ngay lúc `configureStore()` chạy, không cần async init hay màn hình loading chờ như FE.

## 4. Response shape & error hiển thị

Mirror `ApiResponse<T>` của backend (dùng chung mọi endpoint, FE đã định nghĩa):

```ts
interface ApiResponse<T> {
  IsSuccess: boolean;
  Data: T | null;
  Message: string | null;
  Error: { ErrorCode: string; Message: string; Meta?: unknown } | null;
}
```

`HttpClient` parse theo shape này; khi `IsSuccess: false`, ném lỗi mang `Error.Message` (tiếng Việt, do backend trả sẵn) — hiển thị thẳng cho thu ngân, không cần tự dịch.

`LoginScreen` hiển thị lỗi dưới form (text, không cần dialog/toast — chưa có hạ tầng thông báo nào khác trong app, không thêm mới cho một trường hợp).

## 5. Bổ sung nhỏ vào `AppInput`

Thêm prop optional `secureTextEntry?: boolean` (mặc định `false`) — cần cho field password. Không đổi behavior các chỗ đang dùng `AppInput` khác.

## 6. Navigation gating

`RootNavigator.tsx` hiện là `Tab.Navigator` (Sales/Settings) render thẳng trong `NavigationContainer`. Thêm 1 lớp điều kiện theo `isLoggedIn`:

```tsx
export const RootNavigator: React.FC = () => {
  const isLoggedIn = useSelector((s: RootState) => s.auth.isLoggedIn);

  return (
    <NavigationContainer>
      {isLoggedIn ? <AppTabs /> : <AuthStack />}
    </NavigationContainer>
  );
};
```

- `AppTabs` — `Tab.Navigator` (Sales/Settings) hiện có, tách nguyên si thành component riêng trong cùng file, không đổi logic bên trong.
- `AuthStack` — native-stack mới, chỉ có `LoginScreen`.

Vì `isLoggedIn` đọc đồng bộ (mục 3), `RootNavigator` render đúng màn ngay từ frame đầu tiên.

Khi `HttpClient` phát event `session-expired` (mục 2) → `authSlice` tự `logout()` → `isLoggedIn` chuyển `false` → `RootNavigator` tự động chuyển về `LoginScreen`.

## 7. Testing

Theo convention hiện có: file logic thuần có test riêng — `HttpClient` (interceptor logic, retry/refresh), `AuthService`, `authSlice` (reducer/thunk). `LoginScreen`/`LoginForm` (UI trình bày) không có test riêng — verify qua type-check + lint + chạy thử trên thiết bị/emulator/web.

## 8. Ngoài phạm vi

- Đăng ký tài khoản (`RegisterRequest`) — backend có endpoint nhưng POS không cần tự đăng ký.
- Chọn store/cửa hàng sau đăng nhập — sub-project kế tiếp.
- Lấy/hiển thị thông tin profile người dùng sau đăng nhập — chưa cần thiết cho sub-project này, thêm khi có màn hình thật sự cần hiển thị (vd Settings > tài khoản).
- Bất kỳ API nghiệp vụ nào khác (catalog, cart, order).
