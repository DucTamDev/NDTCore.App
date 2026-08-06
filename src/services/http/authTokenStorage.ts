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
