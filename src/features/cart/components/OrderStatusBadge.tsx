// src/features/cart/components/OrderStatusBadge.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

const labelByStatus: Record<string, string> = {
  Pending: 'Chờ xác nhận',
  Confirmed: 'Đang pha chế',
  Completed: 'Hoàn thành',
  Cancelled: 'Đã hủy',
};

const colorByStatus: Record<string, { bg: string; fg: string }> = {
  Pending: { bg: '#FEF3C7', fg: '#B45309' },
  Confirmed: { bg: '#DBEAFE', fg: '#1D4ED8' },
  Completed: { bg: '#DCFCE7', fg: '#15803D' },
  Cancelled: { bg: '#FEE2E2', fg: '#B91C1C' },
};

const fallbackColor = { bg: '#F3F4F6', fg: '#6B7280' };

export interface OrderStatusBadgeProps {
  status: string;
}

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status }) => {
  const colors = colorByStatus[status] ?? fallbackColor;
  return (
    <Text style={[styles.badge, { backgroundColor: colors.bg, color: colors.fg }]}>
      {labelByStatus[status] ?? status}
    </Text>
  );
};

const styles = StyleSheet.create({
  badge: { fontSize: 12, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, overflow: 'hidden' },
});
