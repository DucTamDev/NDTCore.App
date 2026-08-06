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
