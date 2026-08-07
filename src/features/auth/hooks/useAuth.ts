import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { AuthService } from '../services/AuthService';
import { loginStarted, loginSucceeded, loginFailed, selectAuthLoading, selectAuthError } from '../store/authSlice';
import type { LoginRequest } from '../types/auth.types';

export const useAuth = () => {
  const dispatch = useDispatch<AppDispatch>();
  const isLoading = useSelector((state: RootState) => selectAuthLoading(state));
  const error = useSelector((state: RootState) => selectAuthError(state));

  const login = async (payload: LoginRequest): Promise<void> => {
    dispatch(loginStarted());
    try {
      await AuthService.login(payload);
      dispatch(loginSucceeded());
    } catch (err) {
      dispatch(loginFailed(err instanceof Error ? err.message : 'Đăng nhập thất bại'));
    }
  };

  return { login, isLoading, error };
};
