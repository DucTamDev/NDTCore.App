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
  protocol: Protocol;
  protocolSource: ProtocolSource;
  deviceInfo?: PrinterDeviceInfo;
  status: PrinterStatus;
  autoReconnect: boolean;
  onAutoReconnectChange: (value: boolean) => void;
  canTestPrint: boolean;
  testPrintPending: boolean;
  onTestPrint: () => void;
  onSave: () => void;
  saveDisabled: boolean;
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
  canTestPrint,
  testPrintPending,
  onTestPrint,
  onSave,
  saveDisabled,
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
        />
      )}
    />

    {deviceInfo?.deviceName ? (
      <Text variant="bodySmall">Tên thiết bị: {deviceInfo.deviceName}</Text>
    ) : null}
    {deviceInfo?.vendor ? <Text variant="bodySmall">Hãng sản xuất: {deviceInfo.vendor}</Text> : null}
    {deviceInfo?.model ? <Text variant="bodySmall">Model: {deviceInfo.model}</Text> : null}
    <Text variant="bodySmall">Loại kết nối: {connectionLabel[connectionType]}</Text>

    <View style={styles.row}>
      <Chip>{`Giao thức: ${protocolLabel[protocol]}`}</Chip>
      <Chip>{protocolSource === 'auto' ? 'Tự động nhận diện' : 'Người dùng chọn'}</Chip>
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
        />
      )}
    />

    <AppSwitch label="Tự động kết nối lại" value={autoReconnect} onValueChange={onAutoReconnectChange} />

    <View style={styles.footer}>
      <AppButton
        label="In thử"
        mode="outlined"
        disabled={status !== 'connected' || testPrintPending}
        loading={testPrintPending}
        onPress={onTestPrint}
      />
      <AppButton label="Lưu máy in" disabled={saveDisabled || !canTestPrint} onPress={onSave} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  footer: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
