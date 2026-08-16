import reducer, {
  loginStarted,
  loginSucceeded,
  loginFailed,
  loggedOut,
  selectIsLoggedIn,
  selectAuthLoading,
  selectAuthError,
} from '../authSlice';

describe('authSlice', () => {
  const initialState = reducer(undefined, { type: '@@INIT' });

  it('loginStarted sets isLoading and clears error', () => {
    const state = reducer({ ...initialState, error: 'previous error' }, loginStarted());
    expect(state.isLoading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('loginSucceeded sets isLoggedIn and clears loading', () => {
    const state = reducer({ ...initialState, isLoading: true }, loginSucceeded());
    expect(state.isLoggedIn).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('loginFailed stores the error message and clears loading', () => {
    const state = reducer({ ...initialState, isLoading: true }, loginFailed('Sai email hoặc mật khẩu'));
    expect(state.isLoggedIn).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('Sai email hoặc mật khẩu');
  });

  it('loggedOut resets isLoggedIn', () => {
    const state = reducer({ ...initialState, isLoggedIn: true }, loggedOut());
    expect(state.isLoggedIn).toBe(false);
  });

  it('selectors read the auth slice from RootState-shaped object', () => {
    const rootState = { auth: { isLoggedIn: true, isLoading: false, error: 'x' } };
    expect(selectIsLoggedIn(rootState)).toBe(true);
    expect(selectAuthLoading(rootState)).toBe(false);
    expect(selectAuthError(rootState)).toBe('x');
  });
});
