// src/features/cart/components/OrderHistoryPanel.tsx
import React from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Portal, Snackbar, Text } from 'react-native-paper';
import { EmptyState } from '../../../components/EmptyState';
import { useOrderHistory } from '../hooks/useOrderHistory';
import { OrderHistoryListItem } from './OrderHistoryListItem';
import type { OrderHistoryItem } from '../types/cart.types';

export const OrderHistoryPanel: React.FC = () => {
  const {
    orders,
    isLoading,
    error,
    dismissError,
    reprint,
    reprintingIds,
    noReceiptPrinterConfigured,
    dismissReceiptPrinterWarning,
    refresh,
  } = useOrderHistory();

  return (
    <View style={styles.container}>
      <Text variant="titleSmall" style={styles.title}>
        Đơn hàng hôm nay
      </Text>
      <FlatList
        data={orders}
        keyExtractor={(item: OrderHistoryItem) => String(item.Id)}
        contentContainerStyle={orders.length === 0 ? styles.emptyContent : styles.listContent}
        renderItem={({ item }) => (
          <OrderHistoryListItem order={item} isReprinting={reprintingIds.has(item.Id)} onReprint={reprint} />
        )}
        ListEmptyComponent={!isLoading ? <EmptyState message="Chưa có đơn hàng nào hôm nay" /> : null}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
      />
      <Portal>
        <Snackbar visible={error !== null} onDismiss={dismissError} duration={4000}>
          {error}
        </Snackbar>
        <Snackbar visible={noReceiptPrinterConfigured} onDismiss={dismissReceiptPrinterWarning} duration={4000}>
          Chưa thiết lập máy in cho Hoá đơn
        </Snackbar>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { marginBottom: 4 },
  listContent: { gap: 8 },
  emptyContent: { flexGrow: 1 },
});
