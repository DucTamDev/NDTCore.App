import type { Length, LengthUnit, PaperSize } from '../template';

/** Số đơn vị trong 1 inch của từng đơn vị độ dài. */
const UNITS_PER_INCH: Readonly<Record<LengthUnit, number>> = { mm: 25.4, pt: 72, px: 96 };

/** Nét kẻ, module QR... tối thiểu 1 dot để không biến mất trên máy DPI thấp. */
const MIN_STROKE_DOTS = 1;

/** Khổ giấy đã đổi sang dots. */
export interface PaperDots {
  /** Chiều rộng vùng in, dots. */
  readonly widthDots: number;

  /** Chiều cao 1 tem, dots; chỉ có ở label. */
  readonly heightDots?: number;
}

/** Đổi độ dài sang dots theo DPI của máy in: `round(value × dpi ÷ số đơn vị trên 1 inch)`. */
export function lengthToDots(length: Length, dpi: number): number {
  return Math.round((length.value * dpi) / UNITS_PER_INCH[length.unit]);
}

/** Như `lengthToDots` nhưng tối thiểu 1 dot — dùng cho độ dày nét và cỡ module. */
export function strokeLengthToDots(length: Length, dpi: number): number {
  return Math.max(MIN_STROKE_DOTS, lengthToDots(length, dpi));
}

/** Đổi `Length` tuỳ chọn sang dots; `undefined` giữ nguyên. */
export function optionalLengthToDots(length: Length | undefined, dpi: number): number | undefined {
  return length === undefined ? undefined : lengthToDots(length, dpi);
}

/** Như `optionalLengthToDots` nhưng tối thiểu 1 dot — dùng cho độ dày nét và cỡ module tuỳ chọn. */
export function optionalStrokeLengthToDots(length: Length | undefined, dpi: number): number | undefined {
  return length === undefined ? undefined : strokeLengthToDots(length, dpi);
}

/** Đổi khổ giấy (mm) sang dots. */
export function paperSizeToDots(paper: PaperSize, dpi: number): PaperDots {
  const widthDots = lengthToDots({ value: paper.widthMm, unit: 'mm' }, dpi);
  if (paper.heightMm === undefined) return { widthDots };
  return { widthDots, heightDots: lengthToDots({ value: paper.heightMm, unit: 'mm' }, dpi) };
}
