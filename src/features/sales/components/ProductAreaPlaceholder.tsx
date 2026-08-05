// src/features/sales/components/ProductAreaPlaceholder.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { EmptyState } from '../../../components/EmptyState';

export const ProductAreaPlaceholder: React.FC = () => (
  <View style={styles.container}>
    <EmptyState message="Chưa có sản phẩm để hiển thị" />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
});
