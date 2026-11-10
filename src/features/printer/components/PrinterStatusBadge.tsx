import React from 'react';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { ConnectionState, type PrinterStatus } from '@ndtcore/printer';
import { printerErrorMessageOf } from '../errors/PrinterErrorMessages';

const labelByState: Record<ConnectionState, string> = {
  [ConnectionState.Connecting]: 'Đang kết nối',
  [ConnectionState.Connected]: 'Đã kết nối',
  [ConnectionState.Disconnected]: 'Mất kết nối',
  [ConnectionState.Error]: 'Lỗi',
};

const colorByState: Record<ConnectionState, { bg: string; fg: string }> = {
  [ConnectionState.Connecting]: { bg: '#FEF3C7', fg: '#B45309' },
  [ConnectionState.Connected]: { bg: '#DCFCE7', fg: '#15803D' },
  [ConnectionState.Disconnected]: { bg: '#FEE2E2', fg: '#B91C1C' },
  [ConnectionState.Error]: { bg: '#FEE2E2', fg: '#B91C1C' },
};

/** Thuộc tính của nhãn trạng thái máy in. */
export interface PrinterStatusBadgeProps {
  /** Trạng thái kết nối của package. */
  status: PrinterStatus;
}

/** Nhãn trạng thái; có mã lỗi thì hiện câu lỗi thay vì chữ "Lỗi" chung chung. */
export const PrinterStatusBadge: React.FC<PrinterStatusBadgeProps> = ({ status }) => {
  const colors = colorByState[status.state];
  const label = status.errorCode ? printerErrorMessageOf(status.errorCode) : labelByState[status.state];

  return <Text style={[styles.badge, { backgroundColor: colors.bg, color: colors.fg }]}>{label}</Text>;
};

const styles = StyleSheet.create({
  badge: { fontSize: 12, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, overflow: 'hidden' },
});
