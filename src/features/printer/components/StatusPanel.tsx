import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
import { AppButton } from '../../../components/AppButton';
import { PrinterDriverType } from '../models/printer/PrinterDriver';
import { getDriverCapabilities } from '../drivers/DriverCapabilities';
import { type PrinterDeviceInfo } from '../models/printer/PrinterDevice';
import type { PrintType } from '../models/printing/PrintType';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';
export type ProtocolState = 'idle' | 'detecting' | 'identified' | 'unknown';

export interface StatusPanelProps {
  connectionState: ConnectionState;
  protocolState: ProtocolState;
  protocol?: PrinterDriverType;
  deviceInfo?: PrinterDeviceInfo;
  errorMessage?: string;
  /** Lọc danh sách protocol cho phép chọn tay — ESC/POS không hỗ trợ Label. */
  printType: PrintType;
  onChooseProtocol: (protocol: PrinterDriverType) => void;
}

const protocolLabel: Record<PrinterDriverType, string> = {
  EscPos: 'ESC/POS',
  Tspl: 'TSPL',
};

const ALL_PROTOCOLS: PrinterDriverType[] = [PrinterDriverType.EscPos, PrinterDriverType.Tspl];

export const StatusPanel: React.FC<StatusPanelProps> = ({
  connectionState,
  protocolState,
  protocol,
  deviceInfo,
  errorMessage,
  printType,
  onChooseProtocol,
}) => {
  if (protocolState === 'unknown') {
    const choices = ALL_PROTOCOLS.filter((type) => getDriverCapabilities(type).contentTypes.includes(printType));
    return (
      <View style={styles.container}>
        <Text variant="bodyMedium">Không thể tự nhận diện giao thức. Vui lòng chọn thủ công:</Text>
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
