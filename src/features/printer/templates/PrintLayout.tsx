import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { usePrintRenderContext } from '@ndtcore/printer';
import type { PrintPadding } from '../models/templates/PrintPadding';

/** Khoảng cách dòng theo cỡ chữ; thấp hơn thì dấu tiếng Việt của hai dòng liền nhau dễ chạm nhau. */
const LINE_HEIGHT_RATIO = 1.3;

const DIVIDER_THICKNESS_DOTS = 2;

const DASH_LENGTH_DOTS = 6;

const DASH_GAP_DOTS = 4;

/** Khoảng giữa nhãn và giá trị trên một dòng. */
const ROW_GAP_DOTS = 8;

/** Đủ phủ khổ rộng nhất (832 dot); phần thừa bị cắt bởi `overflow: hidden`. */
const DASH_COUNT = 90;

const DASH_KEYS = Array.from({ length: DASH_COUNT }, (_, index) => index);

const INK = '#000000';

/** Đổi dot chuẩn (1/8 mm) sang dp của lần dựng. */
type ToDp = (dots: number) => number;

/** Cỡ chữ và dòng đo bằng dot chuẩn, đổi qua toDp để in cùng kích thước ở mọi độ phân giải. */
const textStyleOf = (size: number, bold: boolean, toDp: ToDp): TextStyle => ({
  fontSize: toDp(size),
  lineHeight: toDp(Math.round(size * LINE_HEIGHT_RATIO)),
  fontWeight: bold ? '700' : '400',
});

/** Dòng phụ thụt vào khoảng một ký tự. */
const indentStyleOf = (size: number, toDp: ToDp): TextStyle => ({ paddingLeft: toDp(size) });

/** Lề quanh mẫu, đo bằng dot chuẩn. */
export const usePaddingStyle = (padding: PrintPadding): ViewStyle => {
  const { toDp } = usePrintRenderContext();

  return {
    paddingTop: toDp(padding.top),
    paddingRight: toDp(padding.right),
    paddingBottom: toDp(padding.bottom),
    paddingLeft: toDp(padding.left),
  };
};

/** Thuộc tính một dòng chữ trên bản in. */
interface PrintTextProps {
  /** Cỡ chữ (dot chuẩn). */
  size: number;

  /** Chữ đậm. */
  bold?: boolean;

  /** Căn giữa. */
  center?: boolean;

  /** Thụt vào như dòng phụ của món. */
  indent?: boolean;

  /** Style thêm, không chứa kích thước. */
  style?: StyleProp<TextStyle>;

  /** Nội dung. */
  children: React.ReactNode;
}

/** Một dòng chữ trên bản in; dài thì tự xuống dòng. */
export const PrintText: React.FC<PrintTextProps> = (props) => {
  const { size, bold = false, center = false, indent = false, style, children } = props;
  const { toDp } = usePrintRenderContext();
  const textStyle = [
    styles.text,
    textStyleOf(size, bold, toDp),
    center && styles.center,
    indent && indentStyleOf(size, toDp),
    style,
  ];

  return <Text style={textStyle}>{children}</Text>;
};

/** Thuộc tính một dòng "nhãn ... giá trị". */
interface PrintRowProps {
  /** Nhãn bên trái. */
  label: string;

  /** Bỏ trống thì chỉ có nhãn. */
  value?: string;

  /** Cỡ chữ (dot chuẩn). */
  size: number;

  /** Chữ đậm. */
  bold?: boolean;

  /** Thụt vào như dòng phụ của món. */
  indent?: boolean;
}

/** Nhãn bên trái, giá trị bên phải; nhãn dài xuống dòng, giá trị luôn giữ nguyên một dòng. */
export const PrintRow: React.FC<PrintRowProps> = ({ label, value, size, bold = false, indent = false }) => {
  const { toDp } = usePrintRenderContext();
  const textStyle = textStyleOf(size, bold, toDp);

  return (
    <View style={[styles.row, { gap: toDp(ROW_GAP_DOTS) }, indent && indentStyleOf(size, toDp)]}>
      <Text style={[styles.text, textStyle, styles.rowLabel]}>{label}</Text>
      {value ? <Text style={[styles.text, textStyle, styles.rowValue]}>{value}</Text> : null}
    </View>
  );
};

/**
 * Nét đứt vẽ bằng các đoạn ngắn: Android không vẽ `borderStyle: 'dashed'` khi chỉ có một cạnh viền.
 */
export const PrintDivider: React.FC<{ dashed?: boolean }> = ({ dashed = false }) => {
  const { toDp } = usePrintRenderContext();
  const height = toDp(DIVIDER_THICKNESS_DOTS);

  if (!dashed) {
    return <View style={[styles.solidDivider, { height }]} />;
  }

  return (
    <View style={[styles.dashedDivider, { gap: toDp(DASH_GAP_DOTS), height }]}>
      {DASH_KEYS.map((key) => (
        <View key={key} style={[styles.dash, { width: toDp(DASH_LENGTH_DOTS), height }]} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  text: { fontFamily: 'monospace', color: INK },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { flexShrink: 1 },
  rowValue: { flexShrink: 0, textAlign: 'right' },
  solidDivider: { backgroundColor: INK },
  dashedDivider: { flexDirection: 'row', overflow: 'hidden' },
  dash: { flexShrink: 0, backgroundColor: INK },
});
