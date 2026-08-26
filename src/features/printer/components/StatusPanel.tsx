// src/features/printer/components/StatusPanel.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, SegmentedButtons } from 'react-native-paper';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
import type { PrinterDeviceInfo, PrinterDriverType } from '../types/printer.types';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';
export type ProtocolState = 'idle' | 'detecting' | 'identified' | 'unknown';

export interface StatusPanelProps {
  connectionState: ConnectionState;
  protocolState: ProtocolState;
  protocol?: PrinterDriverType;
  deviceInfo?: PrinterDeviceInfo;
  errorMessage?: string;
  /** Chỉ hiện lựa chọn thủ công cho driver type CHƯA có trong printer đang thêm/sửa (spec §5.1). */
  excludedDrivers: PrinterDriverType[];
  onChooseProtocol: (protocol: PrinterDriverType) => void;
}

const protocolLabel: Record<PrinterDriverType, string> = {
  escpos: 'ESC/POS',
  tspl: 'TSPL',
};

const ALL_PROTOCOLS: PrinterDriverType[] = ['escpos', 'tspl'];

export const StatusPanel: React.FC<StatusPanelProps> = ({
  connectionState,
  protocolState,
  protocol,
  deviceInfo,
  errorMessage,
  excludedDrivers,
  onChooseProtocol,
}) => {
  if (protocolState === 'unknown') {
    const choices = ALL_PROTOCOLS.filter((type) => !excludedDrivers.includes(type)).map((type) => ({ value: type, label: protocolLabel[type] }));
    return (
      <View style={styles.container}>
        <Text variant="bodyMedium">Không thể tự nhận diện giao thức. Vui lòng chọn thủ công:</Text>
        <SegmentedButtons value="" onValueChange={(value) => onChooseProtocol(value as PrinterDriverType)} buttons={choices} />
      </View>
    );
  }

  if (connectionState === 'error') {
    return (
      <View style={styles.container}>
        <Text variant="bodyMedium" style={styles.errorText}>{errorMessage ?? 'Kết nối thất bại.'}</Text>
      </View>
    );
  }

  if (connectionState === 'connecting' && protocolState === 'detecting') {
    return (
      <View style={styles.container}>
        <LoadingOverlay />
        <Text variant="bodyMedium">Đang nhận diện giao thức...</Text>
      </View>
    );
  }

  if (connectionState === 'connecting') {
    return (
      <View style={styles.container}>
        <LoadingOverlay />
        <Text variant="bodyMedium">Đang kết nối...</Text>
      </View>
    );
  }

  if (connectionState === 'connected' && protocolState === 'identified') {
    return (
      <View style={styles.container}>
        <Text variant="bodyMedium" style={styles.successText}>✓ Đã kết nối</Text>
        {deviceInfo?.vendor ? <Text variant="bodySmall">Hãng sản xuất: {deviceInfo.vendor}</Text> : null}
        {deviceInfo?.model ? <Text variant="bodySmall">Model: {deviceInfo.model}</Text> : null}
        {protocol ? <Text variant="bodySmall">Giao thức: {protocolLabel[protocol]}</Text> : null}
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: { gap: 8 },
  errorText: { color: '#B91C1C' },
  successText: { color: '#15803D' },
});
