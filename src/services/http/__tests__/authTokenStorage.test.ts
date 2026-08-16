import { getStoredTokens, saveTokens, clearTokens } from '../authTokenStorage';

const sampleTokens = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  accessTokenExpiration: '2099-01-01T00:00:00Z',
  refreshTokenExpiration: '2099-01-01T00:00:00Z',
};

describe('authTokenStorage', () => {
  afterEach(() => {
    clearTokens();
  });

  it('returns null when nothing is stored', () => {
    expect(getStoredTokens()).toBeNull();
  });

  it('round-trips tokens through saveTokens/getStoredTokens', () => {
    saveTokens(sampleTokens);
    expect(getStoredTokens()).toEqual(sampleTokens);
  });

  it('clearTokens removes the stored tokens', () => {
    saveTokens(sampleTokens);
    clearTokens();
    expect(getStoredTokens()).toBeNull();
  });
});
