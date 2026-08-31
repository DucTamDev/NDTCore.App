import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
import { AppButton } from '../../../components/AppButton';
import { PrinterDriverType } from '../models/printer/PrinterDriver';
import { type PrinterDeviceInfo } from '../models/printer/PrinterDevice';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';
export type ProtocolState = 'idle' | 'detecting' | 'identified' | 'unknown';

export interface StatusPanelProps {
  connectionState: ConnectionState;
  protocolState: ProtocolState;
  protocol?: PrinterDriverType;
  deviceInfo?: PrinterDeviceInfo;
  errorMessage?: string;
  excludedDrivers: PrinterDriverType[];
  onChooseProtocol: (protocol: PrinterDriverType) => void;
}

const protocolLabel: Record<PrinterDriverType, string> = {
  escpos: 'ESC/POS',
  tspl: 'TSPL',
};

const ALL_PROTOCOLS: PrinterDriverType[] = [PrinterDriverType.escpos, PrinterDriverType.tspl];

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
    const choices = ALL_PROTOCOLS.filter((type) => !excludedDrivers.includes(type));
    return (
      <View style={styles.container}>
        <Text variant="bodyMedium">
          {excludedDrivers.length > 0
            ? 'Chọn giao thức cho driver tiếp theo:'
            : 'Không thể tự nhận diện giao thức. Vui lòng chọn thủ công:'}
        </Text>
        <View style={styles.choiceRow}>
          {choices.map((type) => (
            <AppButton key={type} label={protocolLabel[type]} mode="contained" onPress={() => onChooseProtocol(type)} />
          ))}
        </View>
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
  choiceRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  errorText: { color: '#B91C1C' },
  successText: { color: '#15803D' },
});
