import axios from 'axios';
import { appConfig } from '../../config/appConfig';
import type { ApiResponse } from '../../types/ApiResponse';

export interface RefreshTokenResponseDto {
  AccessToken: string;
  RefreshToken: string;
  AccessTokenExpiration: string;
  RefreshTokenExpiration: string;
}

export const refreshTokenRequest = async (
  accessToken: string,
  refreshToken: string,
): Promise<RefreshTokenResponseDto> => {
  const response = await axios.post<ApiResponse<RefreshTokenResponseDto>>(
    `${appConfig.apiBaseUrl}/admin/auth/refresh`,
    { AccessToken: accessToken, RefreshToken: refreshToken },
    { timeout: 30000, headers: { 'Tenant-Id': appConfig.tenantId } },
  );

  if (!response.data.IsSuccess || !response.data.Data) {
    throw new Error(response.data.Error?.Message ?? 'Không thể làm mới phiên đăng nhập');
  }

  if (!response.data.Data.AccessToken || !response.data.Data.RefreshToken) {
    throw new Error('Không thể làm mới phiên đăng nhập');
  }

  return response.data.Data;
};
