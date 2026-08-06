import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { createHttpClient } from './HttpClient';
import { getStoredTokens, saveTokens, clearTokens } from './authTokenStorage';
import { onSessionExpired } from './sessionEvents';

jest.mock('./refreshTokenRequest', () => ({
  refreshTokenRequest: jest.fn(),
}));

import { refreshTokenRequest } from './refreshTokenRequest';

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
        return [401];
      }
      expect(config.headers?.Authorization).toBe('Bearer fresh-access');
      return [200, { IsSuccess: true, Data: { ok: true }, Message: null, Error: null }];
    });

    const result = await client.get<{ ok: boolean }>('/secure');
    expect(result.Data).toEqual({ ok: true });
    expect(refreshTokenRequest).toHaveBeenCalledWith('refresh-1');
    expect(getStoredTokens()).toMatchObject({ accessToken: 'fresh-access' });
  });

  it('emits session-expired and clears stored tokens when refresh itself fails', async () => {
    setStoredTokens('expired-access', 'dead-refresh');
    (refreshTokenRequest as jest.Mock).mockRejectedValue(new Error('refresh token expired'));

    const listener = jest.fn();
    const unsubscribe = onSessionExpired(listener);

    mock.onGet('/secure').reply(401);

    await expect(client.get('/secure')).rejects.toBeDefined();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getStoredTokens()).toBeNull();

    unsubscribe();
  });
});
