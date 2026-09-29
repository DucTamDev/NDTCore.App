import type { FontMetrics } from './FontMetrics';
import type { TextMeasurement } from './TextMeasurement';
import type { LayoutTextStyle } from './LayoutNode';

const DEFAULT_FONT_SIZE_DOTS = 10;
/** Hệ số leading mặc định khi `style.lineHeight` bỏ trống — chiều cao dòng = fontSize × hệ số này. */
const DEFAULT_LINE_HEIGHT_RATIO = 1.2;
/** Độ rộng ước lượng 1 ký tự, tính bằng dots, tại fontSize mốc chuẩn 10 dots. */
const DOTS_PER_CHAR_AT_DEFAULT_FONT_SIZE = 6;

function resolveFontSize(style: LayoutTextStyle): number {
  return style.fontSize ?? DEFAULT_FONT_SIZE_DOTS;
}

function resolveLineHeight(style: LayoutTextStyle, fontSize: number): number {
  return style.lineHeight ?? fontSize * DEFAULT_LINE_HEIGHT_RATIO;
}

function dotsPerChar(fontSize: number): number {
  return DOTS_PER_CHAR_AT_DEFAULT_FONT_SIZE * (fontSize / DEFAULT_FONT_SIZE_DOTS);
}

/**
 * Ước lượng kích thước/wrap text mà không cần load font thật — dùng cho auto-layout (wrap theo maxWidth).
 * `fontSize`/`lineHeight` đều tính bằng dots: `fontSize` là chiều cao glyph danh nghĩa, `lineHeight` là
 * chiều cao cả dòng (glyph + khoảng cách dòng) — cùng quy ước fontSize/line-height của CSS.
 */
export class ApproximateFontMetrics implements FontMetrics {
  measure(text: string, style: LayoutTextStyle): TextMeasurement {
    const fontSize = resolveFontSize(style);
    const lineHeight = resolveLineHeight(style, fontSize);
    const lines = text.split('\n');
    const widthDots = Math.max(...lines.map((line) => line.length * dotsPerChar(fontSize)));

    return { widthDots, heightDots: lines.length * lineHeight, lineCount: lines.length };
  }

  wrap(text: string, maxWidthDots: number, style: LayoutTextStyle): readonly string[] {
    const fontSize = resolveFontSize(style);
    const maxChars = Math.max(1, Math.floor(maxWidthDots / dotsPerChar(fontSize)));

    const lines: string[] = [];
    let current = '';
    for (const word of text.split(' ')) {
      let remainingWord = word;
      while (remainingWord.length > maxChars) {
        if (current.length > 0) {
          lines.push(current);
          current = '';
        }
        lines.push(remainingWord.slice(0, maxChars));
        remainingWord = remainingWord.slice(maxChars);
      }

      const candidate = current.length === 0 ? remainingWord : `${current} ${remainingWord}`;
      if (candidate.length <= maxChars) {
        current = candidate;
      } else {
        if (current.length > 0) lines.push(current);
        current = remainingWord;
      }
    }
    if (current.length > 0) lines.push(current);

    return lines.length > 0 ? lines : [''];
  }
}
