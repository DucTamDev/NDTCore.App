import type { CodePage } from '../CodePage';

function buildRange(byteStart: number, count: number, unicodeStart: number): Record<number, string> {
  const chars: Record<number, string> = {};
  for (let i = 0; i < count; i++) {
    chars[byteStart + i] = String.fromCharCode(unicodeStart + i);
  }
  return chars;
}

/** CP866 — Cyrillic (Russian, Ukrainian, Belarusian). Ported from portakal/src/encoding.ts CP866_CHARS. */
export const CP866: CodePage = {
  id: 866,
  name: 'CP866',
  chars: {
    ...buildRange(0x80, 32, 0x0410), // А-Я
    ...buildRange(0xa0, 16, 0x0430), // а-п
    ...buildRange(0xe0, 16, 0x0440), // р-я
    0xf0: 'Ё',
    0xf1: 'ё',
    0xf2: 'Є', // Ukrainian
    0xf3: 'є',
    0xf4: 'Ї',
    0xf5: 'ї',
    0xf6: 'Ў', // Belarusian
    0xf7: 'ў',
  },
};
