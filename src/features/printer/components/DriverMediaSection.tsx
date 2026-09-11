import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { AppSelect } from '../../../components/AppSelect';
import { AppInput } from '../../../components/AppInput';
import { PrinterDriverType } from '../models/printer/PrinterDriver';
import { PaperSize, PrintPaperType } from '../models/paper/PrintPaperConfig';
import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';
import { dieCutMediaError } from '../paper/validation';

const PAPER_SIZE_OPTIONS = [PaperSize.Mm58, PaperSize.Mm80, PaperSize.Mm100, PaperSize.Mm104].map((n) => ({ label: `${n}mm`, value: String(n) }));
const MEDIA_TYPE_OPTIONS = [
  { label: 'Giấy cuộn liên tục', value: PrintPaperType.Continuous },
  { label: 'Die-cut (tem rời, nhiều cột)', value: PrintPaperType.DieCut },
];

export interface DriverMediaSectionProps {
  /** `undefined` trước khi driver được xác nhận — TSPL-only field (loại giấy/die-cut) chỉ hiện khi đã biết driver là TSPL. */
  driverType?: PrinterDriverType;
  paper: PrintPaperConfig;
  disabled: boolean;
  onChange: (patch: Partial<PrintPaperConfig>) => void;
}

const parseNum = (t: string): number | undefined => (t.trim() === '' ? undefined : Number(t));
const numStr = (n: number | undefined): string => (n == null ? '' : String(n));

export const DriverMediaSection: React.FC<DriverMediaSectionProps> = ({ driverType, paper, disabled, onChange }) => {
  const isTspl = driverType === PrinterDriverType.Tspl;
  const isDieCut = paper.type === PrintPaperType.DieCut;
  const mediaError = dieCutMediaError(paper);
  return (
    <View style={styles.block}>
      <AppSelect
        label="Khổ giấy"
        value={String(paper.paperSize)}
        onSelect={(v) => onChange({ paperSize: Number(v) as PaperSize })}
        options={PAPER_SIZE_OPTIONS}
        disabled={disabled}
      />
      {isTspl ? (
        <>
          <AppSelect
            label="Loại giấy"
            value={paper.type}
            onSelect={(v) => onChange({ type: v as PrintPaperConfig['type'] })}
            options={MEDIA_TYPE_OPTIONS}
            disabled={disabled}
          />
          {isDieCut ? (
            <>
              <AppInput label="Rộng tem (mm)" keyboardType="numeric" value={numStr(paper.itemWidthMm)} onChangeText={(t) => onChange({ itemWidthMm: parseNum(t) })} disabled={disabled} />
              <AppInput label="Cao tem (mm)" keyboardType="numeric" value={numStr(paper.itemHeightMm)} onChangeText={(t) => onChange({ itemHeightMm: parseNum(t) })} disabled={disabled} />
              <AppInput label="Số cột" keyboardType="numeric" value={numStr(paper.columns)} onChangeText={(t) => onChange({ columns: parseNum(t) })} disabled={disabled} />
              <AppInput label="Khoảng cách ngang (mm)" keyboardType="numeric" value={numStr(paper.horizontalGapMm)} onChangeText={(t) => onChange({ horizontalGapMm: parseNum(t) })} disabled={disabled} />
              <AppInput label="Khoảng cách dọc (mm)" keyboardType="numeric" value={numStr(paper.verticalGapMm)} onChangeText={(t) => onChange({ verticalGapMm: parseNum(t) })} disabled={disabled} />
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
