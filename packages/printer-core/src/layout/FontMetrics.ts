import type { LayoutTextStyle } from './LayoutNode';
import type { TextMeasurement } from './TextMeasurement';

/** Đo và ngắt dòng chữ; mọi kích thước tính bằng dots. */
export interface FontMetrics {
  /** Kích thước của `text` (có thể nhiều dòng theo `\n`). */
  measure(text: string, style: LayoutTextStyle): TextMeasurement;

  /** Ngắt `text` thành các dòng vừa `maxWidthDots`. */
  wrap(text: string, maxWidthDots: number, style: LayoutTextStyle): readonly string[];
}
