# Auth (Login) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho thu ngân đăng nhập bằng email/password (backend thật `https://api.soliteavn.com/api`), giữ phiên cả ngày qua auto-refresh token, và gate toàn bộ app (Sales/Settings) sau màn đăng nhập.

**Architecture:** `HttpClient` (axios) là điểm gọi API duy nhất, tự gắn Bearer token + tự refresh khi 401 + retry backoff khi 5xx. `authSlice` (Redux, reducer thuần — không dùng `createAsyncThunk`, theo đúng pattern `printerSlice` đã có) giữ `isLoggedIn`; orchestration async nằm trong hook `useAuth` (theo đúng pattern `usePrinterConnection`). `RootNavigator` chọn `AuthStack` hay `AppTabs` dựa trên `isLoggedIn`.

**Tech Stack:** `axios` (mới), `react-native-config` (mới), `axios-mock-adapter` (mới, devDependency — test `HttpClient` không cần network thật), Redux Toolkit, Zod (đã có).

## Global Constraints

- TypeScript strict, không dùng `any`.
- Không có path alias — mọi import dùng relative path.
- Toàn bộ text hiển thị cho người dùng: tiếng Việt.
- File logic thuần (service, slice, http client) có test riêng. Component UI thuần trình bày (`LoginForm`, `LoginScreen`) không có test riêng — verify qua type-check + lint + chạy thử.
- Redux slice trong project này luôn là reducer thuần — không dùng `createAsyncThunk`. Orchestration async nằm trong hook, theo đúng pattern `usePrinterConnection.ts` đã có.
- Chạy `npm run verify` (type-check + lint + test) trước mỗi commit.
- Base URL API: `https://api.soliteavn.com/api` — dùng chung với NDTCore.FE, cùng backend production.
- Endpoint: `POST /admin/auth/login` (`{Email, Password}` → `{AccessToken, RefreshToken, AccessTokenExpiration, RefreshTokenExpiration}`), `POST /admin/auth/refresh`.
- Ngoài phạm vi: đăng ký tài khoản, chọn store/cửa hàng, lấy profile người dùng, mọi API nghiệp vụ khác (catalog/cart/order).

---

### Task 1: `react-native-config` — cấu hình `.env`

**Files:**
- Create: `.env`
- Modify: `android/app/build.gradle`

**Interfaces:**
- Consumes: không phụ thuộc task trước.
- Produces: `import Config from 'react-native-config'; Config.API_BASE_URL` — dùng ở Task 3 (`HttpClient`).

- [ ] **Step 1: Cài dependency**

Run: `npm install react-native-config`

- [ ] **Step 2: Tạo `.env`**

```
API_BASE_URL=https://api.soliteavn.com/api
```

- [ ] **Step 3: Wiring Android — thêm dòng cuối `android/app/build.gradle`**

Mở `android/app/build.gradle`, thêm dòng sau vào **cuối file** (sau block `dependencies { ... }` hiện có):

```gradle
apply from: project(':react-native-config').projectDir.getPath() + "/dotenv.gradle"
```

Đây là bước wiring thủ công bắt buộc của `react-native-config` trên Android (không nằm trong autolinking mặc định của RN CLI).

- [ ] **Step 4: iOS**

Không cần sửa gì thêm phía code — `react-native-config` autolink qua CocoaPods, đọc `Config.X` từ JS side hoạt động ngay sau khi chạy `pod install`. Bước `pod install` thật sự (cần macOS/Xcode) nằm trong phạm vi Task 9 (Manual verify) — không kiểm chứng được trong môi trường viết plan này.

- [ ] **Step 5: Verify phía JS**

Run: `npm run type-check`
Expected: 0 lỗi — `react-native-config` tự bundle type declaration (`Config: {[key: string]: string}`), không cần khai báo ambient module thủ công. Nếu type-check báo "Cannot find module 'react-native-config'", dừng lại và kiểm tra `node_modules/react-native-config/index.d.ts` có tồn tại không trước khi tự viết declaration — không đoán.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env android/app/build.gradle
git commit -m "feat: add react-native-config for API base URL"
```

---

### Task 2: `ApiResponse<T>`, session-expired pub-sub, & token storage dùng chung

**Files:**
- Create: `src/types/ApiResponse.ts`
- Create: `src/services/http/sessionEvents.ts`
- Create: `src/services/http/sessionEvents.test.ts`
- Create: `src/services/http/authTokenStorage.ts`
- Create: `src/services/http/authTokenStorage.test.ts`

**Interfaces:**
- Consumes: `StorageService` (`src/services/StorageService.ts`).
- Produces:
  - `ApiResponse<T>`, `ApiResponseError` (dùng ở Task 3, Task 4).
  - `onSessionExpired(listener: () => void): () => void` và `emitSessionExpired(): void` (dùng ở Task 3 — `HttpClient` gọi `emitSessionExpired()` khi refresh thất bại; Task 7 — `useAuth` hook lắng nghe qua `onSessionExpired`).
  - `AuthTokenModel { accessToken, refreshToken, accessTokenExpiration, refreshTokenExpiration }`, `getStoredTokens(): AuthTokenModel | null`, `saveTokens(tokens: AuthTokenModel): void`, `clearTokens(): void` — **module duy nhất** đọc/ghi key storage `'auth.tokens'`. Dùng ở Task 3 (`HttpClient` đọc token để gắn Bearer, ghi token mới sau refresh, xoá khi hết phiên) và Task 5 (`AuthService` ghi token sau login, xoá khi logout, đọc để tính trạng thái đăng nhập ban đầu). Gom vào đây (thay vì để `HttpClient`/`AuthService` mỗi bên tự gọi `StorageService` với key riêng) để tránh 2 nơi định nghĩa trùng cùng 1 key string — lệch nhau là lỗi im lặng khó phát hiện.

- [ ] **Step 1: Tạo `ApiResponse.ts`**

```ts
// src/types/ApiResponse.ts
export interface ApiResponseError {
  ErrorCode: string;
  Message: string;
  Meta?: unknown;
}

export interface ApiResponse<T> {
  IsSuccess: boolean;
  Data: T | null;
  Message: string | null;
  Error: ApiResponseError | null;
}
```

- [ ] **Step 2: Viết test cho `sessionEvents.ts` (thất bại trước vì file chưa tồn tại)**

```ts
// src/services/http/sessionEvents.test.ts
import { onSessionExpired, emitSessionExpired } from './sessionEvents';

describe('sessionEvents', () => {
  it('calls registered listeners when session expires', () => {
    const listener = jest.fn();
    const unsubscribe = onSessionExpired(listener);
    emitSessionExpired();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('unsubscribe stops future notifications', () => {
    const listener = jest.fn();
    const unsubscribe = onSessionExpired(listener);
    unsubscribe();
    emitSessionExpired();
    expect(listener).not.toHaveBeenCalled();
  });

  it('supports multiple independent listeners', () => {
    const first = jest.fn();
    const second = jest.fn();
    const unsubscribeFirst = onSessionExpired(first);
    const unsubscribeSecond = onSessionExpired(second);
    emitSessionExpired();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    unsubscribeFirst();
    unsubscribeSecond();
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận FAIL**

Run: `npx jest sessionEvents.test.ts`
Expected: FAIL — Cannot find module `./sessionEvents`.

- [ ] **Step 4: Viết implementation**

```ts
// src/services/http/sessionEvents.ts
type Listener = () => void;

let listeners: Listener[] = [];

export const onSessionExpired = (listener: Listener): (() => void) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
};

export const emitSessionExpired = (): void => {
  listeners.forEach((listener) => listener());
};
```

- [ ] **Step 5: Chạy test, xác nhận PASS**

Run: `npx jest sessionEvents.test.ts`
Expected: PASS — 3 test đều xanh.

- [ ] **Step 6: Viết test cho `authTokenStorage.ts` (thất bại trước vì file chưa tồn tại)**

```ts
// src/services/http/authTokenStorage.test.ts
import { getStoredTokens, saveTokens, clearTokens } from './authTokenStorage';

const sampleTokens = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  accessTokenExpiration: '2099-01-01T00:00:00Z',
  refreshTokenExpiration: '2099-01-01T00:00:00Z',
};

describe('authTokenStorage', () => {
  afterEach(() => {
    clearTokens();
  });

  it('returns null when nothing is stored', () => {
    expect(getStoredTokens()).toBeNull();
  });

  it('round-trips tokens through saveTokens/getStoredTokens', () => {
    saveTokens(sampleTokens);
    expect(getStoredTokens()).toEqual(sampleTokens);
  });

  it('clearTokens removes the stored tokens', () => {
    saveTokens(sampleTokens);
    clearTokens();
    expect(getStoredTokens()).toBeNull();
  });
});
```

- [ ] **Step 7: Chạy test, xác nhận FAIL**

Run: `npx jest authTokenStorage.test.ts`
Expected: FAIL — Cannot find module `./authTokenStorage`.

- [ ] **Step 8: Viết implementation**

```ts
// src/services/http/authTokenStorage.ts
import { StorageService } from '../StorageService';

const AUTH_TOKENS_KEY = 'auth.tokens';

export interface AuthTokenModel {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiration: string;
  refreshTokenExpiration: string;
}

export const getStoredTokens = (): AuthTokenModel | null =>
  StorageService.getItem<AuthTokenModel>(AUTH_TOKENS_KEY);

export const saveTokens = (tokens: AuthTokenModel): void => StorageService.setItem(AUTH_TOKENS_KEY, tokens);

export const clearTokens = (): void => StorageService.removeItem(AUTH_TOKENS_KEY);
```

- [ ] **Step 9: Chạy test, xác nhận PASS**

Run: `npx jest authTokenStorage.test.ts`
Expected: PASS — 3 test đều xanh.

- [ ] **Step 10: Verify toàn bộ**

Run: `npm run verify`

- [ ] **Step 11: Commit**

```bash
git add src/types/ApiResponse.ts src/services/http/sessionEvents.ts src/services/http/sessionEvents.test.ts src/services/http/authTokenStorage.ts src/services/http/authTokenStorage.test.ts
git commit -m "feat: add ApiResponse type, session-expired pub-sub, and shared auth token storage"
```

---

### Task 3: `HttpClient` — axios client với Bearer token, auto-refresh, retry

**Files:**
- Create: `src/services/http/refreshTokenRequest.ts`
- Create: `src/services/http/HttpClient.ts`
- Create: `src/services/http/HttpClient.test.ts`

**Interfaces:**
- Consumes: `ApiResponse<T>`, `onSessionExpired`/`emitSessionExpired`, `AuthTokenModel`/`getStoredTokens`/`saveTokens`/`clearTokens` (tất cả từ Task 2 — `HttpClient` KHÔNG tự gọi `StorageService` trực tiếp, chỉ qua `authTokenStorage`), `Config` (`react-native-config`, Task 1).
- Produces: `export const HttpClient: { get<T>(url, config?): Promise<ApiResponse<T>>; post<T, D>(url, data?, config?): Promise<ApiResponse<T>> }` — dùng ở Task 4 (`authApi`). `export const createHttpClient(axiosInstance: AxiosInstance)` — factory dùng lại ở test và ở `HttpClient` chính, KHÔNG dùng ở feature code (feature code chỉ import `HttpClient`).

Lưu ý kiến trúc: `HttpClient` không phải class base để subclass theo domain (khác `BaseClient` của FE, vốn có nhiều client con theo domain vì backend FE tách nhiều base URL). Dự án này chỉ có 1 base URL — dùng 1 instance duy nhất, tránh trừu tượng hoá không cần thiết.

`refreshTokenRequest.ts` tách riêng khỏi `HttpClient.ts` để tránh phụ thuộc vòng: `HttpClient`'s response interceptor cần gọi refresh khi 401, nhưng nếu gọi qua chính `HttpClient` thì request refresh cũng sẽ chạy qua interceptor đó — vòng lặp. `refreshTokenRequest` dùng `axios` trần, không qua `HttpClient`.

- [ ] **Step 1: Tạo `refreshTokenRequest.ts`**

```ts
// src/services/http/refreshTokenRequest.ts
import axios from 'axios';
import Config from 'react-native-config';
import type { ApiResponse } from '../../types/ApiResponse';

export interface RefreshTokenResponseDto {
  AccessToken: string;
  RefreshToken: string;
  AccessTokenExpiration: string;
  RefreshTokenExpiration: string;
}

export const refreshTokenRequest = async (refreshToken: string): Promise<RefreshTokenResponseDto> => {
  const response = await axios.post<ApiResponse<RefreshTokenResponseDto>>(
    `${Config.API_BASE_URL}/admin/auth/refresh`,
    { RefreshToken: refreshToken },
  );

  if (!response.data.IsSuccess || !response.data.Data) {
    throw new Error(response.data.Error?.Message ?? 'Không thể làm mới phiên đăng nhập');
  }

  return response.data.Data;
};
```

- [ ] **Step 2: Cài `axios-mock-adapter` (chỉ để test)**

Run: `npm install -D axios-mock-adapter`

- [ ] **Step 3: Viết test cho `HttpClient` (thất bại trước vì file chưa tồn tại)**

```ts
// src/services/http/HttpClient.test.ts
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { createHttpClient } from './HttpClient';
import { getStoredTokens, saveTokens, clearTokens } from './authTokenStorage';
import { onSessionExpired } from './sessionEvents';

jest.mock('./refreshTokenRequest', () => ({
  refreshTokenRequest: jest.fn(),
}));

import { refreshTokenRequest } from './refreshTokenRequest';

const setStoredTokens = (accessToken: string, refreshToken: string): void => {
  saveTokens({
    accessToken,
    refreshToken,
    accessTokenExpiration: '2099-01-01T00:00:00Z',
    refreshTokenExpiration: '2099-01-01T00:00:00Z',
  });
};

describe('HttpClient', () => {
  let mock: MockAdapter;
  let client: ReturnType<typeof createHttpClient>;

  beforeEach(() => {
    const instance = axios.create({ baseURL: 'http://test.local' });
    mock = new MockAdapter(instance);
    client = createHttpClient(instance);
    clearTokens();
    jest.clearAllMocks();
  });

  afterEach(() => {
    mock.restore();
  });

  it('attaches Bearer token when a token is stored', async () => {
    setStoredTokens('access-1', 'refresh-1');
    mock.onGet('/ping').reply((config) => {
      expect(config.headers?.Authorization).toBe('Bearer access-1');
      return [200, { IsSuccess: true, Data: { ok: true }, Message: null, Error: null }];
    });

    const result = await client.get<{ ok: boolean }>('/ping');
    expect(result.Data).toEqual({ ok: true });
  });

  it('does not attach Authorization header when no token stored', async () => {
    mock.onGet('/ping').reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined();
      return [200, { IsSuccess: true, Data: null, Message: null, Error: null }];
    });

    await client.get('/ping');
  });

  it('retries a GET request on 503 up to the retry policy', async () => {
    setStoredTokens('access-1', 'refresh-1');
    mock
      .onGet('/flaky')
      .replyOnce(503)
      .onGet('/flaky')
      .replyOnce(503)
      .onGet('/flaky')
      .reply(200, { IsSuccess: true, Data: { attempt: 3 }, Message: null, Error: null });

    const result = await client.get<{ attempt: number }>('/flaky');
    expect(result.Data).toEqual({ attempt: 3 });
  }, 15000);

  it('refreshes the access token on 401 and retries the original request', async () => {
    setStoredTokens('expired-access', 'refresh-1');
    (refreshTokenRequest as jest.Mock).mockResolvedValue({
      AccessToken: 'fresh-access',
      RefreshToken: 'fresh-refresh',
      AccessTokenExpiration: '2099-01-01T00:00:00Z',
      RefreshTokenExpiration: '2099-01-01T00:00:00Z',
    });

    let callCount = 0;
    mock.onGet('/secure').reply((config) => {
      callCount += 1;
      if (callCount === 1) {
        expect(config.headers?.Authorization).toBe('Bearer expired-access');
        return [401];
      }
      expect(config.headers?.Authorization).toBe('Bearer fresh-access');
      return [200, { IsSuccess: true, Data: { ok: true }, Message: null, Error: null }];
    });

    const result = await client.get<{ ok: boolean }>('/secure');
    expect(result.Data).toEqual({ ok: true });
    expect(refreshTokenRequest).toHaveBeenCalledWith('refresh-1');
    expect(getStoredTokens()).toMatchObject({ accessToken: 'fresh-access' });
  });

  it('emits session-expired and clears stored tokens when refresh itself fails', async () => {
    setStoredTokens('expired-access', 'dead-refresh');
    (refreshTokenRequest as jest.Mock).mockRejectedValue(new Error('refresh token expired'));

    const listener = jest.fn();
    const unsubscribe = onSessionExpired(listener);

    mock.onGet('/secure').reply(401);

    await expect(client.get('/secure')).rejects.toBeDefined();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getStoredTokens()).toBeNull();

    unsubscribe();
  });
});
```

- [ ] **Step 4: Chạy test, xác nhận FAIL**

Run: `npx jest HttpClient.test.ts`
Expected: FAIL — Cannot find module `./HttpClient`.

- [ ] **Step 5: Viết implementation**

```ts
// src/services/http/HttpClient.ts
import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import Config from 'react-native-config';
import type { ApiResponse } from '../../types/ApiResponse';
import { refreshTokenRequest } from './refreshTokenRequest';
import { emitSessionExpired } from './sessionEvents';
import { getStoredTokens, saveTokens, clearTokens, type AuthTokenModel } from './authTokenStorage';

interface HttpRequestConfig extends InternalAxiosRequestConfig {
  skipAuth?: boolean;
  skipAuthRefresh?: boolean;
  retryCount?: number;
  isRetryAfterRefresh?: boolean;
}

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const IDEMPOTENT_METHODS = new Set(['get', 'head', 'put', 'delete']);
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

const backoffDelay = (retryCount: number): number => {
  const base = 2 ** retryCount * RETRY_BASE_DELAY_MS;
  const jitter = base * 0.25 * (Math.random() * 2 - 1);
  return Math.round(base + jitter);
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const createHttpClient = (instance: AxiosInstance) => {
  let sharedRefreshPromise: Promise<string> | null = null;

  const shouldRetry = (config: HttpRequestConfig, error: AxiosError): boolean => {
    const method = config.method?.toLowerCase() ?? '';
    const retryCount = config.retryCount ?? 0;
    return (
      retryCount < MAX_RETRIES &&
      IDEMPOTENT_METHODS.has(method) &&
      (!error.response || RETRYABLE_STATUSES.has(error.response.status))
    );
  };

  const scheduleRetry = async (config: HttpRequestConfig): Promise<AxiosResponse> => {
    config.retryCount = (config.retryCount ?? 0) + 1;
    await sleep(backoffDelay(config.retryCount));
    return instance.request(config);
  };

  const refreshAccessToken = async (): Promise<string> => {
    const tokens = getStoredTokens();
    if (!tokens?.refreshToken) throw new Error('Không có refresh token');

    const data = await refreshTokenRequest(tokens.refreshToken);
    const nextTokens: AuthTokenModel = {
      accessToken: data.AccessToken,
      refreshToken: data.RefreshToken,
      accessTokenExpiration: data.AccessTokenExpiration,
      refreshTokenExpiration: data.RefreshTokenExpiration,
    };
    saveTokens(nextTokens);
    return nextTokens.accessToken;
  };

  const expireSession = (): void => {
    clearTokens();
    emitSessionExpired();
  };

  const handleRefresh = async (error: AxiosError, config: HttpRequestConfig): Promise<AxiosResponse> => {
    if (config.isRetryAfterRefresh) {
      expireSession();
      return Promise.reject(error);
    }
    config.isRetryAfterRefresh = true;

    try {
      sharedRefreshPromise ??= refreshAccessToken().finally(() => {
        sharedRefreshPromise = null;
      });
      const accessToken = await sharedRefreshPromise;
      const headers =
        config.headers instanceof AxiosHeaders ? config.headers : new AxiosHeaders(config.headers);
      headers.set('Authorization', `Bearer ${accessToken}`);
      config.headers = headers;
      return instance.request(config);
    } catch {
      expireSession();
      return Promise.reject(error);
    }
  };

  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const httpConfig = config as HttpRequestConfig;
    if (!httpConfig.skipAuth) {
      const tokens = getStoredTokens();
      if (tokens?.accessToken) {
        const headers =
          httpConfig.headers instanceof AxiosHeaders ? httpConfig.headers : new AxiosHeaders(httpConfig.headers);
        headers.set('Authorization', `Bearer ${tokens.accessToken}`);
        httpConfig.headers = headers;
      }
    }
    return httpConfig;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (!(error instanceof AxiosError) || !error.config) return Promise.reject(error);
      const config = error.config as HttpRequestConfig;

      const isUnauthorized = error.response?.status === 401 && !config.skipAuthRefresh;
      if (isUnauthorized) return handleRefresh(error, config);

      if (shouldRetry(config, error)) return scheduleRetry(config);

      return Promise.reject(error);
    },
  );

  return {
    get: async <T>(url: string, config?: Partial<HttpRequestConfig>): Promise<ApiResponse<T>> => {
      const response = await instance.get<ApiResponse<T>>(url, config);
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
};

const defaultInstance = axios.create({
  baseURL: Config.API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

export const HttpClient = createHttpClient(defaultInstance);
```

- [ ] **Step 6: Chạy test, xác nhận PASS**

Run: `npx jest HttpClient.test.ts`
Expected: PASS — 5 test đều xanh.

- [ ] **Step 7: Verify toàn bộ**

Run: `npm run verify`

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/services/http/refreshTokenRequest.ts src/services/http/HttpClient.ts src/services/http/HttpClient.test.ts
git commit -m "feat: add HttpClient with Bearer auth, auto-refresh, and retry"
```

---

### Task 4: Auth types, Zod schema, `authApi`

**Files:**
- Create: `src/features/auth/types/auth.types.ts`
- Create: `src/features/auth/schemas/loginFormSchema.ts`
- Create: `src/features/auth/api/authApi.ts`

**Interfaces:**
- Consumes: `HttpClient` (Task 3).
- Produces: `LoginRequest { email: string; password: string }`, `LoginResponseDto { AccessToken, RefreshToken, AccessTokenExpiration, RefreshTokenExpiration }` (dùng ở Task 5). `loginFormSchema` + `LoginFormValues` (dùng ở Task 7 — `LoginForm`). `authApi.loginAsync(payload: LoginRequest): Promise<ApiResponse<LoginResponseDto>>` (dùng ở Task 5 — `AuthService`).

Lưu ý: `AuthTokenModel` (dạng lưu storage) đã được định nghĩa ở Task 2 (`services/http/authTokenStorage.ts`) — file này KHÔNG định nghĩa lại, chỉ có `LoginRequest`/`LoginResponseDto` (hình dạng request/response API, khác tầng với dạng lưu storage).

- [ ] **Step 1: Tạo `auth.types.ts`**

```ts
// src/features/auth/types/auth.types.ts
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponseDto {
  AccessToken?: string | null;
  RefreshToken?: string | null;
  AccessTokenExpiration?: string | null;
  RefreshTokenExpiration?: string | null;
}
```

- [ ] **Step 2: Tạo `loginFormSchema.ts`**

```ts
// src/features/auth/schemas/loginFormSchema.ts
import { z } from 'zod';

export const loginFormSchema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
```

- [ ] **Step 3: Tạo `authApi.ts`**

```ts
// src/features/auth/api/authApi.ts
import { HttpClient } from '../../../services/http/HttpClient';
import type { ApiResponse } from '../../../types/ApiResponse';
import type { LoginRequest, LoginResponseDto } from '../types/auth.types';

export const authApi = {
  loginAsync(payload: LoginRequest): Promise<ApiResponse<LoginResponseDto>> {
    return HttpClient.post('/admin/auth/login', {
      Email: payload.email,
      Password: payload.password,
    });
  },
};
```

- [ ] **Step 4: Verify (không có test riêng cho type/schema/api thuần khai báo — verify qua type-check + lint)**

Run: `npm run type-check && npm run lint`
Expected: 0 lỗi.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/types/auth.types.ts src/features/auth/schemas/loginFormSchema.ts src/features/auth/api/authApi.ts
git commit -m "feat: add auth types, login form schema, and authApi"
```

---

### Task 5: `AuthService`

**Files:**
- Create: `src/features/auth/services/AuthService.ts`
- Create: `src/features/auth/services/AuthService.test.ts`

**Interfaces:**
- Consumes: `authApi` (Task 4), `LoginRequest` (Task 4), `AuthTokenModel`/`getStoredTokens`/`saveTokens`/`clearTokens` (Task 2 — `services/http/authTokenStorage`, KHÔNG gọi `StorageService` trực tiếp).
- Produces: `AuthService.login(payload: LoginRequest): Promise<void>` (ném lỗi nếu thất bại — message tiếng Việt từ backend), `AuthService.logout(): void`, `AuthService.getStoredToken(): AuthTokenModel | null` (đồng bộ) — dùng ở Task 6 (`authSlice` initial state) và Task 7 (`useAuth` hook).

- [ ] **Step 1: Viết test cho `AuthService` (thất bại trước vì file chưa tồn tại)**

```ts
// src/features/auth/services/AuthService.test.ts
import { AuthService } from './AuthService';
import { authApi } from '../api/authApi';
import { clearTokens } from '../../../services/http/authTokenStorage';

jest.mock('../api/authApi', () => ({
  authApi: { loginAsync: jest.fn() },
}));

describe('AuthService', () => {
  afterEach(() => {
    clearTokens();
    jest.clearAllMocks();
  });

  it('getStoredToken returns null when nothing is stored', () => {
    expect(AuthService.getStoredToken()).toBeNull();
  });

  it('login stores the token on success', async () => {
    (authApi.loginAsync as jest.Mock).mockResolvedValue({
      IsSuccess: true,
      Data: {
        AccessToken: 'access-1',
        RefreshToken: 'refresh-1',
        AccessTokenExpiration: '2099-01-01T00:00:00Z',
        RefreshTokenExpiration: '2099-01-01T00:00:00Z',
      },
      Message: null,
      Error: null,
    });

    await AuthService.login({ email: 'a@b.com', password: '123456' });

    expect(AuthService.getStoredToken()).toEqual({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      accessTokenExpiration: '2099-01-01T00:00:00Z',
      refreshTokenExpiration: '2099-01-01T00:00:00Z',
    });
  });

  it('login throws the backend error message on failure and stores nothing', async () => {
    (authApi.loginAsync as jest.Mock).mockResolvedValue({
      IsSuccess: false,
      Data: null,
      Message: null,
      Error: { ErrorCode: 'INVALID_CREDENTIALS', Message: 'Sai email hoặc mật khẩu' },
    });

    await expect(AuthService.login({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow(
      'Sai email hoặc mật khẩu',
    );
    expect(AuthService.getStoredToken()).toBeNull();
  });

  it('logout clears the stored token', async () => {
    (authApi.loginAsync as jest.Mock).mockResolvedValue({
      IsSuccess: true,
      Data: {
        AccessToken: 'access-1',
        RefreshToken: 'refresh-1',
        AccessTokenExpiration: '2099-01-01T00:00:00Z',
        RefreshTokenExpiration: '2099-01-01T00:00:00Z',
      },
      Message: null,
      Error: null,
    });
    await AuthService.login({ email: 'a@b.com', password: '123456' });

    AuthService.logout();

    expect(AuthService.getStoredToken()).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest AuthService.test.ts`
Expected: FAIL — Cannot find module `./AuthService`.

- [ ] **Step 3: Viết implementation**

```ts
// src/features/auth/services/AuthService.ts
import { authApi } from '../api/authApi';
import {
  getStoredTokens,
  saveTokens,
  clearTokens,
  type AuthTokenModel,
} from '../../../services/http/authTokenStorage';
import type { LoginRequest } from '../types/auth.types';

const login = async (payload: LoginRequest): Promise<void> => {
  const response = await authApi.loginAsync(payload);

  if (!response.IsSuccess || !response.Data?.AccessToken || !response.Data.RefreshToken) {
    throw new Error(response.Error?.Message ?? 'Đăng nhập thất bại');
  }

  const token: AuthTokenModel = {
    accessToken: response.Data.AccessToken,
    refreshToken: response.Data.RefreshToken,
    accessTokenExpiration: response.Data.AccessTokenExpiration ?? '',
    refreshTokenExpiration: response.Data.RefreshTokenExpiration ?? '',
  };
  saveTokens(token);
};

const logout = (): void => {
  clearTokens();
};

const getStoredToken = (): AuthTokenModel | null => getStoredTokens();

export const AuthService = { login, logout, getStoredToken };
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx jest AuthService.test.ts`
Expected: PASS — 4 test đều xanh.

- [ ] **Step 5: Verify toàn bộ**

Run: `npm run verify`

- [ ] **Step 6: Commit**

```bash
git add src/features/auth/services/AuthService.ts src/features/auth/services/AuthService.test.ts
git commit -m "feat: add AuthService for login/logout/token storage"
```

---

### Task 6: `authSlice`

**Files:**
- Create: `src/features/auth/store/authSlice.ts`
- Create: `src/features/auth/store/authSlice.test.ts`
- Modify: `src/store/index.ts`

**Interfaces:**
- Consumes: `AuthService.getStoredToken()` (Task 5, để tính initial state đồng bộ).
- Produces: reducer `authSlice.reducer` (thêm vào `store/index.ts`, key `auth`), actions `loginStarted()`, `loginSucceeded()`, `loginFailed(message: string)`, `loggedOut()`, selector `selectIsLoggedIn(state): boolean`, `selectAuthLoading(state): boolean`, `selectAuthError(state): string | null`. Dùng ở Task 7 (`useAuth` hook) và Task 8 (`RootNavigator`).

- [ ] **Step 1: Viết test cho `authSlice` (thất bại trước vì file chưa tồn tại)**

```ts
// src/features/auth/store/authSlice.test.ts
import reducer, {
  loginStarted,
  loginSucceeded,
  loginFailed,
  loggedOut,
  selectIsLoggedIn,
  selectAuthLoading,
  selectAuthError,
} from './authSlice';

describe('authSlice', () => {
  const initialState = reducer(undefined, { type: '@@INIT' });

  it('loginStarted sets isLoading and clears error', () => {
    const state = reducer({ ...initialState, error: 'previous error' }, loginStarted());
    expect(state.isLoading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('loginSucceeded sets isLoggedIn and clears loading', () => {
    const state = reducer({ ...initialState, isLoading: true }, loginSucceeded());
    expect(state.isLoggedIn).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('loginFailed stores the error message and clears loading', () => {
    const state = reducer({ ...initialState, isLoading: true }, loginFailed('Sai email hoặc mật khẩu'));
    expect(state.isLoggedIn).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('Sai email hoặc mật khẩu');
  });

  it('loggedOut resets isLoggedIn', () => {
    const state = reducer({ ...initialState, isLoggedIn: true }, loggedOut());
    expect(state.isLoggedIn).toBe(false);
  });

  it('selectors read the auth slice from RootState-shaped object', () => {
    const rootState = { auth: { isLoggedIn: true, isLoading: false, error: 'x' } };
    expect(selectIsLoggedIn(rootState)).toBe(true);
    expect(selectAuthLoading(rootState)).toBe(false);
    expect(selectAuthError(rootState)).toBe('x');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest authSlice.test.ts`
Expected: FAIL — Cannot find module `./authSlice`.

- [ ] **Step 3: Viết implementation**

```ts
// src/features/auth/store/authSlice.ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { AuthService } from '../services/AuthService';

interface AuthState {
  isLoggedIn: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  isLoggedIn: AuthService.getStoredToken() !== null,
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStarted(state) {
      state.isLoading = true;
      state.error = null;
    },
    loginSucceeded(state) {
      state.isLoggedIn = true;
      state.isLoading = false;
      state.error = null;
    },
    loginFailed(state, action: PayloadAction<string>) {
      state.isLoggedIn = false;
      state.isLoading = false;
      state.error = action.payload;
    },
    loggedOut(state) {
      state.isLoggedIn = false;
      state.isLoading = false;
      state.error = null;
    },
  },
});

export const { loginStarted, loginSucceeded, loginFailed, loggedOut } = authSlice.actions;

interface StateWithAuth {
  auth: AuthState;
}

export const selectIsLoggedIn = (state: StateWithAuth): boolean => state.auth.isLoggedIn;
export const selectAuthLoading = (state: StateWithAuth): boolean => state.auth.isLoading;
export const selectAuthError = (state: StateWithAuth): string | null => state.auth.error;

export default authSlice.reducer;
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx jest authSlice.test.ts`
Expected: PASS — 5 test đều xanh.

- [ ] **Step 5: Thêm `authReducer` vào store**

```ts
// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/store/authSlice';
import printerReducer from '../features/printer/store/printerSlice';
import settingsReducer from '../features/settings/store/settingsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
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
git add src/features/auth/store/authSlice.ts src/features/auth/store/authSlice.test.ts src/store/index.ts
git commit -m "feat: add authSlice and wire it into the Redux store"
```

---

### Task 7: `AppInput.secureTextEntry`, `useAuth`, `LoginForm`, `LoginScreen`

**Files:**
- Modify: `src/components/AppInput.tsx`
- Create: `src/features/auth/hooks/useAuth.ts`
- Create: `src/features/auth/components/LoginForm.tsx`
- Create: `src/features/auth/screens/LoginScreen.tsx`

**Interfaces:**
- Consumes: `AppInput` (sửa), `AppButton` (`src/components/AppButton.tsx`, không đổi), `loginFormSchema`/`LoginFormValues` (Task 4), `AuthService` (Task 5), `loginStarted`/`loginSucceeded`/`loginFailed`/`selectAuthLoading`/`selectAuthError` (Task 6), `onSessionExpired` (Task 2 — subscribe để tự logout khi refresh thất bại).
- Produces: `LoginScreen: React.FC` — dùng ở Task 8 (`AuthStack`).

- [ ] **Step 1: Thêm `secureTextEntry` vào `AppInput`**

```tsx
// src/components/AppInput.tsx
import React from 'react';
import { TextInput, HelperText } from 'react-native-paper';
import { View } from 'react-native';

export interface AppInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  errorMessage?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  placeholder?: string;
  disabled?: boolean;
  secureTextEntry?: boolean;
}

export const AppInput: React.FC<AppInputProps> = ({
  label,
  value,
  onChangeText,
  errorMessage,
  keyboardType = 'default',
  placeholder,
  disabled = false,
  secureTextEntry = false,
}) => (
  <View>
    <TextInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      placeholder={placeholder}
      error={Boolean(errorMessage)}
      mode="outlined"
      disabled={disabled}
      secureTextEntry={secureTextEntry}
    />
    {errorMessage ? <HelperText type="error">{errorMessage}</HelperText> : null}
  </View>
);
```

- [ ] **Step 2: Tạo `useAuth` hook**

```ts
// src/features/auth/hooks/useAuth.ts
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { AuthService } from '../services/AuthService';
import { onSessionExpired } from '../../../services/http/sessionEvents';
import {
  loginStarted,
  loginSucceeded,
  loginFailed,
  loggedOut,
  selectAuthLoading,
  selectAuthError,
} from '../store/authSlice';
import type { LoginRequest } from '../types/auth.types';

export const useAuth = () => {
  const dispatch = useDispatch<AppDispatch>();
  const isLoading = useSelector((state: RootState) => selectAuthLoading(state));
  const error = useSelector((state: RootState) => selectAuthError(state));

  useEffect(() => onSessionExpired(() => dispatch(loggedOut())), [dispatch]);

  const login = async (payload: LoginRequest): Promise<void> => {
    dispatch(loginStarted());
    try {
      await AuthService.login(payload);
      dispatch(loginSucceeded());
    } catch (err) {
      dispatch(loginFailed(err instanceof Error ? err.message : 'Đăng nhập thất bại'));
    }
  };

  return { login, isLoading, error };
};
```

- [ ] **Step 3: Tạo `LoginForm`**

```tsx
// src/features/auth/components/LoginForm.tsx
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppInput } from '../../../components/AppInput';
import { AppButton } from '../../../components/AppButton';
import { loginFormSchema } from '../schemas/loginFormSchema';
import type { LoginRequest } from '../types/auth.types';

export interface LoginFormProps {
  isLoading: boolean;
  onSubmit: (payload: LoginRequest) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ isLoading, onSubmit }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const handleSubmit = (): void => {
    const result = loginFormSchema.safeParse({ email, password });
    if (!result.success) {
      const errors: { email?: string; password?: string } = {};
      for (const issue of result.error.issues) {
        if (issue.path[0] === 'email') errors.email = issue.message;
        if (issue.path[0] === 'password') errors.password = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    onSubmit(result.data);
  };

  return (
    <View style={styles.container}>
      <AppInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        errorMessage={fieldErrors.email}
        keyboardType="default"
        disabled={isLoading}
      />
      <AppInput
        label="Mật khẩu"
        value={password}
        onChangeText={setPassword}
        errorMessage={fieldErrors.password}
        secureTextEntry
        disabled={isLoading}
      />
      <AppButton label="Đăng nhập" onPress={handleSubmit} disabled={isLoading} loading={isLoading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12, width: '100%', maxWidth: 360 },
});
```

- [ ] **Step 4: Tạo `LoginScreen`**

```tsx
// src/features/auth/screens/LoginScreen.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { LoginForm } from '../components/LoginForm';

export const LoginScreen: React.FC = () => {
  const { login, isLoading, error } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.center}>
        <Text variant="headlineSmall" style={styles.title}>
          Đăng nhập
        </Text>
        <LoginForm isLoading={isLoading} onSubmit={login} />
        {error ? (
          <Text variant="bodyMedium" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'white' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { marginBottom: 24 },
  error: { color: '#B3261E', marginTop: 12, textAlign: 'center' },
});
```

- [ ] **Step 5: Verify (component UI thuần trình bày — không viết test riêng theo Global Constraints)**

Run: `npm run type-check && npm run lint`
Expected: 0 lỗi. Nếu `AppButton`/Paper's `Button` không có prop `loading`, kiểm tra `node_modules/react-native-paper` — `Button` của Paper hỗ trợ `loading` sẵn (`ButtonProps` mà `AppButton` extends), không cần sửa `AppButton.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/components/AppInput.tsx src/features/auth/hooks/useAuth.ts src/features/auth/components/LoginForm.tsx src/features/auth/screens/LoginScreen.tsx
git commit -m "feat: add LoginScreen with email/password form"
```

---

### Task 8: Navigation gating

**Files:**
- Modify: `src/navigation/RootNavigator.tsx`

**Interfaces:**
- Consumes: `LoginScreen` (Task 7), `selectIsLoggedIn` (Task 6), `AuthStackParamList` (mới, khai báo trong chính file này — chỉ có 1 key `Login`, không cần tách file riêng như `types.ts` của tab vì không có gì khác import type này).
- Produces: `RootNavigator: React.FC` — hành vi thay đổi (chọn `AuthStack` hoặc `AppTabs` theo `isLoggedIn`), không đổi interface bên ngoài (vẫn export `RootNavigator`, `RootTabParamList` từ `./types` không đổi).

- [ ] **Step 1: Viết lại `RootNavigator.tsx`**

```tsx
// src/navigation/RootNavigator.tsx
import React from 'react';
import { useSelector } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { SettingsScreen } from '../features/settings/screens/SettingsScreen';
import { SalesScreen } from '../features/sales/screens/SalesScreen';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { selectIsLoggedIn } from '../features/auth/store/authSlice';
import type { RootState } from '../store';
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

export const RootNavigator: React.FC = () => {
  const isLoggedIn = useSelector((state: RootState) => selectIsLoggedIn(state));

  return <NavigationContainer>{isLoggedIn ? <AppTabs /> : <AuthStack />}</NavigationContainer>;
};
```

- [ ] **Step 2: Verify**

Run: `npm run verify`
Expected: type-check + lint + toàn bộ test suite (bao gồm `__tests__/App.test.tsx` render qua `RootNavigator` mới) đều PASS. `App.test.tsx` render `<App />` không có Redux state đăng nhập sẵn → mặc định `isLoggedIn: false` → render `AuthStack`/`LoginScreen` — vẫn phải render không crash.

- [ ] **Step 3: Commit**

```bash
git add src/navigation/RootNavigator.tsx
git commit -m "feat: gate app navigation behind login state"
```

---

### Task 9: Manual verify — đăng nhập thật trên thiết bị/emulator/web

**Files:** không tạo/sửa file — bước xác nhận thủ công. Cần môi trường build thật (Android emulator/thiết bị, hoặc `npm run web`) mà môi trường viết plan này không có.

- [ ] **Step 1: iOS pod install (nếu build iOS)**

Run (trên macOS): `cd ios && pod install`
Xác nhận `react-native-config` autolink thành công, không lỗi.

- [ ] **Step 2: Build và chạy app**

Run: `npm run android` (hoặc `npm run web` — nhanh hơn để kiểm tra luồng UI/logic trước, dù chức năng máy in sẽ báo "không khả dụng" như đã biết)
Expected: app mở vào màn "Đăng nhập" (không phải Sales) vì chưa có token nào lưu.

- [ ] **Step 3: Đăng nhập thật**

Nhập tài khoản thật (email/password hợp lệ trên `https://api.soliteavn.com/api`) → bấm "Đăng nhập".
Expected: chuyển sang tab "Bán hàng" (Sales) ngay sau khi login thành công. Đóng và mở lại app (hoặc reload web) → vẫn ở màn Sales (không quay lại Login) — xác nhận token đã lưu và đọc lại đúng lúc khởi động.

- [ ] **Step 4: Sai thông tin đăng nhập**

Nhập sai password → bấm "Đăng nhập".
Expected: hiện thông báo lỗi tiếng Việt dưới form (message từ backend, vd "Sai email hoặc mật khẩu"), không crash, vẫn ở màn Login.

- [ ] **Step 5: Xác nhận và báo cáo**

Nếu cả 4 bước trên đạt, sub-project Auth hoàn tất. Refresh token tự động (khi access token hết hạn giữa phiên làm việc) khó test thủ công trong thời gian ngắn (access token thường có hạn dài hơn vài phút) — nếu muốn xác nhận riêng cơ chế này, có thể tạm sửa `AccessTokenExpiration` đã lưu trong storage thành thời điểm quá khứ rồi gọi 1 API cần auth bất kỳ để trigger 401 → refresh, nhưng đây là bước tuỳ chọn, không bắt buộc để coi task này hoàn tất (đã có test tự động cho logic refresh ở Task 3).
