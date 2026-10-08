import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
import { AppButton } from '../../../components/AppButton';
import { PrintLanguage } from '../models/printer/PrinterLanguage';
import { canPrintKind } from '../forms/addPrinter/printerRules';
import type { DeviceInfo } from '../models/device/DeviceInfo';
import type { PrintKind } from '../models/printer/PrintKind';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';
export type LanguageState = 'idle' | 'detecting' | 'identified' | 'unknown';

export interface StatusPanelProps {
  connectionState: ConnectionState;
  languageState: LanguageState;
  /** Ngôn ngữ đã xác nhận. */
  languageType?: PrintLanguage;
  /** Thiết bị đang chọn, để hiển thị hãng và model nếu đọc được. */
  device?: DeviceInfo;
  errorMessage?: string;
  /** Lọc danh sách ngôn ngữ cho phép chọn tay — ESC/POS không in được tem. */
  kind: PrintKind;
  onChooseLanguage: (language: PrintLanguage) => void;
}

const languageLabel: Record<PrintLanguage, string> = {
  EscPos: 'ESC/POS',
  Tspl: 'TSPL',
};

const ALL_LANGUAGES: PrintLanguage[] = [PrintLanguage.EscPos, PrintLanguage.Tspl];

export const StatusPanel: React.FC<StatusPanelProps> = ({
  connectionState,
  languageState,
  languageType,
  device,
  errorMessage,
  kind,
  onChooseLanguage,
}) => {
  if (languageState === 'unknown') {
    const choices = ALL_LANGUAGES.filter((type) => canPrintKind(type, kind));
    return (
      <View style={styles.container}>
        <Text variant="bodyMedium">Không thể tự nhận diện giao thức. Vui lòng chọn thủ công:</Text>
        <View style={styles.choiceRow}>
          {choices.map((type) => (
            <AppButton key={type} label={languageLabel[type]} mode="contained" onPress={() => onChooseLanguage(type)} />
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

  if (connectionState === 'connecting' && languageState === 'detecting') {
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

  if (connectionState === 'connected' && languageState === 'identified') {
    return (
      <View style={styles.container}>
        <Text variant="bodyMedium" style={styles.successText}>✓ Đã kết nối</Text>
        {device?.manufacturer ? <Text variant="bodySmall">Hãng sản xuất: {device.manufacturer}</Text> : null}
        {device?.model ? <Text variant="bodySmall">Model: {device.model}</Text> : null}
        {languageType ? <Text variant="bodySmall">Giao thức: {languageLabel[languageType]}</Text> : null}
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
