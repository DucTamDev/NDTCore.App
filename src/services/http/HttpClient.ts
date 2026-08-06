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
