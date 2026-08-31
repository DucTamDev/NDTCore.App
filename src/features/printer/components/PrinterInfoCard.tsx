import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Chip } from 'react-native-paper';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { AppInput } from '../../../components/AppInput';
import { AppSelect } from '../../../components/AppSelect';
import { AppSwitch } from '../../../components/AppSwitch';
import { AppButton } from '../../../components/AppButton';
import { PrinterStatusBadge } from './PrinterStatusBadge';
import { DriverMediaSection } from './DriverMediaSection';
import { getDriverDefinition } from '../definitions/PrinterDriverDefinitions';
import type { PrinterDisplayValues } from '../schemas/printerFormSchema';
import { PrintType } from '../types/printConfiguration.types';
import { DriverSource, PrinterDriverType, PrinterStatus, TsplCodepage, TsplRenderMode } from '../types/printer.types';
import { DEFAULT_TSPL_INTERNAL_FONT, mediaOf, tsplRenderModeOf } from '../drivers/driverConfig';
import type { ConnectionType, PrintMedia, PrinterDeviceInfo, PrinterDriver, TsplInternalFontConfig } from '../types/printer.types';

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

const tsplRenderModeLabel: Record<TsplRenderMode, string> = {
  bitmap: 'Bitmap — render nội dung thành ảnh (khuyến nghị)',
  truetype: 'Font TrueType — tải font .ttf lên máy in (thử nghiệm)',
  internalfont: 'Font máy in — dùng font & codepage sẵn có của máy in (thử nghiệm)',
};

const tsplRenderModeOptions = [TsplRenderMode.bitmap, TsplRenderMode.truetype, TsplRenderMode.internalfont].map((mode) => ({
  label: tsplRenderModeLabel[mode],
  value: mode,
}));

const tsplCodepageOptions = [
  { label: 'UTF-8', value: TsplCodepage.utf8 },
  { label: 'Windows-1258 (tiếng Việt)', value: TsplCodepage.cp1258 },
  { label: 'Windows-1252 (Tây Âu)', value: TsplCodepage.cp1252 },
];

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

      <AppSwitch label="Tự động kết nối lại" value={autoReconnect} onValueChange={onAutoReconnectChange} disabled={locked} />

      {drivers.map((driver) => (
        <View key={driver.type} style={styles.driverCard}>
          <View style={styles.row}>
            <Chip>{`Driver: ${protocolLabel[driver.type]}`}</Chip>
            <Chip>{driver.source === DriverSource.auto ? 'Tự động nhận diện' : 'Người dùng chọn'}</Chip>
          </View>
          <DriverMediaSection
            driverType={driver.type}
            media={mediaOf(driver)}
            disabled={locked}
            onChange={(patch) => onChangeDriverMedia(driver.type, patch)}
          />
          {getDriverDefinition(driver.type).contentTypes.map((contentType) => (
            <AppSwitch
              key={contentType}
              label={contentTypeLabel[contentType]}
              value={driver.contentTypes.includes(contentType)}
              onValueChange={(value) => onToggleContentType(driver.type, contentType, value)}
              disabled={locked || (!driver.contentTypes.includes(contentType) && claimedElsewhere(driver.type, contentType))}
            />
          ))}
          {driver.type === PrinterDriverType.tspl ? (
            <View style={styles.tsplModeBlock}>
              <AppSelect
                label="Chế độ in TSPL"
                value={tsplRenderModeOf(driver) ?? TsplRenderMode.bitmap}
                onSelect={(value) => onSelectTsplRenderMode(value as TsplRenderMode)}
                options={tsplRenderModeOptions}
                disabled={locked || tsplFontPending}
              />
              {tsplRenderModeOf(driver) === TsplRenderMode.internalfont ? (
                <>
                  <AppSelect
                    label="Bảng mã (Codepage)"
                    value={
                      (driver.config.type === PrinterDriverType.tspl && driver.config.internalFont?.codepage) ||
                      DEFAULT_TSPL_INTERNAL_FONT.codepage
                    }
                    onSelect={(value) => onChangeTsplInternalFont({ codepage: value as TsplCodepage })}
                    options={tsplCodepageOptions}
                    disabled={locked}
                  />
                  <AppInput
                    label="Tên font máy in"
                    value={
                      (driver.config.type === PrinterDriverType.tspl && driver.config.internalFont?.fontName) ||
                      DEFAULT_TSPL_INTERNAL_FONT.fontName
                    }
                    onChangeText={(text) => onChangeTsplInternalFont({ fontName: text })}
                    disabled={locked}
                  />
                </>
              ) : null}
            </View>
          ) : null}
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
      <View style={styles.testPrintRow}>
        <AppButton
          label="In bill thử"
          mode="outlined"
          style={styles.testPrintButton}
          disabled={status !== PrinterStatus.connected || !canPrint(PrintType.Receipt) || testPrintReceiptPending}
          loading={testPrintReceiptPending}
          onPress={onTestPrintReceipt}
        />
        <AppButton
          label="In tem thử"
          mode="outlined"
          style={styles.testPrintButton}
          disabled={status !== PrinterStatus.connected || !canPrint(PrintType.Label) || testPrintLabelPending}
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
  tsplModeBlock: { gap: 8 },
  testPrintRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  testPrintButton: { flex: 1 },
});
