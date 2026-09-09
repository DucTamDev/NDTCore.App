import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppInput } from '../../../components/AppInput';
import { AppSelect } from '../../../components/AppSelect';
import { EscPosRenderMode, PrinterDriverType, TsplCodepage, TsplRenderMode } from '../models/printer/PrinterDriver';
import { DEFAULT_TSPL_INTERNAL_FONT, escPosRenderModeOf, tsplRenderModeOf } from '../drivers/driverConfig';
import type { PrinterDriver, TsplInternalFontConfig } from '../models/printer/PrinterDriver';

const tsplRenderModeLabel: Record<TsplRenderMode, string> = {
  bitmap: 'Bitmap (có dấu)',
  truetype: 'TrueType (thử nghiệm)',
  internalfont: 'Mặc định máy in',
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

const escPosRenderModeLabel: Record<EscPosRenderMode, string> = {
  text: 'Văn bản (nhanh, cần đúng codepage)',
  bitmap: 'Bitmap (chậm hơn, đúng mọi máy)',
};

const escPosRenderModeOptions = [EscPosRenderMode.text, EscPosRenderMode.bitmap].map((mode) => ({
  label: escPosRenderModeLabel[mode],
  value: mode,
}));

interface DriverRenderModeSectionProps {
  driver: PrinterDriver;
  disabled: boolean;
  tsplFontPending: boolean;
  onSelectTsplRenderMode: (mode: TsplRenderMode) => void;
  onChangeTsplInternalFont: (patch: Partial<TsplInternalFontConfig>) => void;
  onSelectEscPosRenderMode: (mode: EscPosRenderMode) => void;
}

export const DriverRenderModeSection: React.FC<DriverRenderModeSectionProps> = ({
  driver,
  disabled,
  tsplFontPending,
  onSelectTsplRenderMode,
  onChangeTsplInternalFont,
  onSelectEscPosRenderMode,
}) => {
  if (driver.type === PrinterDriverType.escpos) {
    return (
      <View style={styles.tsplModeBlock}>
        <AppSelect
          label="Chế độ in ESC/POS"
          value={escPosRenderModeOf(driver) ?? EscPosRenderMode.text}
          onSelect={(value) => onSelectEscPosRenderMode(value as EscPosRenderMode)}
          options={escPosRenderModeOptions}
          disabled={disabled}
        />
      </View>
    );
  }

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
