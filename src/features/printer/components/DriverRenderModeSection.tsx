import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppInput } from '../../../components/AppInput';
import { AppSelect } from '../../../components/AppSelect';
import { PrintRenderMode, PrinterDriverType, TsplCodepage } from '../models/printer/PrinterDriver';
import { DEFAULT_TSPL_INTERNAL_FONT, escPosRenderModeOf, tsplRenderModeOf } from '../drivers/driverConfig';
import type { EscPosRenderMode, PrinterDriver, TsplInternalFontConfig, TsplRenderMode } from '../models/printer/PrinterDriver';

const tsplRenderModeLabel: Record<TsplRenderMode, string> = {
  bitmap: 'Bitmap (có dấu)',
  truetype: 'TrueType (thử nghiệm)',
  internalfont: 'Mặc định máy in',
};

const tsplRenderModeOptions = [PrintRenderMode.bitmap, PrintRenderMode.truetype, PrintRenderMode.internalfont].map((mode) => ({
  label: tsplRenderModeLabel[mode],
  value: mode,
}));

const tsplCodepageOptions = [
  { label: 'UTF-8', value: TsplCodepage.utf8 },
  { label: 'Windows-1258 (tiếng Việt)', value: TsplCodepage.cp1258 },
  { label: 'Windows-1252 (Tây Âu)', value: TsplCodepage.cp1252 },
];

const escPosRenderModeLabel: Record<EscPosRenderMode, string> = {
  encoder: 'Văn bản (nhanh, cần đúng codepage)',
  bitmap: 'Bitmap (chậm hơn, đúng mọi máy)',
};

const escPosRenderModeOptions = [PrintRenderMode.encoder, PrintRenderMode.bitmap].map((mode) => ({
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
      <View style={styles.renderModeBlock}>
        <AppSelect
          label="Chế độ in ESC/POS"
          value={escPosRenderModeOf(driver) ?? PrintRenderMode.encoder}
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
    <View style={styles.renderModeBlock}>
      <AppSelect
        label="Chế độ in TSPL"
        value={tsplRenderModeOf(driver) ?? PrintRenderMode.bitmap}
        onSelect={(value) => onSelectTsplRenderMode(value as TsplRenderMode)}
        options={tsplRenderModeOptions}
        disabled={disabled || tsplFontPending}
      />
      {tsplRenderModeOf(driver) === PrintRenderMode.internalfont ? (
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
  renderModeBlock: { gap: 8 },
});
