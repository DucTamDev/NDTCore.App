// src/features/sales/components/TopAppBar.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

export const TopAppBar: React.FC = () => {
  const theme = useTheme();
  return (
    <View style={[styles.container, { borderBottomColor: theme.colors.outlineVariant }]}>
      <Text variant="titleMedium">Bán hàng</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
