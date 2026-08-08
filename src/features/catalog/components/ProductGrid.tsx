// src/features/catalog/components/ProductGrid.tsx
import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { EmptyState } from '../../../components/EmptyState';
import { ProductCard } from './ProductCard';
import { ProductCardSkeleton } from './ProductCardSkeleton';
import type { ProductViewModel } from '../types/catalog.types';

export interface ProductGridProps {
  products: ProductViewModel[];
  numColumns: number;
  isLoading: boolean;
  emptyMessage: string;
}

const SKELETON_COUNT = 6;

export const ProductGrid: React.FC<ProductGridProps> = ({ products, numColumns, isLoading, emptyMessage }) => {
  if (isLoading) {
    return (
      <FlatList
        data={Array.from({ length: SKELETON_COUNT }, (_, index) => index)}
        keyExtractor={(item) => `skeleton-${item}`}
        numColumns={numColumns}
        key={`skeleton-${numColumns}`}
        renderItem={() => <ProductCardSkeleton />}
        columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
        contentContainerStyle={styles.content}
      />
    );
  }

  if (products.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <FlatList
      data={products}
      keyExtractor={(item) => String(item.id)}
      numColumns={numColumns}
      key={`grid-${numColumns}`}
      renderItem={({ item }) => <ProductCard product={item} />}
      columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
      contentContainerStyle={styles.content}
    />
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  row: { gap: 12 },
});
