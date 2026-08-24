// src/features/printer/components/PrinterInfoCard.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Chip } from 'react-native-paper';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { AppInput } from '../../../components/AppInput';
import { AppSelect } from '../../../components/AppSelect';
import { AppSwitch } from '../../../components/AppSwitch';
import { AppButton } from '../../../components/AppButton';
import { PrinterStatusBadge } from './PrinterStatusBadge';
import type { PrinterDisplayValues } from '../schemas/printerFormSchema';
import type { ConnectionType, PrinterDeviceInfo, PrinterStatus, Protocol, ProtocolSource } from '../types/printer.types';

const connectionLabel: Record<ConnectionType, string> = {
  usb: 'USB',
  bluetooth: 'Bluetooth',
  lan: 'LAN',
};

const protocolLabel: Record<Protocol, string> = {
  escpos: 'ESC/POS',
  tspl: 'TSPL',
};

export interface PrinterInfoCardProps {
  control: Control<PrinterDisplayValues>;
  errors: FieldErrors<PrinterDisplayValues>;
  connectionType: ConnectionType;
  protocol?: Protocol;
  protocolSource?: ProtocolSource;
  deviceInfo?: PrinterDeviceInfo;
  status: PrinterStatus;
  autoReconnect: boolean;
  onAutoReconnectChange: (value: boolean) => void;
  printsReceipt: boolean;
  onPrintsReceiptChange: (value: boolean) => void;
  printsLabel: boolean;
  onPrintsLabelChange: (value: boolean) => void;
  tsplRenderAsImage: boolean;
  onTsplRenderAsImageChange: (value: boolean) => void;
  testPrintReceiptPending: boolean;
  onTestPrintReceipt: () => void;
  testPrintLabelPending: boolean;
  onTestPrintLabel: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  locked: boolean;
}

export const PrinterInfoCard: React.FC<PrinterInfoCardProps> = ({
  control,
  errors,
  connectionType,
  protocol,
  protocolSource,
  deviceInfo,
  status,
  autoReconnect,
  onAutoReconnectChange,
  printsReceipt,
  onPrintsReceiptChange,
  printsLabel,
  onPrintsLabelChange,
  tsplRenderAsImage,
  onTsplRenderAsImageChange,
  testPrintReceiptPending,
  onTestPrintReceipt,
  testPrintLabelPending,
  onTestPrintLabel,
  onSave,
  saveDisabled,
  locked,
}) => (
  <View style={styles.container}>
    <Controller
      control={control}
      name="printerName"
      render={({ field }) => (
        <AppInput
          label="Tên hiển thị"
          value={field.value}
          onChangeText={field.onChange}
          errorMessage={errors.printerName?.message}
          disabled={locked}
        />
      )}
    />

    {deviceInfo?.deviceName ? <Text variant="bodySmall">Tên thiết bị: {deviceInfo.deviceName}</Text> : null}
    {deviceInfo?.vendor ? <Text variant="bodySmall">Hãng sản xuất: {deviceInfo.vendor}</Text> : null}
    {deviceInfo?.model ? <Text variant="bodySmall">Model: {deviceInfo.model}</Text> : null}
    <Text variant="bodySmall">Loại kết nối: {connectionLabel[connectionType]}</Text>

    <View style={styles.row}>
      {protocol ? <Chip>{`Giao thức: ${protocolLabel[protocol]}`}</Chip> : null}
      {protocolSource ? <Chip>{protocolSource === 'auto' ? 'Tự động nhận diện' : 'Người dùng chọn'}</Chip> : null}
      <PrinterStatusBadge status={status} />
    </View>

    <Controller
      control={control}
      name="paperSize"
      render={({ field }) => (
        <AppSelect
          label="Khổ giấy"
          value={field.value}
          onSelect={field.onChange}
          options={[
            { label: '58mm', value: '58mm' },
            { label: '80mm', value: '80mm' },
          ]}
          disabled={locked}
        />
      )}
    />

    <AppSwitch label="Tự động kết nối lại" value={autoReconnect} onValueChange={onAutoReconnectChange} disabled={locked} />
    <AppSwitch label="In Hoá đơn" value={printsReceipt} onValueChange={onPrintsReceiptChange} disabled={locked} />
    <AppSwitch label="In Tem" value={printsLabel} onValueChange={onPrintsLabelChange} disabled={locked} />
    {protocol === 'tspl' ? (
      <AppSwitch
        label="In bằng ảnh (khắc phục lỗi font tiếng Việt)"
        value={tsplRenderAsImage}
        onValueChange={onTsplRenderAsImageChange}
        disabled={locked}
      />
    ) : null}

    <View style={styles.testPrintRow}>
      <AppButton
        label="In bill thử"
        mode="outlined"
        style={styles.testPrintButton}
        disabled={status !== 'connected' || !printsReceipt || testPrintReceiptPending}
        loading={testPrintReceiptPending}
        onPress={onTestPrintReceipt}
      />
      <AppButton
        label="In tem thử"
        mode="outlined"
        style={styles.testPrintButton}
        disabled={status !== 'connected' || !printsLabel || testPrintLabelPending}
        loading={testPrintLabelPending}
        onPress={onTestPrintLabel}
      />
    </View>
    <AppButton label="Lưu máy in" disabled={saveDisabled} onPress={onSave} />
  </View>
);

const styles = StyleSheet.create({
  container: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  testPrintRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  testPrintButton: { flex: 1 },
});
