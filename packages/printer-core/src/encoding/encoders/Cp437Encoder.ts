import type { CodePage } from '../CodePage';

/** CP437 — US/Standard Europe, default code page on most ESC/POS printers. Ported from portakal/src/encoding.ts CP437_CHARS. */
export const CP437: CodePage = {
  id: 437,
  name: 'CP437',
  chars: {
    0x80: 'Ç', // Ç
    0x81: 'ü', // ü
    0x82: 'é', // é
    0x83: 'â', // â
    0x84: 'ä', // ä
    0x85: 'à', // à
    0x86: 'å', // å
    0x87: 'ç', // ç
    0x88: 'ê', // ê
    0x89: 'ë', // ë
    0x8a: 'è', // è
    0x8b: 'ï', // ï
    0x8c: 'î', // î
    0x8d: 'ì', // ì
    0x8e: 'Ä', // Ä
    0x8f: 'Å', // Å
    0x90: 'É', // É
    0x91: 'æ', // æ
    0x92: 'Æ', // Æ
    0x93: 'ô', // ô
    0x94: 'ö', // ö
    0x95: 'ò', // ò
    0x96: 'û', // û
    0x97: 'ù', // ù
    0x98: 'ÿ', // ÿ
    0x99: 'Ö', // Ö
    0x9a: 'Ü', // Ü
    0x9b: '¢', // ¢
    0x9c: '£', // £
    0x9d: '¥', // ¥
    0xe1: 'ß', // ß
    0xe6: 'µ', // µ
    0xa4: 'ñ', // ñ
    0xa5: 'Ñ', // Ñ
  },
};
