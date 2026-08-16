import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppInput } from '../../../components/AppInput';
import { AppButton } from '../../../components/AppButton';
import { loginFormSchema, type LoginFormValues } from '../schemas/loginFormSchema';
import type { LoginRequest } from '../types/auth.types';

export interface LoginFormProps {
  isLoading: boolean;
  onSubmit: (payload: LoginRequest) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ isLoading, onSubmit }) => {
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
  });

  const handleSubmit = form.handleSubmit((values) => onSubmit(values));

  return (
    <View style={styles.container}>
      <AppInput
        label="Email"
        value={form.watch('email')}
        onChangeText={(text) => form.setValue('email', text)}
        errorMessage={form.formState.errors.email?.message}
        keyboardType="email-address"
        autoCapitalize="none"
        disabled={isLoading}
      />
      <AppInput
        label="Mật khẩu"
        value={form.watch('password')}
        onChangeText={(text) => form.setValue('password', text)}
        errorMessage={form.formState.errors.password?.message}
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
