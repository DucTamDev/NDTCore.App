import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppSelect } from '../../../components/AppSelect';
import { RenderMode, PrinterDriverType } from '../models/printer/PrinterDriver';
import type { PrinterDriver } from '../models/printer/PrinterDriver';

const escPosRenderModeLabel: Record<RenderMode, string> = {
  Encoder: 'Văn bản (nhanh, cần đúng codepage)',
  Bitmap: 'Bitmap (chậm hơn, đúng mọi máy)',
};

const escPosRenderModeOptions = [RenderMode.Encoder, RenderMode.Bitmap].map((mode) => ({ label: escPosRenderModeLabel[mode], value: mode }));

interface DriverRenderModeSectionProps {
  driver: PrinterDriver;
  disabled: boolean;
  onSelectRenderMode: (mode: RenderMode) => void;
}

/** TSPL cố định `Bitmap` (schema ràng buộc, TrueType/internal-font đã bỏ) — không hiện selector, chỉ ESC/POS chọn được. */
export const DriverRenderModeSection: React.FC<DriverRenderModeSectionProps> = ({ driver, disabled, onSelectRenderMode }) => {
  if (driver.type !== PrinterDriverType.EscPos) {
    return null;
  }

  return (
    <View style={styles.renderModeBlock}>
      <AppSelect
        label="Chế độ in ESC/POS"
        value={driver.config.renderMode}
        onSelect={(value) => onSelectRenderMode(value as RenderMode)}
        options={escPosRenderModeOptions}
        disabled={disabled}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  renderModeBlock: { gap: 8 },
});
