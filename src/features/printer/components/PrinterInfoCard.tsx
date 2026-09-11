import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Chip, List } from 'react-native-paper';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { AppInput } from '../../../components/AppInput';
import { AppSwitch } from '../../../components/AppSwitch';
import { AppButton } from '../../../components/AppButton';
import { PrinterStatusBadge } from './PrinterStatusBadge';
import { DriverMediaSection } from './DriverMediaSection';
import { DriverRenderModeSection } from './DriverRenderModeSection';
import { TestPrintPanel } from './TestPrintPanel';
import type { PrinterDisplayValues } from '../forms/addPrinter/PrinterDisplaySchema';
import { PrintType, PRINT_TYPE_LABELS } from '../models/printing/PrintType';
import { DriverSource, RenderMode, type PrinterDriver } from '../models/printer/PrinterDriver';
import { PrinterConnectionType } from '../models/printer/PrinterConnection';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import type { PrinterDeviceInfo } from '../models/printer/PrinterDevice';
import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';

const connectionLabel: Record<PrinterConnectionType, string> = {
  Usb: 'USB',
  Bluetooth: 'Bluetooth',
  Lan: 'LAN',
};

const protocolLabel: Record<PrinterDriver['type'], string> = {
  EscPos: 'ESC/POS',
  Tspl: 'TSPL',
};

export interface PrinterInfoCardProps {
  control: Control<PrinterDisplayValues>;
  errors: FieldErrors<PrinterDisplayValues>;
  connectionType: PrinterConnectionType;
  /** `undefined` trước khi discovery xác nhận. */
  driver?: PrinterDriver;
  paper: PrintPaperConfig;
  onChangePaper: (patch: Partial<PrintPaperConfig>) => void;
  deviceInfo?: PrinterDeviceInfo;
  status: PrinterStatus;
  autoReconnect: boolean;
  onAutoReconnectChange: (value: boolean) => void;
  testPrintPending: boolean;
  onTestPrint: () => void;
  /** Chỉ có ý nghĩa khi driver là ESC/POS — TSPL cố định `Bitmap`. */
  onSelectRenderMode: (mode: RenderMode) => void;
  /** Số hàng die-cut cho "In thử" — giữ dạng text để nhập dở. */
  testPrintRowsText: string;
  onTestPrintRowsChange: (text: string) => void;
  /** Loại nội dung CỐ ĐỊNH của printer này. */
  printType: PrintType;
  onSave: () => void;
  saveDisabled: boolean;
  locked: boolean;
}

export const PrinterInfoCard: React.FC<PrinterInfoCardProps> = ({
  control,
  errors,
  connectionType,
  driver,
  paper,
  onChangePaper,
  deviceInfo,
  status,
  autoReconnect,
  onAutoReconnectChange,
  testPrintPending,
  onTestPrint,
  onSelectRenderMode,
  testPrintRowsText,
  onTestPrintRowsChange,
  printType,
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

      {deviceInfo?.deviceName ? <Text variant="bodySmall">Tên thiết bị: {deviceInfo.deviceName}</Text> : null}
      {deviceInfo?.vendor ? <Text variant="bodySmall">Hãng sản xuất: {deviceInfo.vendor}</Text> : null}
      {deviceInfo?.model ? <Text variant="bodySmall">Model: {deviceInfo.model}</Text> : null}
      <View style={styles.row}>
        <Text variant="bodySmall">Loại kết nối: {connectionLabel[connectionType]}</Text>
        <PrinterStatusBadge status={status} />
      </View>

      {driver ? (
        <View style={styles.driverCard}>
          <View style={styles.row}>
            <Chip>{`Driver: ${protocolLabel[driver.type]}`}</Chip>
            <Chip>{driver.source === DriverSource.Auto ? 'Tự động nhận diện' : 'Người dùng chọn'}</Chip>
            <Chip>{`In: ${PRINT_TYPE_LABELS[printType]}`}</Chip>
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
        <DriverMediaSection driverType={driver?.type} paper={paper} disabled={locked} onChange={onChangePaper} />
        {driver ? <DriverRenderModeSection driver={driver} disabled={locked} onSelectRenderMode={onSelectRenderMode} /> : null}
        {printType === PrintType.Label ? (
          <AppInput label="Số hàng in thử" keyboardType="numeric" value={testPrintRowsText} onChangeText={onTestPrintRowsChange} disabled={locked} />
        ) : null}
      </List.Accordion>

      <TestPrintPanel status={status} printType={printType} testPrintPending={testPrintPending} onTestPrint={onTestPrint} />
      <AppButton label="Lưu máy in" disabled={saveDisabled} onPress={onSave} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  driverCard: { gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F9FAFB' },
  advancedAccordion: { paddingHorizontal: 0 },
});
