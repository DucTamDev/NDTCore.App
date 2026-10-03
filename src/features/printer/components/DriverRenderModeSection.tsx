import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppSelect } from '../../../components/AppSelect';
import { RenderMode, RasterSource, PrintLanguage } from '../models/printer/PrinterLanguage';
import type { PrinterLanguage } from '../models/printer/PrinterLanguage';

const escPosRenderModeLabel: Record<RenderMode, string> = {
  Command: 'Văn bản (nhanh, cần đúng codepage)',
  Raster: 'Ảnh (chậm hơn, đúng mọi máy)',
};

const tsplRenderModeLabel: Record<RenderMode, string> = {
  Command: 'Văn bản (font mặc định máy in — có thể không hiện dấu tiếng Việt trên một số máy)',
  Raster: 'Ảnh (chậm hơn, đúng mọi máy kể cả tiếng Việt)',
};

const renderModeLabelFor = (driverType: PrintLanguage): Record<RenderMode, string> =>
  driverType === PrintLanguage.EscPos ? escPosRenderModeLabel : tsplRenderModeLabel;

const renderModeOptionsFor = (driverType: PrintLanguage) => {
  const labels = renderModeLabelFor(driverType);
  return [RenderMode.Command, RenderMode.Raster].map((mode) => ({ label: labels[mode], value: mode }));
};

const rasterSourceLabel: Record<RasterSource, string> = {
  Image: 'Chụp giao diện',
  Ast: 'Vẽ trực tiếp',
};

const rasterSourceOptions = [RasterSource.Image, RasterSource.Ast].map((source) => ({
  label: rasterSourceLabel[source],
  value: source,
}));

interface DriverRenderModeSectionProps {
  language: PrinterLanguage;
  disabled: boolean;
  onSelectRenderMode: (mode: RenderMode) => void;
  onSelectRasterSource: (source: RasterSource) => void;
}

/** Cả ESC/POS và TSPL đều chọn được cách render; ô chọn nguồn ảnh chỉ hiện khi in ảnh. */
export const DriverRenderModeSection: React.FC<DriverRenderModeSectionProps> = ({ language, disabled, onSelectRenderMode, onSelectRasterSource }) => (
  <View style={styles.renderModeBlock}>
    <AppSelect
      label="Chế độ in"
      value={language.renderMode}
      onSelect={(value) => onSelectRenderMode(value as RenderMode)}
      options={renderModeOptionsFor(language.type)}
      disabled={disabled}
    />
    {language.renderMode === RenderMode.Raster ? (
      <AppSelect
        label="Nguồn ảnh"
        value={language.rasterSource}
        onSelect={(value) => onSelectRasterSource(value as RasterSource)}
        options={rasterSourceOptions}
        disabled={disabled}
      />
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  renderModeBlock: { gap: 8 },
});
