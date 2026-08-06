import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppInput } from '../../../components/AppInput';
import { AppButton } from '../../../components/AppButton';
import { loginFormSchema } from '../schemas/loginFormSchema';
import type { LoginRequest } from '../types/auth.types';

export interface LoginFormProps {
  isLoading: boolean;
  onSubmit: (payload: LoginRequest) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ isLoading, onSubmit }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const handleSubmit = (): void => {
    const result = loginFormSchema.safeParse({ email, password });
    if (!result.success) {
      const errors: { email?: string; password?: string } = {};
      for (const issue of result.error.issues) {
        if (issue.path[0] === 'email') errors.email = issue.message;
        if (issue.path[0] === 'password') errors.password = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    onSubmit(result.data);
  };

  return (
    <View style={styles.container}>
      <AppInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        errorMessage={fieldErrors.email}
        keyboardType="default"
        disabled={isLoading}
      />
      <AppInput
        label="Mật khẩu"
        value={password}
        onChangeText={setPassword}
        errorMessage={fieldErrors.password}
        secureTextEntry
        disabled={isLoading}
      />
      <AppButton label="Đăng nhập" onPress={handleSubmit} disabled={isLoading} loading={isLoading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12, width: '100%', maxWidth: 360 },
});
