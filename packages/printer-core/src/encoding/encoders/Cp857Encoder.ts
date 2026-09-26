import type { CodePage } from '../CodePage';
import { CP437 } from './Cp437Encoder';

const SHARP_S_BYTE = 0xe1; // ß — byte này của CP437 bị bỏ trong CP857 (tiếng Thổ Nhĩ Kỳ không có ß).

function withoutSharpS(chars: Record<number, string>): Record<number, string> {
  const result: Record<number, string> = {};
  for (const key of Object.keys(chars)) {
    const byte = Number(key);
    if (byte !== SHARP_S_BYTE) result[byte] = chars[byte];
  }
  return result;
}

/** CP857 — tiếng Thổ Nhĩ Kỳ (CP437 bỏ ß, thêm chữ Thổ Nhĩ Kỳ). */
export const CP857: CodePage = {
  id: 857,
  name: 'CP857',
  chars: {
    ...withoutSharpS(CP437.chars),
    0x8d: 'ı', // i không chấm (đè lên ì của CP437)
    0x98: 'İ', // I có chấm (đè lên ÿ của CP437)
    0x9e: 'Ş',
    0x9f: 'ş',
    0xa0: 'Ğ',
    0xa1: 'ğ',
  },
};
