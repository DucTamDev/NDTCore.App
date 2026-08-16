import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { refreshTokenRequest } from '../refreshTokenRequest';

describe('refreshTokenRequest', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  const validTokens = {
    AccessToken: 'new-access',
    RefreshToken: 'new-refresh',
    AccessTokenExpiration: '2099-01-01T00:00:00Z',
    RefreshTokenExpiration: '2099-01-01T00:00:00Z',
  };

  it('returns the fresh tokens when the server responds with success', async () => {
    mock.onPost(/\/admin\/auth\/refresh$/).reply(200, {
      IsSuccess: true,
      Data: validTokens,
      Message: null,
      Error: null,
    });

    await expect(refreshTokenRequest('old-access', 'old-refresh')).resolves.toEqual(validTokens);
  });

  it('rejects when the server reports IsSuccess: false', async () => {
    mock.onPost(/\/admin\/auth\/refresh$/).reply(200, {
      IsSuccess: false,
      Data: null,
      Message: null,
      Error: { ErrorCode: 'INVALID_REFRESH_TOKEN', Message: 'Refresh token không hợp lệ' },
    });

    await expect(refreshTokenRequest('old-access', 'old-refresh')).rejects.toThrow('Refresh token không hợp lệ');
  });

  it('rejects when the server responds success but the payload is missing AccessToken', async () => {
    mock.onPost(/\/admin\/auth\/refresh$/).reply(200, {
      IsSuccess: true,
      Data: { ...validTokens, AccessToken: '' },
      Message: null,
      Error: null,
    });

    await expect(refreshTokenRequest('old-access', 'old-refresh')).rejects.toThrow('Không thể làm mới phiên đăng nhập');
  });

  it('rejects when the server responds success but the payload is missing RefreshToken', async () => {
    mock.onPost(/\/admin\/auth\/refresh$/).reply(200, {
      IsSuccess: true,
      Data: { ...validTokens, RefreshToken: '' },
      Message: null,
      Error: null,
    });

    await expect(refreshTokenRequest('old-access', 'old-refresh')).rejects.toThrow('Không thể làm mới phiên đăng nhập');
  });

  it('rejects when the network request itself fails', async () => {
    mock.onPost(/\/admin\/auth\/refresh$/).networkError();

    await expect(refreshTokenRequest('old-access', 'old-refresh')).rejects.toBeDefined();
  });
});
