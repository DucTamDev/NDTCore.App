import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Chip, List } from 'react-native-paper';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { AppInput } from '../../../components/AppInput';
import { AppSwitch } from '../../../components/AppSwitch';
import { AppButton } from '../../../components/AppButton';
import { PrinterStatusBadge } from './PrinterStatusBadge';
import { PaperSection } from './PaperSection';
import { RenderModeSection } from './RenderModeSection';
import { TestPrintPanel } from './TestPrintPanel';
import type { PrinterDisplayValues } from '../forms/addPrinter/PrinterDisplaySchema';
import { PrintKind } from '../models/printer/PrintKind';
import { PRINT_KIND_LABELS } from '../utils/printKindLabels';
import { LanguageSelection, RenderMode, type PrinterLanguage } from '../models/printer/PrinterLanguage';
import { ConnectionType } from '../models/printer/ConnectionType';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import type { DeviceInfo } from '../models/device/DeviceInfo';
import type { PaperDraft } from '../forms/addPrinter/PaperDraft';

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
  paper: PaperDraft;
  onChangePaper: (patch: Partial<PaperDraft>) => void;
  /** Thiết bị đang chọn, để hiển thị tên, hãng và model nếu đọc được. */
  device?: DeviceInfo;
  status: PrinterStatus;
  autoReconnect: boolean;
  onAutoReconnectChange: (value: boolean) => void;
  testPrintPending: boolean;
  onTestPrint: () => void;
  onSelectRenderMode: (mode: RenderMode) => void;
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
  paper,
  onChangePaper,
  device,
  status,
  autoReconnect,
  onAutoReconnectChange,
  testPrintPending,
  onTestPrint,
  onSelectRenderMode,
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
        <PrinterStatusBadge status={status} />
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
        <AppSwitch label="Tự động kết nối lại" value={autoReconnect} onValueChange={onAutoReconnectChange} disabled={locked} />
        <PaperSection languageType={language?.type} paper={paper} disabled={locked} onChange={onChangePaper} />
        {language ? (
          <RenderModeSection language={language} disabled={locked} onSelectRenderMode={onSelectRenderMode} />
        ) : null}
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
