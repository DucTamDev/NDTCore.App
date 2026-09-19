import type { TextStyle } from '../template/style/TextStyle';
import type { TextMeasurement } from './TextMeasurement';

export interface FontMetrics {
  measure(text: string, style: TextStyle): TextMeasurement;
  wrap(text: string, maxWidthDots: number, style: TextStyle): readonly string[];
}
