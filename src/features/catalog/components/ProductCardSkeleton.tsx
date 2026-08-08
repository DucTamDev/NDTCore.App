// src/features/catalog/components/ProductCardSkeleton.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';

export const ProductCardSkeleton: React.FC = () => (
  <View style={styles.card}>
    <View style={styles.image} />
    <View style={styles.line} />
    <View style={[styles.line, styles.lineShort]} />
  </View>
);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    height: 220,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  image: { height: 144, borderRadius: 8, backgroundColor: '#E5E7EB' },
  line: { height: 12, borderRadius: 4, backgroundColor: '#E5E7EB', marginTop: 8 },
  lineShort: { width: '50%' },
});
