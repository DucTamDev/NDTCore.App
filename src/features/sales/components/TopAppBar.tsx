// src/features/sales/components/TopAppBar.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton } from 'react-native-paper';

export interface TopAppBarProps {
  onSettingsPress: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({ onSettingsPress }) => (
  <View style={styles.container}>
    <Text variant="titleMedium">Bán hàng</Text>
    <IconButton icon="cog" onPress={onSettingsPress} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
});
