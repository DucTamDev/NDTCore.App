import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Chip, List } from 'react-native-paper';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { ConnectionState, type PrinterStatus } from '@ndtcore/printer';
import { AppInput } from '../../../components/AppInput';
import { AppButton } from '../../../components/AppButton';
import { PrinterStatusBadge } from './PrinterStatusBadge';
import { PaperSection } from './PaperSection';
import { TestPrintPanel } from './TestPrintPanel';
import type { PrinterDisplayValues } from '../forms/addPrinter/PrinterDisplaySchema';
import { PrintKind } from '../models/printer/PrintKind';
import { PRINT_KIND_LABELS } from '../utils/printKindLabels';
import { LanguageSelection, type PrinterLanguage } from '../models/printer/PrinterLanguage';
import { ConnectionType } from '../models/connections/ConnectionType';
import { ConnectionStatus } from '../models/connections/ConnectionStatus';
import type { DeviceInfo } from '../models/device/DeviceInfo';
import type { PaperForm } from '../forms/addPrinter/PaperFormSchema';

/** Trạng thái của luồng thêm máy cũ theo dạng package, để dùng chung nhãn trạng thái của danh sách máy in. */
const STATE_BY_STATUS: Record<ConnectionStatus, ConnectionState> = {
  [ConnectionStatus.Idle]: ConnectionState.Disconnected,
  [ConnectionStatus.Connecting]: ConnectionState.Connecting,
  [ConnectionStatus.Connected]: ConnectionState.Connected,
  [ConnectionStatus.Disconnecting]: ConnectionState.Connecting,
  [ConnectionStatus.Disconnected]: ConnectionState.Disconnected,
  [ConnectionStatus.Error]: ConnectionState.Error,
};

const packageStatusOf = (status: ConnectionStatus): PrinterStatus => ({ state: STATE_BY_STATUS[status], actions: [] });

const connectionLabel: Record<ConnectionType, string> = {
  Usb: 'USB',
  Bluetooth: 'Bluetooth',
  Lan: 'LAN',
};

const languageLabel: Record<PrinterLanguage['type'], string> = {
  EscPos: 'ESC/POS',
  Tspl: 'TSPL',
};

export interface PrinterInfoCardProps {
  control: Control<PrinterDisplayValues>;
  errors: FieldErrors<PrinterDisplayValues>;
  connectionType: ConnectionType;
  /** `undefined` trước khi discovery xác nhận. */
  language?: PrinterLanguage;
  /** Form giấy; với máy in đã lưu, đổi giấy hợp lệ được ghi ngay. */
  paperForm: PaperForm;
  /** Thiết bị đang chọn, để hiển thị tên, hãng và model nếu đọc được. */
  device?: DeviceInfo;
  status: ConnectionStatus;
  testPrintPending: boolean;
  onTestPrint: () => void;
  /** Số hàng die-cut cho "In thử" — giữ dạng text để nhập dở. */
  testPrintRowsText: string;
  onTestPrintRowsChange: (text: string) => void;
  /** Loại nội dung CỐ ĐỊNH của printer này. */
  kind: PrintKind;
  onSave: () => void;
  saveDisabled: boolean;
  locked: boolean;
}

export const PrinterInfoCard: React.FC<PrinterInfoCardProps> = ({
  control,
  errors,
  connectionType,
  language,
  paperForm,
  device,
  status,
  testPrintPending,
  onTestPrint,
  testPrintRowsText,
  onTestPrintRowsChange,
  kind,
  onSave,
  saveDisabled,
  locked,
}) => {
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  return (
    <View style={styles.container}>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <AppInput label="Tên hiển thị" value={field.value} onChangeText={field.onChange} errorMessage={errors.name?.message} disabled={locked} />
        )}
      />

      {device?.name ? <Text variant="bodySmall">Tên thiết bị: {device.name}</Text> : null}
      {device?.manufacturer ? <Text variant="bodySmall">Hãng sản xuất: {device.manufacturer}</Text> : null}
      {device?.model ? <Text variant="bodySmall">Model: {device.model}</Text> : null}
      <View style={styles.row}>
        <Text variant="bodySmall">Loại kết nối: {connectionLabel[connectionType]}</Text>
        <PrinterStatusBadge status={packageStatusOf(status)} />
      </View>

      {language ? (
        <View style={styles.languageCard}>
          <View style={styles.row}>
            <Chip>{`Driver: ${languageLabel[language.type]}`}</Chip>
            <Chip>{language.selection === LanguageSelection.Auto ? 'Tự động nhận diện' : 'Người dùng chọn'}</Chip>
            <Chip>{`In: ${PRINT_KIND_LABELS[kind]}`}</Chip>
          </View>
        </View>
      ) : null}

      <List.Accordion
        title="Cài đặt nâng cao"
        expanded={advancedExpanded}
        onPress={() => setAdvancedExpanded((v) => !v)}
        style={styles.advancedAccordion}
      >
        <PaperSection languageType={language?.type} form={paperForm} disabled={locked} />
        {kind === PrintKind.Label ? (
          <AppInput label="Số hàng in thử" keyboardType="numeric" value={testPrintRowsText} onChangeText={onTestPrintRowsChange} disabled={locked} />
        ) : null}
      </List.Accordion>

      <TestPrintPanel status={status} kind={kind} testPrintPending={testPrintPending} onTestPrint={onTestPrint} />
      <AppButton label="Lưu máy in" disabled={saveDisabled} onPress={onSave} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  languageCard: { gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F9FAFB' },
  advancedAccordion: { paddingHorizontal: 0 },
});
