import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { appConfig } from '../../config/appConfig';
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
const ACCESS_TOKEN_EXPIRED_CODE = 'ACCESS_TOKEN_EXPIRED';

const backoffDelay = (retryCount: number): number => {
  const base = 2 ** retryCount * RETRY_BASE_DELAY_MS;
  const jitter = base * 0.25 * (Math.random() * 2 - 1);
  return Math.round(base + jitter);
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const getErrorCode = (error: AxiosError): string | undefined =>
  (error.response?.data as ApiResponse<unknown> | undefined)?.Error?.ErrorCode;

const toApiError = (error: AxiosError): Error => {
  const message = (error.response?.data as ApiResponse<unknown> | undefined)?.Error?.Message;
  return new Error(message ?? 'Yêu cầu thất bại');
};

export const createHttpClient = (instance: AxiosInstance) => {
  let sharedRefreshPromise: Promise<string> | null = null;
  let sessionExpiredEmitted = false;

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

    const data = await refreshTokenRequest(tokens.accessToken, tokens.refreshToken);
    const nextTokens: AuthTokenModel = {
      accessToken: data.AccessToken,
      refreshToken: data.RefreshToken,
      accessTokenExpiration: data.AccessTokenExpiration,
      refreshTokenExpiration: data.RefreshTokenExpiration,
    };
    saveTokens(nextTokens);
    // A successful refresh proves the session is alive again — allow a future
    // genuine expiry to emit session-expired again.
    sessionExpiredEmitted = false;
    return nextTokens.accessToken;
  };

  const expireSession = (): void => {
    clearTokens();
    if (sessionExpiredEmitted) return;
    sessionExpiredEmitted = true;
    emitSessionExpired();
  };

  const handleRefresh = async (error: AxiosError, config: HttpRequestConfig): Promise<AxiosResponse> => {
    if (config.isRetryAfterRefresh) {
      expireSession();
      return Promise.reject(toApiError(error));
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
      return Promise.reject(toApiError(error));
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

      const isTokenExpired =
        error.response?.status === 401 &&
        getErrorCode(error) === ACCESS_TOKEN_EXPIRED_CODE &&
        !config.skipAuthRefresh;
      if (isTokenExpired) return handleRefresh(error, config);

      if (shouldRetry(config, error)) return scheduleRetry(config);

      return Promise.reject(toApiError(error));
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
    // Allows a fresh login to re-arm the emit-once guard so a session that
    // expires again later (in the same app process) still triggers a logout.
    resetSessionExpiredFlag: (): void => {
      sessionExpiredEmitted = false;
    },
  };
};

const defaultInstance = axios.create({
  baseURL: appConfig.apiBaseUrl,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Tenant-Id': appConfig.tenantId },
});

export const HttpClient = createHttpClient(defaultInstance);
