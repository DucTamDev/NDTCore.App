import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import type { PrintPadding } from '../models/templates/PrintPadding';

/** Khoảng cách dòng theo cỡ chữ; thấp hơn thì dấu tiếng Việt của hai dòng liền nhau dễ chạm nhau. */
const LINE_HEIGHT_RATIO = 1.3;

const DIVIDER_THICKNESS_DOTS = 2;

const DASH_LENGTH_DOTS = 6;

const DASH_GAP_DOTS = 4;

/** Đủ phủ khổ rộng nhất (832 dot); phần thừa bị cắt bởi `overflow: hidden`. */
const DASH_COUNT = 90;

const DASH_KEYS = Array.from({ length: DASH_COUNT }, (_, index) => index);

const INK = '#000000';

/** Ảnh in theo dot thật (8 dot/mm) nên cỡ chữ cũng là dot. */
const textStyleOf = (size: number, bold: boolean): TextStyle => ({
  fontSize: size,
  lineHeight: Math.round(size * LINE_HEIGHT_RATIO),
  fontWeight: bold ? '700' : '400',
});

/** Dòng phụ thụt vào khoảng một ký tự. */
const indentStyleOf = (size: number): TextStyle => ({ paddingLeft: size });

export const paddingStyleOf = (padding: PrintPadding) => ({
  paddingTop: padding.top,
  paddingRight: padding.right,
  paddingBottom: padding.bottom,
  paddingLeft: padding.left,
});

/** Thuộc tính một dòng chữ trên bản in. */
interface PrintTextProps {
  /** Cỡ chữ (dot). */
  size: number;

  bold?: boolean;

  center?: boolean;

  /** Thụt vào như dòng phụ của món. */
  indent?: boolean;

  style?: StyleProp<TextStyle>;

  children: React.ReactNode;
}

/** Một dòng chữ trên bản in; dài thì tự xuống dòng. */
export const PrintText: React.FC<PrintTextProps> = (props) => {
  const { size, bold = false, center = false, indent = false, style, children } = props;
  const textStyle = [
    styles.text,
    textStyleOf(size, bold),
    center && styles.center,
    indent && indentStyleOf(size),
    style,
  ];

  return <Text style={textStyle}>{children}</Text>;
};

/** Thuộc tính một dòng "nhãn ... giá trị". */
interface PrintRowProps {
  label: string;

  /** Bỏ trống thì chỉ có nhãn. */
  value?: string;

  /** Cỡ chữ (dot). */
  size: number;

  bold?: boolean;

  indent?: boolean;
}

/** Nhãn bên trái, giá trị bên phải; nhãn dài xuống dòng, giá trị luôn giữ nguyên một dòng. */
export const PrintRow: React.FC<PrintRowProps> = ({ label, value, size, bold = false, indent = false }) => (
  <View style={[styles.row, indent && indentStyleOf(size)]}>
    <Text style={[styles.text, textStyleOf(size, bold), styles.rowLabel]}>{label}</Text>
    {value ? <Text style={[styles.text, textStyleOf(size, bold), styles.rowValue]}>{value}</Text> : null}
  </View>
);

/**
 * Nét đứt vẽ bằng các đoạn ngắn: Android không vẽ `borderStyle: 'dashed'` khi chỉ có một cạnh viền.
 */
export const PrintDivider: React.FC<{ dashed?: boolean }> = ({ dashed = false }) => {
  if (!dashed) {
    return <View style={styles.solidDivider} />;
  }

  return (
    <View style={styles.dashedDivider}>
      {DASH_KEYS.map((key) => (
        <View key={key} style={styles.dash} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  text: { fontFamily: 'monospace', color: INK },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rowLabel: { flexShrink: 1 },
  rowValue: { flexShrink: 0, textAlign: 'right' },
  solidDivider: { height: DIVIDER_THICKNESS_DOTS, backgroundColor: INK },
  dashedDivider: { flexDirection: 'row', gap: DASH_GAP_DOTS, height: DIVIDER_THICKNESS_DOTS, overflow: 'hidden' },
  dash: { width: DASH_LENGTH_DOTS, height: DIVIDER_THICKNESS_DOTS, flexShrink: 0, backgroundColor: INK },
});
