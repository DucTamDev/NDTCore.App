// src/features/cart/components/OrderHistoryListItem.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { formatCurrency } from '../../../utils/formatCurrency';
import { OrderStatusBadge } from './OrderStatusBadge';
import type { OrderHistoryItem } from '../types/cart.types';

export interface OrderHistoryListItemProps {
  order: OrderHistoryItem;
  isReprinting: boolean;
  onReprint: (orderId: number) => void;
}

const formatTime = (isoDate: string | null): string =>
  isoDate === null ? '' : new Date(isoDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

export const OrderHistoryListItem: React.FC<OrderHistoryListItemProps> = ({ order, isReprinting, onReprint }) => (
  <View style={styles.row}>
    <View style={styles.info}>
      <View style={styles.headerLine}>
        <Text style={styles.orderNumber}>{order.OrderNumber}</Text>
        <Text style={styles.time}>{formatTime(order.CreatedAt)}</Text>
      </View>
      <Text style={styles.itemSummary} numberOfLines={2}>
        {order.ItemSummary}
      </Text>
      <View style={styles.footerLine}>
        <OrderStatusBadge status={order.Status} />
        <Text style={styles.total}>{formatCurrency(order.TotalAmount)}</Text>
      </View>
    </View>
    <AppButton
      label="In lại"
      mode="outlined"
      loading={isReprinting}
      disabled={isReprinting}
      onPress={() => onReprint(order.Id)}
    />
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB' },
  info: { flex: 1, gap: 4 },
  headerLine: { flexDirection: 'row', justifyContent: 'space-between' },
  orderNumber: { fontSize: 13, fontWeight: '600' },
  time: { fontSize: 12, color: '#6B7280' },
  itemSummary: { fontSize: 12, color: '#374151' },
  footerLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  total: { fontSize: 13, fontWeight: '600' },
});
