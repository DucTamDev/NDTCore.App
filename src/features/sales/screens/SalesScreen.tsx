// src/features/sales/screens/SalesScreen.tsx
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { IconButton, Modal, Portal, Text, useTheme } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootState } from '../../../store';
import { formatCurrency } from '../../../utils/formatCurrency';
import { TopAppBar } from '../components/TopAppBar';
import { ProductArea } from '../components/ProductArea';
import { CartPanel } from '../../cart/components/CartPanel';
import { selectCartItemCount, selectCartTotal } from '../../cart/store/cartSlice';
import { useSalesLayoutMode } from '../hooks/useSalesLayoutMode';

export const SalesScreen: React.FC = () => {
  const theme = useTheme();
  const layoutMode = useSalesLayoutMode();
  const [cartVisible, setCartVisible] = useState(false);
  const itemCount = useSelector((state: RootState) => selectCartItemCount(state));
  const cartTotal = useSelector((state: RootState) => selectCartTotal(state));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <TopAppBar />
      {layoutMode === 'phone' ? (
        <View style={styles.phoneBody}>
          <ProductArea />
          <TouchableOpacity
            style={[styles.cartSummaryBar, { backgroundColor: theme.colors.primary }]}
            onPress={() => setCartVisible(true)}
          >
            <Text variant="titleSmall" style={styles.cartSummaryText}>
              {itemCount} sản phẩm · {formatCurrency(cartTotal)}
            </Text>
          </TouchableOpacity>
          <Portal>
            <Modal
              visible={cartVisible}
              onDismiss={() => setCartVisible(false)}
              contentContainerStyle={styles.phoneCartModal}
            >
              <View style={styles.phoneCartHeader}>
                <IconButton
                  icon="arrow-left"
                  onPress={() => setCartVisible(false)}
                  accessibilityLabel="Quay lại"
                />
                <Text variant="titleMedium">Giỏ hàng</Text>
              </View>
              <CartPanel onOrderCreated={() => setCartVisible(false)} />
            </Modal>
          </Portal>
        </View>
      ) : (
        <View style={styles.splitBody}>
          <View style={layoutMode === 'tablet-portrait' ? styles.productAreaPortrait : styles.productArea}>
            <ProductArea />
          </View>
          <View style={layoutMode === 'tablet-portrait' ? styles.cartPanelPortrait : styles.cartPanel}>
            <CartPanel />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'white' },
  splitBody: { flex: 1, flexDirection: 'row' },
  productArea: { flex: 68 },
  productAreaPortrait: { flex: 55 },
  cartPanel: { flex: 32, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#E5E7EB' },
  cartPanelPortrait: { flex: 45, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#E5E7EB' },
  phoneBody: { flex: 1 },
  cartSummaryBar: {
    padding: 16,
    alignItems: 'center',
  },
  cartSummaryText: { color: 'white' },
  phoneCartModal: {
    backgroundColor: 'white',
    margin: 0,
    padding: 16,
    height: '100%',
  },
  phoneCartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
});
