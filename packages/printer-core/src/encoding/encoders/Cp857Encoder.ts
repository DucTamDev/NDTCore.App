import type { CodePage } from '../CodePage';
import { CP437 } from './Cp437Encoder';

const SHARP_S_BYTE = 0xe1; // ß — CP437's byte at this position is dropped from CP857 (no ß in Turkish).

function withoutSharpS(chars: Record<number, string>): Record<number, string> {
  const result: Record<number, string> = {};
  for (const key of Object.keys(chars)) {
    const byte = Number(key);
    if (byte !== SHARP_S_BYTE) result[byte] = chars[byte];
  }
  return result;
}

/** CP857 — Turkish (CP437 minus ß, plus Turkish letters). Ported from portakal/src/encoding.ts CP857_CHARS. */
export const CP857: CodePage = {
  id: 857,
  name: 'CP857',
  chars: {
    ...withoutSharpS(CP437.chars),
    0x8d: 'ı', // dotless i (overrides CP437's ì)
    0x98: 'İ', // dotted I (overrides CP437's ÿ)
    0x9e: 'Ş',
    0x9f: 'ş',
    0xa0: 'Ğ',
    0xa1: 'ğ',
  },
};
