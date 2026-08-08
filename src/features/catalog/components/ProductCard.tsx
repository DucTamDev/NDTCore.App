// src/features/catalog/components/ProductCard.tsx
import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import { formatCurrency } from '../../../utils/formatCurrency';
import type { ProductViewModel } from '../types/catalog.types';

export interface ProductCardProps {
  product: ProductViewModel;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => (
  // onPress chưa gắn thêm-vào-giỏ — nằm ngoài phạm vi sub-project Product catalog,
  // xem docs/superpowers/specs/2026-08-08-product-catalog-design.md. Sub-project
  // "Cart & modifier" kế tiếp sẽ nối logic thật vào đây.
  <TouchableRipple style={styles.card} onPress={() => {}} disabled={!product.isAvailable}>
    <View style={!product.isAvailable ? styles.unavailable : undefined}>
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
        <View style={styles.imagePlaceholder}>
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
      <Text variant="titleSmall" style={styles.price}>
        {formatCurrency(product.price)}
      </Text>
    </View>
  </TouchableRipple>
);

const styles = StyleSheet.create({
  card: { flex: 1, height: 220, borderRadius: 12, padding: 12, backgroundColor: 'white' },
  unavailable: { opacity: 0.5 },
  image: { flex: 1, borderRadius: 8 },
  imagePlaceholder: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
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
    bottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 8,
  },
  outOfStockText: { color: 'white' },
  name: { marginTop: 8 },
  price: { marginTop: 2, color: '#111827' },
});
