// src/features/sales/components/ProductArea.tsx
import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { EmptyState } from '../../../components/EmptyState';
import { CategoryTabs } from '../../catalog/components/CategoryTabs';
import { SearchBar } from '../../catalog/components/SearchBar';
import { ProductGrid } from '../../catalog/components/ProductGrid';
import { useCatalog } from '../../catalog/hooks/useCatalog';
import { CatalogService } from '../../catalog/services/CatalogService';
import { ALL_CATEGORY_ID } from '../../catalog/types/catalog.types';
import { useSalesLayoutMode } from '../hooks/useSalesLayoutMode';
import type { CategorySelection } from '../../catalog/types/catalog.types';
import type { SalesLayoutMode } from '../hooks/useSalesLayoutMode';

const NUM_COLUMNS_BY_LAYOUT: Record<SalesLayoutMode, number> = {
  'tablet-landscape': 3,
  'tablet-portrait': 2,
  phone: 2,
};

export const ProductArea: React.FC = () => {
  const layoutMode = useSalesLayoutMode();
  const { categories, products, isLoading, error, retry } = useCatalog();
  const [selectedCategoryId, setSelectedCategoryId] = useState<CategorySelection>(ALL_CATEGORY_ID);
  const [searchKeyword, setSearchKeyword] = useState('');

  const filteredProducts = useMemo(() => {
    const byCategory = CatalogService.filterByCategory(products, categories, selectedCategoryId);
    return CatalogService.searchProducts(byCategory, searchKeyword);
  }, [products, categories, selectedCategoryId, searchKeyword]);

  if (!isLoading && error) {
    return (
      <View style={styles.errorWrap}>
        <EmptyState message={error} />
        <Button mode="outlined" onPress={retry}>
          Thử lại
        </Button>
      </View>
    );
  }

  const trimmedKeyword = searchKeyword.trim();

  return (
    <View style={styles.container}>
      <CategoryTabs
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelect={setSelectedCategoryId}
      />
      <SearchBar value={searchKeyword} onChangeText={setSearchKeyword} />
      <ProductGrid
        products={filteredProducts}
        numColumns={NUM_COLUMNS_BY_LAYOUT[layoutMode]}
        isLoading={isLoading}
        emptyMessage={trimmedKeyword ? `Không tìm thấy sản phẩm "${trimmedKeyword}"` : 'Không có sản phẩm'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
});
