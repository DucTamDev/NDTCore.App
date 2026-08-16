import { AuthService } from '../AuthService';
import { authApi } from '../../api/authApi';
import { clearTokens } from '../../../../services/http/authTokenStorage';

jest.mock('../../api/authApi', () => ({
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

  it('login throws and stores nothing when the response is success but missing AccessTokenExpiration', async () => {
    (authApi.loginAsync as jest.Mock).mockResolvedValue({
      IsSuccess: true,
      Data: {
        AccessToken: 'access-1',
        RefreshToken: 'refresh-1',
        AccessTokenExpiration: null,
        RefreshTokenExpiration: '2099-01-01T00:00:00Z',
      },
      Message: null,
      Error: null,
    });

    await expect(AuthService.login({ email: 'a@b.com', password: '123456' })).rejects.toThrow();
    expect(AuthService.getStoredToken()).toBeNull();
  });

  it('login throws and stores nothing when the response is success but missing RefreshTokenExpiration', async () => {
    (authApi.loginAsync as jest.Mock).mockResolvedValue({
      IsSuccess: true,
      Data: {
        AccessToken: 'access-1',
        RefreshToken: 'refresh-1',
        AccessTokenExpiration: '2099-01-01T00:00:00Z',
        RefreshTokenExpiration: null,
      },
      Message: null,
      Error: null,
    });

    await expect(AuthService.login({ email: 'a@b.com', password: '123456' })).rejects.toThrow();
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
