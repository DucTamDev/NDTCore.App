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
