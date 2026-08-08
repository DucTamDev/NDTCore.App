import { authApi } from '../api/authApi';
import { HttpClient } from '../../../services/http/HttpClient';
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
  // A fresh login proves the session is alive — re-arm the emit-once guard so
  // a later expiry in this same app process still clears tokens and logs out.
  HttpClient.resetSessionExpiredFlag();
};

const logout = (): void => {
  clearTokens();
};

const getStoredToken = (): AuthTokenModel | null => getStoredTokens();

export const AuthService = { login, logout, getStoredToken };
