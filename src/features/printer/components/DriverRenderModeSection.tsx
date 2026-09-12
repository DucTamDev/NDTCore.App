import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppSelect } from '../../../components/AppSelect';
import { RenderMode, BitmapSource, PrinterDriverType } from '../models/printer/PrinterDriver';
import type { PrinterDriver } from '../models/printer/PrinterDriver';

const escPosRenderModeLabel: Record<RenderMode, string> = {
  Encoder: 'Văn bản (nhanh, cần đúng codepage)',
  Bitmap: 'Bitmap (chậm hơn, đúng mọi máy)',
};

const tsplRenderModeLabel: Record<RenderMode, string> = {
  Encoder: 'Text (font mặc định máy in — có thể không hiện dấu tiếng Việt trên một số máy)',
  Bitmap: 'Bitmap (chậm hơn, đúng mọi máy kể cả tiếng Việt)',
};

const renderModeLabelFor = (driverType: PrinterDriverType): Record<RenderMode, string> =>
  driverType === PrinterDriverType.EscPos ? escPosRenderModeLabel : tsplRenderModeLabel;

const renderModeOptionsFor = (driverType: PrinterDriverType) => {
  const labels = renderModeLabelFor(driverType);
  return [RenderMode.Encoder, RenderMode.Bitmap].map((mode) => ({ label: labels[mode], value: mode }));
};

const bitmapSourceLabel: Record<BitmapSource, string> = {
  Image: 'Chụp giao diện',
  Ast: 'Vẽ trực tiếp',
};

const bitmapSourceOptions = [BitmapSource.Image, BitmapSource.Ast].map((source) => ({ label: bitmapSourceLabel[source], value: source }));

interface DriverRenderModeSectionProps {
  driver: PrinterDriver;
  disabled: boolean;
  onSelectRenderMode: (mode: RenderMode) => void;
  onSelectBitmapSource: (source: BitmapSource) => void;
}

/** Cả ESC/POS và TSPL đều chọn được renderMode. Selector "Nguồn ảnh bitmap" chỉ hiện khi renderMode === Bitmap. */
export const DriverRenderModeSection: React.FC<DriverRenderModeSectionProps> = ({ driver, disabled, onSelectRenderMode, onSelectBitmapSource }) => (
  <View style={styles.renderModeBlock}>
    <AppSelect
      label="Chế độ in"
      value={driver.config.renderMode}
      onSelect={(value) => onSelectRenderMode(value as RenderMode)}
      options={renderModeOptionsFor(driver.type)}
      disabled={disabled}
    />
    {driver.config.renderMode === RenderMode.Bitmap ? (
      <AppSelect
        label="Nguồn ảnh bitmap"
        value={driver.config.bitmapSource ?? BitmapSource.Image}
        onSelect={(value) => onSelectBitmapSource(value as BitmapSource)}
        options={bitmapSourceOptions}
        disabled={disabled}
      />
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  renderModeBlock: { gap: 8 },
});
