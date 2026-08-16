import { loginFormSchema } from '../loginFormSchema';

describe('loginFormSchema', () => {
  it('accepts a valid email and non-empty password', () => {
    const result = loginFormSchema.safeParse({ email: 'cashier@ndtcore.vn', password: 'secret123' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty email', () => {
    const result = loginFormSchema.safeParse({ email: '', password: 'secret123' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['email']);
      expect(result.error.issues[0].message).toBe('Vui lòng nhập email');
    }
  });

  it('rejects a malformed email', () => {
    const result = loginFormSchema.safeParse({ email: 'not-an-email', password: 'secret123' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Email không hợp lệ');
    }
  });

  it('rejects an empty password', () => {
    const result = loginFormSchema.safeParse({ email: 'cashier@ndtcore.vn', password: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['password']);
      expect(result.error.issues[0].message).toBe('Vui lòng nhập mật khẩu');
    }
  });
});
