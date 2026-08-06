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
