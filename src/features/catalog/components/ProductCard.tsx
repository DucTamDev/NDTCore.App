// src/features/catalog/components/ProductCard.tsx
import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';
import { formatCurrency } from '../../../utils/formatCurrency';
import type { ProductViewModel } from '../types/catalog.types';

export interface ProductCardProps {
  product: ProductViewModel;
  onPress: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onPress }) => {
  const theme = useTheme();

  return (
    <TouchableRipple
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
      onPress={onPress}
      disabled={!product.isAvailable}
    >
      <View style={product.isAvailable ? styles.inner : [styles.inner, styles.unavailable]}>
        {product.badgeLabel ? (
          <View style={[styles.badge, { backgroundColor: product.badgeColorHex ?? '#EF4444' }]}>
            <Text
              variant="labelSmall"
              style={[styles.badgeText, product.badgeTextColorHex ? { color: product.badgeTextColorHex } : null]}
            >
              {product.badgeLabel}
            </Text>
          </View>
        ) : null}
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text variant="displaySmall">🧋</Text>
          </View>
        )}
        {!product.isAvailable ? (
          <View style={styles.outOfStockOverlay}>
            <Text variant="labelLarge" style={styles.outOfStockText}>
              HẾT HÀNG
            </Text>
          </View>
        ) : null}
        <Text variant="bodyMedium" numberOfLines={2} style={styles.name}>
          {product.name}
        </Text>
        <Text variant="titleSmall" style={[styles.price, { color: theme.colors.onSurface }]}>
          {formatCurrency(product.price)}
        </Text>
      </View>
    </TouchableRipple>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    height: 220,
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inner: { flex: 1 },
  unavailable: { opacity: 0.5 },
  image: { height: 144, borderRadius: 8 },
  imagePlaceholder: {
    height: 144,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: { color: 'white' },
  outOfStockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 144,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 8,
  },
  outOfStockText: { color: 'white' },
  name: { marginTop: 8 },
  price: { marginTop: 2 },
});
