// src/features/sales/screens/SalesScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { IconButton, Modal, Portal, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopAppBar } from '../components/TopAppBar';
import { ProductArea } from '../components/ProductArea';
import { CartSummaryBar } from '../components/CartSummaryBar';
import { CartPanel } from '../../cart/components/CartPanel';
import { useLayoutMode } from '../../../hooks/useLayoutMode';

export const SalesScreen: React.FC = () => {
  const theme = useTheme();
  const layoutMode = useLayoutMode();
  const [cartVisible, setCartVisible] = useState(false);

  useEffect(() => {
    // layoutMode có thể đổi runtime (xoay máy, foldable) — nếu giỏ hàng đang
    // mở ở phone rồi layout chuyển sang tablet rồi quay lại phone, không để
    // modal tự mở lại khi người dùng chưa bấm gì.
    if (layoutMode !== 'phone') setCartVisible(false);
  }, [layoutMode]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <TopAppBar />
      {layoutMode === 'phone' ? (
        <View style={styles.phoneBody}>
          <ProductArea />
          <CartSummaryBar onPress={() => setCartVisible(true)} />
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
          <View
            style={[
              layoutMode === 'tablet-portrait' ? styles.cartPanelPortrait : styles.cartPanel,
              { borderLeftColor: theme.colors.outlineVariant },
            ]}
          >
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
  cartPanel: { flex: 32, borderLeftWidth: StyleSheet.hairlineWidth },
  cartPanelPortrait: { flex: 45, borderLeftWidth: StyleSheet.hairlineWidth },
  phoneBody: { flex: 1 },
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
