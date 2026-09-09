import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { AppSelect } from '../../../components/AppSelect';
import { AppInput } from '../../../components/AppInput';
import { PrinterDriverType } from '../models/printer/PrinterDriver';
import { PrintPaperType, type PaperSize, type PrintPaperConfig } from '../models/paper/PrintPaperConfig';
import { dieCutMediaError } from '../paper/validation';

const PAPER_SIZE_OPTIONS = [58, 80, 100, 104].map((n) => ({ label: `${n}mm`, value: String(n) }));
const MEDIA_TYPE_OPTIONS = [
  { label: 'Giấy cuộn liên tục', value: PrintPaperType.continuous },
  { label: 'Die-cut (tem rời, nhiều cột)', value: PrintPaperType.dieCut },
];

export interface DriverMediaSectionProps {
  driverType: PrinterDriverType;
  media: PrintPaperConfig;
  disabled: boolean;
  onChange: (patch: Partial<PrintPaperConfig>) => void;
}

const parseNum = (t: string): number | undefined => (t.trim() === '' ? undefined : Number(t));
const numStr = (n: number | undefined): string => (n == null ? '' : String(n));

export const DriverMediaSection: React.FC<DriverMediaSectionProps> = ({ driverType, media, disabled, onChange }) => {
  const isTspl = driverType === PrinterDriverType.tspl;
  const isDieCut = media.type === PrintPaperType.dieCut;
  const mediaError = dieCutMediaError(media);
  return (
    <View style={styles.block}>
      <AppSelect
        label="Khổ giấy"
        value={String(media.paperSize)}
        onSelect={(v) => onChange({ paperSize: Number(v) as PaperSize })}
        options={PAPER_SIZE_OPTIONS}
        disabled={disabled}
      />
      {isTspl ? (
        <>
          <AppSelect
            label="Loại giấy"
            value={media.type}
            onSelect={(v) => onChange({ type: v as PrintPaperConfig['type'] })}
            options={MEDIA_TYPE_OPTIONS}
            disabled={disabled}
          />
          {isDieCut ? (
            <>
              <AppInput label="Rộng tem (mm)" keyboardType="numeric" value={numStr(media.itemWidthMm)} onChangeText={(t) => onChange({ itemWidthMm: parseNum(t) })} disabled={disabled} />
              <AppInput label="Cao tem (mm)" keyboardType="numeric" value={numStr(media.itemHeightMm)} onChangeText={(t) => onChange({ itemHeightMm: parseNum(t) })} disabled={disabled} />
              <AppInput label="Số cột" keyboardType="numeric" value={numStr(media.columns)} onChangeText={(t) => onChange({ columns: parseNum(t) })} disabled={disabled} />
              <AppInput label="Khoảng cách ngang (mm)" keyboardType="numeric" value={numStr(media.horizontalGapMm)} onChangeText={(t) => onChange({ horizontalGapMm: parseNum(t) })} disabled={disabled} />
              <AppInput label="Khoảng cách dọc (mm)" keyboardType="numeric" value={numStr(media.verticalGapMm)} onChangeText={(t) => onChange({ verticalGapMm: parseNum(t) })} disabled={disabled} />
              {mediaError ? <Text style={styles.error}>{mediaError}</Text> : null}
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  block: { gap: 8 },
  error: { color: '#B91C1C' },
});
