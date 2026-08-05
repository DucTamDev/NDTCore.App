// src/features/sales/screens/SalesScreen.tsx
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../../../navigation/RootNavigator';
import { TopAppBar } from '../components/TopAppBar';
import { ProductAreaPlaceholder } from '../components/ProductAreaPlaceholder';
import { CartPanelPlaceholder } from '../components/CartPanelPlaceholder';
import { useSalesLayoutMode } from '../hooks/useSalesLayoutMode';

type SalesScreenNavigationProp = BottomTabNavigationProp<RootTabParamList, 'Sales'>;

export const SalesScreen: React.FC = () => {
  const navigation = useNavigation<SalesScreenNavigationProp>();
  const layoutMode = useSalesLayoutMode();
  const [cartVisible, setCartVisible] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <TopAppBar onSettingsPress={() => navigation.navigate('Settings')} />
      {layoutMode === 'phone' ? (
        <View style={styles.phoneBody}>
          <ProductAreaPlaceholder />
          <TouchableOpacity style={styles.cartSummaryBar} onPress={() => setCartVisible(true)}>
            <Text variant="titleSmall" style={styles.cartSummaryText}>
              0 sản phẩm · 0đ
            </Text>
          </TouchableOpacity>
          <Portal>
            <Modal
              visible={cartVisible}
              onDismiss={() => setCartVisible(false)}
              contentContainerStyle={styles.phoneCartModal}
            >
              <CartPanelPlaceholder />
            </Modal>
          </Portal>
        </View>
      ) : (
        <View style={styles.splitBody}>
          <View style={layoutMode === 'tablet-portrait' ? styles.productAreaPortrait : styles.productArea}>
            <ProductAreaPlaceholder />
          </View>
          <View style={layoutMode === 'tablet-portrait' ? styles.cartPanelPortrait : styles.cartPanel}>
            <CartPanelPlaceholder />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'white' },
  splitBody: { flex: 1, flexDirection: 'row' },
  productArea: { flex: 0.68 },
  productAreaPortrait: { flex: 0.55 },
  cartPanel: { flex: 0.32, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#E5E7EB' },
  cartPanelPortrait: { flex: 0.45, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#E5E7EB' },
  phoneBody: { flex: 1 },
  cartSummaryBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  cartSummaryText: { color: 'white' },
  phoneCartModal: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    maxHeight: '80%',
  },
});
