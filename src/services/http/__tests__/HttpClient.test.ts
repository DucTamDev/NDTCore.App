import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { createHttpClient } from '../HttpClient';
import { getStoredTokens, saveTokens, clearTokens } from '../authTokenStorage';
import { onSessionExpired } from '../sessionEvents';

jest.mock('../refreshTokenRequest', () => ({
  refreshTokenRequest: jest.fn(),
}));

import { refreshTokenRequest } from '../refreshTokenRequest';

const setStoredTokens = (accessToken: string, refreshToken: string): void => {
  saveTokens({
    accessToken,
    refreshToken,
    accessTokenExpiration: '2099-01-01T00:00:00Z',
    refreshTokenExpiration: '2099-01-01T00:00:00Z',
  });
};

describe('HttpClient', () => {
  let mock: MockAdapter;
  let client: ReturnType<typeof createHttpClient>;

  beforeEach(() => {
    const instance = axios.create({ baseURL: 'http://test.local' });
    mock = new MockAdapter(instance);
    client = createHttpClient(instance);
    clearTokens();
    jest.clearAllMocks();
  });

  afterEach(() => {
    mock.restore();
  });

  it('attaches Bearer token when a token is stored', async () => {
    setStoredTokens('access-1', 'refresh-1');
    mock.onGet('/ping').reply((config) => {
      expect(config.headers?.Authorization).toBe('Bearer access-1');
      return [200, { IsSuccess: true, Data: { ok: true }, Message: null, Error: null }];
    });

    const result = await client.get<{ ok: boolean }>('/ping');
    expect(result.Data).toEqual({ ok: true });
  });

  it('does not attach Authorization header when no token stored', async () => {
    mock.onGet('/ping').reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined();
      return [200, { IsSuccess: true, Data: null, Message: null, Error: null }];
    });

    await client.get('/ping');
  });

  it('retries a GET request on 503 up to the retry policy', async () => {
    setStoredTokens('access-1', 'refresh-1');
    mock
      .onGet('/flaky')
      .replyOnce(503)
      .onGet('/flaky')
      .replyOnce(503)
      .onGet('/flaky')
      .reply(200, { IsSuccess: true, Data: { attempt: 3 }, Message: null, Error: null });

    const result = await client.get<{ attempt: number }>('/flaky');
    expect(result.Data).toEqual({ attempt: 3 });
  }, 15000);

  it('refreshes the access token on 401 and retries the original request', async () => {
    setStoredTokens('expired-access', 'refresh-1');
    (refreshTokenRequest as jest.Mock).mockResolvedValue({
      AccessToken: 'fresh-access',
      RefreshToken: 'fresh-refresh',
      AccessTokenExpiration: '2099-01-01T00:00:00Z',
      RefreshTokenExpiration: '2099-01-01T00:00:00Z',
    });

    let callCount = 0;
    mock.onGet('/secure').reply((config) => {
      callCount += 1;
      if (callCount === 1) {
        expect(config.headers?.Authorization).toBe('Bearer expired-access');
        return [
          401,
          {
            IsSuccess: false,
            Data: null,
            Message: null,
            Error: { ErrorCode: 'ACCESS_TOKEN_EXPIRED', Message: 'Access token expired' },
          },
        ];
      }
      expect(config.headers?.Authorization).toBe('Bearer fresh-access');
      return [200, { IsSuccess: true, Data: { ok: true }, Message: null, Error: null }];
    });

    const result = await client.get<{ ok: boolean }>('/secure');
    expect(result.Data).toEqual({ ok: true });
    expect(refreshTokenRequest).toHaveBeenCalledWith('expired-access', 'refresh-1');
    expect(getStoredTokens()).toMatchObject({ accessToken: 'fresh-access' });
  });

  it('emits session-expired and clears stored tokens when refresh itself fails', async () => {
    setStoredTokens('expired-access', 'dead-refresh');
    (refreshTokenRequest as jest.Mock).mockRejectedValue(new Error('refresh token expired'));

    const listener = jest.fn();
    const unsubscribe = onSessionExpired(listener);

    mock.onGet('/secure').reply(401, {
      IsSuccess: false,
      Data: null,
      Message: null,
      Error: { ErrorCode: 'ACCESS_TOKEN_EXPIRED', Message: 'Access token expired' },
    });

    await expect(client.get('/secure')).rejects.toBeDefined();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getStoredTokens()).toBeNull();

    unsubscribe();
  });

  it('clears tokens and emits again after resetSessionExpiredFlag following a second expiry', async () => {
    setStoredTokens('expired-access', 'dead-refresh');
    (refreshTokenRequest as jest.Mock).mockRejectedValue(new Error('refresh token expired'));

    const listener = jest.fn();
    const unsubscribe = onSessionExpired(listener);

    mock.onGet('/secure').reply(401, {
      IsSuccess: false,
      Data: null,
      Message: null,
      Error: { ErrorCode: 'ACCESS_TOKEN_EXPIRED', Message: 'Access token expired' },
    });

    // First expiry: tokens cleared, event fired once.
    await expect(client.get('/secure')).rejects.toBeDefined();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getStoredTokens()).toBeNull();

    // Simulate a fresh login re-arming the guard.
    setStoredTokens('expired-access-2', 'dead-refresh-2');
    client.resetSessionExpiredFlag();

    // Second expiry in the same process must clear tokens and emit again, not no-op.
    await expect(client.get('/secure')).rejects.toBeDefined();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getStoredTokens()).toBeNull();

    unsubscribe();
  });

  it('preserves the status, ErrorCode, and original AxiosError on a rejected request', async () => {
    mock.onPost('/orders').reply(400, {
      IsSuccess: false,
      Data: null,
      Message: null,
      Error: { ErrorCode: 'VALIDATION_ERROR', Message: 'Số lượng không hợp lệ' },
    });

    await expect(client.post('/orders', { item: 'x' })).rejects.toMatchObject({
      message: 'Số lượng không hợp lệ',
      code: 'VALIDATION_ERROR',
      status: 400,
    });
  });

  it('does not retry a failing POST request (non-idempotent)', async () => {
    let callCount = 0;
    mock.onPost('/orders').reply(() => {
      callCount += 1;
      return [503];
    });

    await expect(client.post('/orders', { item: 'x' })).rejects.toBeDefined();
    expect(callCount).toBe(1);
  });

  it('dedupes concurrent 401s into a single refresh call', async () => {
    setStoredTokens('expired-access', 'refresh-1');
    (refreshTokenRequest as jest.Mock).mockResolvedValue({
      AccessToken: 'fresh-access',
      RefreshToken: 'fresh-refresh',
      AccessTokenExpiration: '2099-01-01T00:00:00Z',
      RefreshTokenExpiration: '2099-01-01T00:00:00Z',
    });

    const tokenExpiredResponse: [number, unknown] = [
      401,
      {
        IsSuccess: false,
        Data: null,
        Message: null,
        Error: { ErrorCode: 'ACCESS_TOKEN_EXPIRED', Message: 'Access token expired' },
      },
    ];

    let callsA = 0;
    mock.onGet('/secure-a').reply(() => {
      callsA += 1;
      if (callsA === 1) return tokenExpiredResponse;
      return [200, { IsSuccess: true, Data: { source: 'a' }, Message: null, Error: null }];
    });

    let callsB = 0;
    mock.onGet('/secure-b').reply(() => {
      callsB += 1;
      if (callsB === 1) return tokenExpiredResponse;
      return [200, { IsSuccess: true, Data: { source: 'b' }, Message: null, Error: null }];
    });

    const [resultA, resultB] = await Promise.all([
      client.get<{ source: string }>('/secure-a'),
      client.get<{ source: string }>('/secure-b'),
    ]);

    expect(resultA.Data).toEqual({ source: 'a' });
    expect(resultB.Data).toEqual({ source: 'b' });
    expect(refreshTokenRequest).toHaveBeenCalledTimes(1);
  });

  it('getPaged returns the full paged envelope, not just Data', async () => {
    setStoredTokens('access-1', 'refresh-1');
    mock.onGet('/items').reply(200, {
      IsSuccess: true,
      Data: [{ id: 1 }, { id: 2 }],
      Message: null,
      Error: null,
      PageNumber: 1,
      PageSize: 20,
      TotalCount: 2,
      TotalPages: 1,
      HasPreviousPage: false,
      HasNextPage: false,
    });

    const result = await client.getPaged<{ id: number }>('/items');
    expect(result.Data).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.TotalCount).toBe(2);
    expect(result.PageNumber).toBe(1);
  });
});
