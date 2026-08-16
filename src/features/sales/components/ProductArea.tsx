// src/features/sales/components/ProductArea.tsx
import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../../../store';
import { EmptyState } from '../../../components/EmptyState';
import { CategoryTabs } from '../../catalog/components/CategoryTabs';
import { SearchBar } from '../../catalog/components/SearchBar';
import { ProductGrid } from '../../catalog/components/ProductGrid';
import { useCatalog } from '../../catalog/hooks/useCatalog';
import { CatalogService } from '../../catalog/services/CatalogService';
import { ALL_CATEGORY_ID } from '../../catalog/types/catalog.types';
import { OptionSelectionModal } from '../../cart/components/OptionSelectionModal';
import { CartService } from '../../cart/services/CartService';
import { itemAdded } from '../../cart/store/cartSlice';
import { useLayoutMode, type LayoutMode } from '../../../hooks/useLayoutMode';
import type { CategorySelection, ProductViewModel } from '../../catalog/types/catalog.types';
import type { CartItemOption } from '../../cart/types/cart.types';

const NUM_COLUMNS_BY_LAYOUT: Record<LayoutMode, number> = {
  'tablet-landscape': 3,
  'tablet-portrait': 2,
  phone: 2,
};

export const ProductArea: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const layoutMode = useLayoutMode();
  const { categories, products, isLoading, error, retry } = useCatalog();
  const [selectedCategoryId, setSelectedCategoryId] = useState<CategorySelection>(ALL_CATEGORY_ID);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [productForOptions, setProductForOptions] = useState<ProductViewModel | null>(null);

  const filteredProducts = useMemo(() => {
    const byCategory = CatalogService.filterByCategory(products, categories, selectedCategoryId);
    return CatalogService.searchProducts(byCategory, searchKeyword);
  }, [products, categories, selectedCategoryId, searchKeyword]);

  const handleProductPress = (product: ProductViewModel): void => {
    if (product.optionGroups.length > 0) {
      setProductForOptions(product);
      return;
    }
    dispatch(itemAdded(CartService.buildCartItem(product, [], 1, '')));
  };

  const handleOptionsConfirm = (options: CartItemOption[], quantity: number, note: string): void => {
    if (!productForOptions) return;
    dispatch(itemAdded(CartService.buildCartItem(productForOptions, options, quantity, note)));
    setProductForOptions(null);
  };

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
  const emptyMessage = trimmedKeyword
    ? `Không tìm thấy sản phẩm "${trimmedKeyword}"`
    : selectedCategoryId !== ALL_CATEGORY_ID
      ? 'Danh mục này chưa có sản phẩm'
      : 'Không có sản phẩm';

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
        emptyMessage={emptyMessage}
        onProductPress={handleProductPress}
      />
      <OptionSelectionModal
        product={productForOptions}
        onDismiss={() => setProductForOptions(null)}
        onConfirm={handleOptionsConfirm}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
});
