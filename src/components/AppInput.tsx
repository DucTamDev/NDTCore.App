// src/components/AppInput.tsx
import React, { useState } from 'react';
import { TextInput, HelperText } from 'react-native-paper';
import { View } from 'react-native';

export interface AppInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  errorMessage?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  placeholder?: string;
  disabled?: boolean;
  secureTextEntry?: boolean;
}

export const AppInput: React.FC<AppInputProps> = ({
  label,
  value,
  onChangeText,
  errorMessage,
  keyboardType = 'default',
  placeholder,
  disabled = false,
  secureTextEntry = false,
}) => {
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <View>
      <TextInput
        label={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        error={Boolean(errorMessage)}
        mode="outlined"
        disabled={disabled}
        secureTextEntry={secureTextEntry && !isRevealed}
        right={
          secureTextEntry ? (
            <TextInput.Icon icon={isRevealed ? 'eye-off' : 'eye'} onPress={() => setIsRevealed((prev) => !prev)} />
          ) : undefined
        }
      />
      {errorMessage ? <HelperText type="error">{errorMessage}</HelperText> : null}
    </View>
  );
};
