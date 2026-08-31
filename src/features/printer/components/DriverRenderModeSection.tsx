import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppInput } from '../../../components/AppInput';
import { AppSelect } from '../../../components/AppSelect';
import { PrinterDriverType, TsplCodepage, TsplRenderMode } from '../models/printer/PrinterDriver';
import { DEFAULT_TSPL_INTERNAL_FONT, tsplRenderModeOf } from '../drivers/driverConfig';
import type { PrinterDriver, TsplInternalFontConfig } from '../models/printer/PrinterDriver';

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

interface DriverRenderModeSectionProps {
  driver: PrinterDriver;
  disabled: boolean;
  tsplFontPending: boolean;
  onSelectTsplRenderMode: (mode: TsplRenderMode) => void;
  onChangeTsplInternalFont: (patch: Partial<TsplInternalFontConfig>) => void;
}

export const DriverRenderModeSection: React.FC<DriverRenderModeSectionProps> = ({
  driver,
  disabled,
  tsplFontPending,
  onSelectTsplRenderMode,
  onChangeTsplInternalFont,
}) => {
  if (driver.type !== PrinterDriverType.tspl) {
    return null;
  }
  return (
    <View style={styles.tsplModeBlock}>
      <AppSelect
        label="Chế độ in TSPL"
        value={tsplRenderModeOf(driver) ?? TsplRenderMode.bitmap}
        onSelect={(value) => onSelectTsplRenderMode(value as TsplRenderMode)}
        options={tsplRenderModeOptions}
        disabled={disabled || tsplFontPending}
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
            disabled={disabled}
          />
          <AppInput
            label="Tên font máy in"
            value={
              (driver.config.type === PrinterDriverType.tspl && driver.config.internalFont?.fontName) ||
              DEFAULT_TSPL_INTERNAL_FONT.fontName
            }
            onChangeText={(text) => onChangeTsplInternalFont({ fontName: text })}
            disabled={disabled}
          />
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  tsplModeBlock: { gap: 8 },
});
