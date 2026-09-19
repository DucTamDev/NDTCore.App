import type { FontMetrics } from './FontMetrics';
import type { TextMeasurement } from './TextMeasurement';
import type { TextStyle } from '../template/style/TextStyle';

const DOTS_PER_CHAR_AT_SIZE_1 = 6;
const DOTS_PER_LINE_HEIGHT_AT_SIZE_1 = 10;

export class ApproximateFontMetrics implements FontMetrics {
  measure(text: string, style: TextStyle): TextMeasurement {
    const fontSize = style.fontSize ?? 10;
    const lineHeight = style.lineHeight ?? fontSize * 1.2;
    const lines = text.split('\n');
    const widthDots = Math.max(...lines.map((line) => line.length * DOTS_PER_CHAR_AT_SIZE_1 * (fontSize / 10)));
    return { widthDots, heightDots: lines.length * lineHeight * (DOTS_PER_LINE_HEIGHT_AT_SIZE_1 / 10), lineCount: lines.length };
  }

  wrap(text: string, maxWidthDots: number, style: TextStyle): readonly string[] {
    const fontSize = style.fontSize ?? 10;
    const dotsPerChar = DOTS_PER_CHAR_AT_SIZE_1 * (fontSize / 10);
    const maxChars = Math.max(1, Math.floor(maxWidthDots / dotsPerChar));

    const lines: string[] = [];
    let current = '';
    for (const word of text.split(' ')) {
      let remainingWord = word;
      while (remainingWord.length > maxChars) {
        if (current.length > 0) { lines.push(current); current = ''; }
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
