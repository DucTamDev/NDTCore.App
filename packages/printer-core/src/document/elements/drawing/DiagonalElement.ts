import type { LineOptions } from './LineElement';

/**
 * Một đường chéo — dùng lại nguyên `LineOptions`, vì đường chéo chỉ là 1
 * đường thẳng có 2 điểm đầu/cuối khác nhau trên cả 2 trục, không phải shape
 * tham số riêng. `PrintBuilder.line()` chọn variant này thay vì `LineElement`
 * qua `isDiagonal()` bên dưới.
 */
export interface DiagonalElement {
  type: 'diagonal';
  options: LineOptions;
}

/** True khi 2 điểm đầu/cuối của đường thẳng khác nhau trên cả 2 trục, tức không theo trục (axis-aligned). */
export function isDiagonal(line: LineOptions & { x1: number; y1: number; x2: number; y2: number }): boolean {
  return line.x1 !== line.x2 && line.y1 !== line.y2;
}
