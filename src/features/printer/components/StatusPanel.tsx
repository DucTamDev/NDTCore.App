import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { PrinterLang, type Printer } from '@ndtcore/printer';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
import type { SetupConnectionState } from '../hooks/addPrinter/usePrinterSetupSession';

const languageLabel: Record<PrinterLang, string> = {
  [PrinterLang.EscPos]: 'ESC/POS',
  [PrinterLang.Tspl]: 'TSPL',
};

/** Thuộc tính khung trạng thái kết nối của máy đang thêm. */
export interface StatusPanelProps {
  /** Trạng thái kết nối. */
  connectionState: SetupConnectionState;

  /** Câu lỗi khi kết nối hỏng. */
  errorMessage?: string;

  /** Máy mất kết nối trong lúc cấu hình. */
  connectionLost: boolean;

  /** Bản nháp khi đã kết nối. */
  draft?: Printer;
}

/** Đang kết nối, lỗi, hoặc đã kết nối kèm hãng, model và ngôn ngữ dò được. */
export const StatusPanel: React.FC<StatusPanelProps> = ({
  connectionState,
  errorMessage,
  connectionLost,
  draft,
}) => {
  if (connectionState === 'connecting') {
    return (
      <View style={styles.container}>
        <LoadingOverlay />
        <Text variant="bodyMedium">
          Đang kết nối và nhận diện ngôn ngữ lệnh in...
        </Text>
      </View>
    );
  }

  if (connectionState === 'error') {
    return (
      <View style={styles.container}>
        <Text variant="bodyMedium" style={styles.errorText}>
          {errorMessage ?? 'Kết nối thất bại'}
        </Text>
      </View>
    );
  }

  if (connectionState !== 'connected' || !draft) {
    return null;
  }

  const { deviceInfo, config } = draft;

  return (
    <View style={styles.container}>
      <Text
        variant="bodyMedium"
        style={connectionLost ? styles.errorText : styles.successText}
      >
        {connectionLost ? 'Mất kết nối máy in, vẫn lưu được' : '✓ Đã kết nối'}
      </Text>
      {deviceInfo.manufacturer ? (
        <Text variant="bodySmall">
          Hãng sản xuất: {deviceInfo.manufacturer}
        </Text>
      ) : null}
      {deviceInfo.model ? (
        <Text variant="bodySmall">Model: {deviceInfo.model}</Text>
      ) : null}
      <Text variant="bodySmall">
        {config.lang
          ? `Ngôn ngữ lệnh in: ${languageLabel[config.lang]} (tự nhận diện)`
          : 'Không tự nhận diện được ngôn ngữ lệnh in, hãy chọn bên dưới'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 8 },
  errorText: { color: '#B91C1C' },
  successText: { color: '#15803D' },
});
