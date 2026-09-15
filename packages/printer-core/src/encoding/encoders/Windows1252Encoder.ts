import type { CodePage } from '../CodePage';

/** Latin supplement 0xA0-0xFF is 1:1 with Unicode U+00A0-U+00FF, as in Windows-1252. */
function buildLatinSupplement(): Record<number, string> {
  const chars: Record<number, string> = {};
  for (let i = 0; i < 96; i++) {
    chars[0xa0 + i] = String.fromCharCode(0x00a0 + i);
  }
  return chars;
}

/** Windows-1252 — Western European (Latin 1). Ported from portakal/src/encoding.ts CP1252_CHARS. */
export const Windows1252: CodePage = {
  id: 1252,
  name: 'Windows1252',
  chars: {
    0x80: '€',
    0x82: '‚',
    0x83: 'ƒ',
    0x84: '„',
    0x85: '…',
    0x86: '†',
    0x87: '‡',
    0x88: 'ˆ',
    0x89: '‰',
    0x8a: 'Š',
    0x8b: '‹',
    0x8c: 'Œ',
    0x8e: 'Ž',
    0x91: '‘',
    0x92: '’',
    0x93: '“',
    0x94: '”',
    0x95: '•',
    0x96: '–',
    0x97: '—',
    0x98: '˜',
    0x99: '™',
    0x9a: 'š',
    0x9b: '›',
    0x9c: 'œ',
    0x9e: 'ž',
    0x9f: 'Ÿ',
    ...buildLatinSupplement(),
  },
};
