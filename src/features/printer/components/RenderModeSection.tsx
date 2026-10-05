import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppSelect } from '../../../components/AppSelect';
import { RenderMode, PrintLanguage } from '../models/printer/PrinterLanguage';
import type { PrinterLanguage } from '../models/printer/PrinterLanguage';

const escPosRenderModeLabel: Record<RenderMode, string> = {
  Command: 'Văn bản (nhanh, cần đúng codepage)',
  Raster: 'Ảnh (chậm hơn, đúng mọi máy)',
};

const tsplRenderModeLabel: Record<RenderMode, string> = {
  Command: 'Văn bản (font mặc định máy in — có thể không hiện dấu tiếng Việt trên một số máy)',
  Raster: 'Ảnh (chậm hơn, đúng mọi máy kể cả tiếng Việt)',
};

const renderModeLabelFor = (languageType: PrintLanguage): Record<RenderMode, string> =>
  languageType === PrintLanguage.EscPos ? escPosRenderModeLabel : tsplRenderModeLabel;

const renderModeOptionsFor = (languageType: PrintLanguage) => {
  const labels = renderModeLabelFor(languageType);
  return [RenderMode.Command, RenderMode.Raster].map((mode) => ({ label: labels[mode], value: mode }));
};

interface RenderModeSectionProps {
  language: PrinterLanguage;
  disabled: boolean;
  onSelectRenderMode: (mode: RenderMode) => void;
}

/** Cả ESC/POS và TSPL đều chọn được cách render. */
export const RenderModeSection: React.FC<RenderModeSectionProps> = ({ language, disabled, onSelectRenderMode }) => (
  <View style={styles.renderModeBlock}>
    <AppSelect
      label="Chế độ in"
      value={language.renderMode}
      onSelect={(value) => onSelectRenderMode(value as RenderMode)}
      options={renderModeOptionsFor(language.type)}
      disabled={disabled}
    />
  </View>
);

const styles = StyleSheet.create({
  renderModeBlock: { gap: 8 },
});
