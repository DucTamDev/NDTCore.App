import React from 'react';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import type { ConnectionStatus } from '../models/connections/ConnectionStatus';

const labelByStatus: Record<ConnectionStatus, string> = {
  Idle: 'Chưa kết nối',
  Connecting: 'Đang kết nối',
  Connected: 'Đã kết nối',
  Disconnecting: 'Đang ngắt kết nối',
  Disconnected: 'Mất kết nối',
  Error: 'Lỗi',
};

const colorByStatus: Record<ConnectionStatus, { bg: string; fg: string }> = {
  Idle: { bg: '#F3F4F6', fg: '#6B7280' },
  Connecting: { bg: '#FEF3C7', fg: '#B45309' },
  Connected: { bg: '#DCFCE7', fg: '#15803D' },
  Disconnecting: { bg: '#FEF3C7', fg: '#B45309' },
  Disconnected: { bg: '#FEE2E2', fg: '#B91C1C' },
  Error: { bg: '#FEE2E2', fg: '#B91C1C' },
};

export interface PrinterStatusBadgeProps {
  status: ConnectionStatus;
}

export const PrinterStatusBadge: React.FC<PrinterStatusBadgeProps> = ({ status }) => {
  const colors = colorByStatus[status];
  return (
    <Text style={[styles.badge, { backgroundColor: colors.bg, color: colors.fg }]}>
      {labelByStatus[status]}
    </Text>
  );
};

const styles = StyleSheet.create({
  badge: { fontSize: 12, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, overflow: 'hidden' },
});
