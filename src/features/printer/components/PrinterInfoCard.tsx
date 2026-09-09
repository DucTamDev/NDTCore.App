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
import { getDriverCapabilities } from '../drivers/DriverCapabilities';
import type { PrinterDisplayValues } from '../forms/addPrinter/PrinterDisplaySchema';
import { PrintType } from '../models/printing/PrintType';
import { DriverSource, PrinterDriverType, TsplRenderMode } from '../models/printer/PrinterDriver';
import type { EscPosRenderMode } from '../models/printer/PrinterDriver';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import { mediaOf } from '../drivers/driverConfig';
import type { ConnectionType, PrinterDeviceInfo } from '../models/printer/PrinterDevice';
import type { PrinterDriver, TsplInternalFontConfig } from '../models/printer/PrinterDriver';
import type { PrintMedia } from '../models/media/PrintMedia';

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
  onToggleContentType: (type: PrinterDriverType, contentType: PrintType, value: boolean) => void;
  deviceInfo?: PrinterDeviceInfo;
  status: PrinterStatus;
  autoReconnect: boolean;
  onAutoReconnectChange: (value: boolean) => void;
  testPrintReceiptPending: boolean;
  onTestPrintReceipt: () => void;
  testPrintLabelPending: boolean;
  onTestPrintLabel: () => void;
  /** Chỉ có ý nghĩa khi có driver type 'tspl'. `truetype` kéo theo `installTsplFont`. */
  onSelectTsplRenderMode: (mode: TsplRenderMode) => void;
  /** Chỉ có ý nghĩa khi có driver type 'escpos'. Không có bước cài đặt nào (khác truetype). */
  onSelectEscPosRenderMode: (mode: EscPosRenderMode) => void;
  /** Cập nhật 1 phần cấu hình font máy in (`renderMode: 'internalfont'`). */
  onChangeTsplInternalFont: (patch: Partial<TsplInternalFontConfig>) => void;
  /** Cập nhật `media` per-driver (khổ giấy, loại giấy, kích thước die-cut). Wire UI ở Task 4. */
  onChangeDriverMedia: (driverType: PrinterDriverType, patch: Partial<PrintMedia>) => void;
  /** Số hàng die-cut cho "In tem thử" — giữ dạng text để nhập dở. */
  testPrintRowsText: string;
  onTestPrintRowsChange: (text: string) => void;
  /** Có driver TSPL trong list — gate ô "Số hàng in thử". */
  hasTsplDriver: boolean;
  /** true trong lúc đang chạy `installTsplFont` — vô hiệu hoá selector để tránh double-tap. */
  tsplFontPending: boolean;
  onSave: () => void;
  saveDisabled: boolean;
  locked: boolean;
}

export const PrinterInfoCard: React.FC<PrinterInfoCardProps> = ({
  control,
  errors,
  connectionType,
  drivers,
  onToggleContentType,
  deviceInfo,
  status,
  autoReconnect,
  onAutoReconnectChange,
  testPrintReceiptPending,
  onTestPrintReceipt,
  testPrintLabelPending,
  onTestPrintLabel,
  onSelectTsplRenderMode,
  onSelectEscPosRenderMode,
  onChangeTsplInternalFont,
  onChangeDriverMedia,
  testPrintRowsText,
  onTestPrintRowsChange,
  hasTsplDriver,
  tsplFontPending,
  onSave,
  saveDisabled,
  locked,
}) => {
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  const claimedElsewhere = (type: PrinterDriverType, contentType: PrintType): boolean =>
    drivers.some((d) => d.type !== type && d.contentTypes.includes(contentType));

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

      {drivers.map((driver) => (
        <View key={driver.type} style={styles.driverCard}>
          <View style={styles.row}>
            <Chip>{`Driver: ${protocolLabel[driver.type]}`}</Chip>
            <Chip>{driver.source === DriverSource.auto ? 'Tự động nhận diện' : 'Người dùng chọn'}</Chip>
          </View>
          {getDriverCapabilities(driver.type).contentTypes.map((contentType) => (
            <AppSwitch
              key={contentType}
              label={contentTypeLabel[contentType]}
              value={driver.contentTypes.includes(contentType)}
              onValueChange={(value) => onToggleContentType(driver.type, contentType, value)}
              disabled={locked || (!driver.contentTypes.includes(contentType) && claimedElsewhere(driver.type, contentType))}
            />
          ))}
        </View>
      ))}

      <List.Accordion
        title="Cài đặt nâng cao"
        expanded={advancedExpanded}
        onPress={() => setAdvancedExpanded((v) => !v)}
        style={styles.advancedAccordion}
      >
        <AppSwitch label="Tự động kết nối lại" value={autoReconnect} onValueChange={onAutoReconnectChange} disabled={locked} />
        {drivers.map((driver) => (
          <View key={driver.type} style={styles.advancedDriverBlock}>
            {drivers.length > 1 ? <Text variant="labelSmall">{protocolLabel[driver.type]}</Text> : null}
            <DriverMediaSection
              driverType={driver.type}
              media={mediaOf(driver)}
              disabled={locked}
              onChange={(patch) => onChangeDriverMedia(driver.type, patch)}
            />
            <DriverRenderModeSection
              driver={driver}
              disabled={locked}
              tsplFontPending={tsplFontPending}
              onSelectTsplRenderMode={onSelectTsplRenderMode}
              onSelectEscPosRenderMode={onSelectEscPosRenderMode}
              onChangeTsplInternalFont={onChangeTsplInternalFont}
            />
          </View>
        ))}
        {hasTsplDriver ? (
          <AppInput
            label="Số hàng in thử"
            keyboardType="numeric"
            value={testPrintRowsText}
            onChangeText={onTestPrintRowsChange}
            disabled={locked}
          />
        ) : null}
      </List.Accordion>

      <TestPrintPanel
        status={status}
        canPrintReceipt={canPrint(PrintType.Receipt)}
        canPrintLabel={canPrint(PrintType.Label)}
        testPrintReceiptPending={testPrintReceiptPending}
        testPrintLabelPending={testPrintLabelPending}
        onTestPrintReceipt={onTestPrintReceipt}
        onTestPrintLabel={onTestPrintLabel}
      />
      <AppButton label="Lưu máy in" disabled={saveDisabled} onPress={onSave} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  driverCard: { gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F9FAFB' },
  advancedAccordion: { paddingHorizontal: 0 },
  advancedDriverBlock: { gap: 8, marginBottom: 12 },
});
