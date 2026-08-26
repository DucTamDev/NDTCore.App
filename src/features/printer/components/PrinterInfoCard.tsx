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
import { getDriverDefinition } from '../definitions/PrinterDriverDefinitions';
import type { PrinterDisplayValues } from '../schemas/printerFormSchema';
import type { PrintType } from '../types/printConfiguration.types';
import type { ConnectionType, PrinterDeviceInfo, PrinterDriver, PrinterDriverType, PrinterStatus } from '../types/printer.types';

const connectionLabel: Record<ConnectionType, string> = {
  usb: 'USB',
  bluetooth: 'Bluetooth',
  lan: 'LAN',
};

const protocolLabel: Record<PrinterDriverType, string> = {
  escpos: 'ESC/POS',
  tspl: 'TSPL',
};

const contentTypeLabel: Record<PrintType, string> = {
  Receipt: 'In Hoá đơn',
  Label: 'In Tem',
};

export interface PrinterInfoCardProps {
  control: Control<PrinterDisplayValues>;
  errors: FieldErrors<PrinterDisplayValues>;
  connectionType: ConnectionType;
  drivers: PrinterDriver[];
  onUpdateDriverContentTypes: (type: PrinterDriverType, contentTypes: PrintType[]) => void;
  deviceInfo?: PrinterDeviceInfo;
  status: PrinterStatus;
  autoReconnect: boolean;
  onAutoReconnectChange: (value: boolean) => void;
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
  drivers,
  onUpdateDriverContentTypes,
  deviceInfo,
  status,
  autoReconnect,
  onAutoReconnectChange,
  testPrintReceiptPending,
  onTestPrintReceipt,
  testPrintLabelPending,
  onTestPrintLabel,
  onSave,
  saveDisabled,
  locked,
}) => {
  const claimedElsewhere = (type: PrinterDriverType, contentType: PrintType): boolean =>
    drivers.some((d) => d.type !== type && d.contentTypes.includes(contentType));

  const toggleContentType = (driver: PrinterDriver, contentType: PrintType, value: boolean): void => {
    const next = value ? [...driver.contentTypes, contentType] : driver.contentTypes.filter((ct) => ct !== contentType);
    onUpdateDriverContentTypes(driver.type, next);
  };

  const canPrint = (contentType: PrintType): boolean => drivers.some((d) => d.contentTypes.includes(contentType));

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

      <Controller
        control={control}
        name="paperSize"
        render={({ field }) => (
          <AppSelect
            label="Khổ giấy"
            value={String(field.value)}
            onSelect={(value) => field.onChange(Number(value))}
            options={[
              { label: '58mm', value: '58' },
              { label: '80mm', value: '80' },
            ]}
            disabled={locked}
          />
        )}
      />

      <AppSwitch label="Tự động kết nối lại" value={autoReconnect} onValueChange={onAutoReconnectChange} disabled={locked} />

      {drivers.map((driver) => (
        <View key={driver.type} style={styles.driverCard}>
          <View style={styles.row}>
            <Chip>{`Driver: ${protocolLabel[driver.type]}`}</Chip>
            <Chip>{driver.source === 'auto' ? 'Tự động nhận diện' : 'Người dùng chọn'}</Chip>
          </View>
          {getDriverDefinition(driver.type).contentTypes.map((contentType) => (
            <AppSwitch
              key={contentType}
              label={contentTypeLabel[contentType]}
              value={driver.contentTypes.includes(contentType)}
              onValueChange={(value) => toggleContentType(driver, contentType, value)}
              disabled={locked || (!driver.contentTypes.includes(contentType) && claimedElsewhere(driver.type, contentType))}
            />
          ))}
          {driver.type === 'tspl' ? <Text variant="bodySmall" style={styles.renderModeLabel}>Chế độ render: Bitmap</Text> : null}
        </View>
      ))}

      <View style={styles.testPrintRow}>
        <AppButton
          label="In bill thử"
          mode="outlined"
          style={styles.testPrintButton}
          disabled={status !== 'connected' || !canPrint('Receipt') || testPrintReceiptPending}
          loading={testPrintReceiptPending}
          onPress={onTestPrintReceipt}
        />
        <AppButton
          label="In tem thử"
          mode="outlined"
          style={styles.testPrintButton}
          disabled={status !== 'connected' || !canPrint('Label') || testPrintLabelPending}
          loading={testPrintLabelPending}
          onPress={onTestPrintLabel}
        />
      </View>
      <AppButton label="Lưu máy in" disabled={saveDisabled} onPress={onSave} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  driverCard: { gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB' },
  renderModeLabel: { color: '#6B7280' },
  testPrintRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  testPrintButton: { flex: 1 },
});
