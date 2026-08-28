import { TsplEncoder } from '../TsplEncoder';
import { PrintType } from '../../../types/printConfiguration.types';
import type { MonochromeBitmap } from '../../../utils/monochromeBitmap';

/** Decode UTF-8 bytes back to a JS string — project has no `@types/node`/DOM lib, so no `Buffer`/`TextDecoder` global to reach for here. */
const decode = (bytes: Uint8Array): string => {
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i];
    if (b0 < 0x80) {
      result += String.fromCodePoint(b0);
      i += 1;
      // eslint-disable-next-line no-bitwise -- test-only UTF-8 decoder, mirrors TsplEncoder's own bit-shifting
    } else if (b0 >> 5 === 0b110) {
      // eslint-disable-next-line no-bitwise -- test-only UTF-8 decoder, mirrors TsplEncoder's own bit-shifting
      result += String.fromCodePoint(((b0 & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
      // eslint-disable-next-line no-bitwise -- test-only UTF-8 decoder, mirrors TsplEncoder's own bit-shifting
    } else if (b0 >> 4 === 0b1110) {
      // eslint-disable-next-line no-bitwise -- test-only UTF-8 decoder, mirrors TsplEncoder's own bit-shifting
      result += String.fromCodePoint(((b0 & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f));
      i += 3;
    } else {
      result += String.fromCodePoint(
        // eslint-disable-next-line no-bitwise -- test-only UTF-8 decoder, mirrors TsplEncoder's own bit-shifting
        ((b0 & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f),
      );
      i += 4;
    }
  }
  return result;
};

describe('TsplEncoder', () => {

  it('initialize() defaults to continuous mode (Receipt) — GAP 0,0, no real gap to sense', () => {
    const output = decode(new TsplEncoder().initialize(58).encode());
    expect(output).toContain('SIZE 50 mm, 200 mm');
    expect(output).toContain('GAP 0 mm, 0 mm');
    expect(output).toContain('CODEPAGE UTF-8');
    expect(output).toContain('CLS');
  });

  it('initialize() emits gap-sensing SIZE/GAP for Label, sized for 58mm paper', () => {
    const output = decode(new TsplEncoder().initialize(58, PrintType.Label).encode());
    expect(output).toContain('SIZE 50 mm, 30 mm');
    expect(output).toContain('GAP 2 mm, 0 mm');
  });

  it('initialize() emits Label SIZE sized for 80mm paper, with a custom labelHeightMm', () => {
    const output = decode(new TsplEncoder().initialize(80, PrintType.Label, 40).encode());
    expect(output).toContain('SIZE 72 mm, 40 mm');
  });

  it('text() emits a TEXT command with escaped quotes', () => {
    const output = decode(new TsplEncoder().text(10, 20, 'Máy in "A"').encode());
    expect(output).toContain('TEXT 10,20,"3",0,1,1,"Máy in \\"A\\""');
  });

  it('text() encodes Vietnamese tone-marked characters (outside U+00FF) as real UTF-8, not truncated bytes', () => {
    const output = decode(new TsplEncoder().text(0, 0, 'Cà phê sữa đá, cơm gà xối mỡ').encode());
    expect(output).toContain('TEXT 0,0,"3",0,1,1,"Cà phê sữa đá, cơm gà xối mỡ"');
  });

  it('barcode() emits a BARCODE command', () => {
    const output = decode(new TsplEncoder().barcode(0, 0, '12345').encode());
    expect(output).toContain('BARCODE 0,0,"128",50,1,0,2,2,"12345"');
  });

  it('barcode() escapes embedded double quotes so they cannot break the TSPL command syntax', () => {
    const output = decode(new TsplEncoder().barcode(0, 0, 'A"B').encode());
    expect(output).toContain('BARCODE 0,0,"128",50,1,0,2,2,"A\\"B"');
  });

  it('qrcode() emits a QRCODE command', () => {
    const output = decode(new TsplEncoder().qrcode(0, 0, 'https://ndtcore.local').encode());
    expect(output).toContain('QRCODE 0,0,H,4,A,0,"https://ndtcore.local"');
  });

  it('qrcode() escapes embedded double quotes (e.g. a URL query string) so they cannot break the TSPL command syntax', () => {
    const output = decode(new TsplEncoder().qrcode(0, 0, 'https://ndtcore.local?q="x"').encode());
    expect(output).toContain('QRCODE 0,0,H,4,A,0,"https://ndtcore.local?q=\\"x\\""');
  });

  describe('image()', () => {
    const bitmap: MonochromeBitmap = { widthBytes: 2, heightPx: 3, bits: new Uint8Array([0xff, 0x00, 0x80, 0x7f, 0x01, 0xfe]) };

    it('emits the BITMAP header with widthBytes/heightPx/mode=0', () => {
      // Chỉ decode phần header ASCII — không dùng decode() (UTF-8) trên toàn
      // bộ payload vì byte nhị phân của bitmap (vd 0xff, 0x80) không phải
      // chuỗi UTF-8 hợp lệ, decode() sẽ tính ra code point ngoài dải Unicode
      // và throw RangeError.
      const bytes = new TsplEncoder().image(10, 20, bitmap).encode();
      const header = 'BITMAP 10,20,2,3,0,';
      const headerBytes = Array.from(bytes.slice(0, header.length)).map((b) => String.fromCharCode(b)).join('');
      expect(headerBytes).toBe(header);
    });

    it('appends the raw bitmap bytes bitwise-inverted — not re-encoded as UTF-8, which would corrupt bytes ≥ 0x80', () => {
      const bytes = new TsplEncoder().image(0, 0, bitmap).encode();
      // "BITMAP 0,0,2,3,0," is pure ASCII, so its byte length equals its char length.
      const bitmapStart = 'BITMAP 0,0,2,3,0,'.length;
      expect(Array.from(bytes.slice(bitmapStart, bitmapStart + bitmap.bits.length))).toEqual(
        // eslint-disable-next-line no-bitwise -- mirrors the inversion under test in TsplEncoder.image()
        Array.from(bitmap.bits).map((byte) => byte ^ 0xff),
      );
    });

    it('ends with a CRLF right after the raw bitmap bytes', () => {
      const bytes = new TsplEncoder().image(0, 0, bitmap).encode();
      const last2 = bytes.slice(bytes.length - 2);
      expect(Array.from(last2)).toEqual([0x0d, 0x0a]);
    });
  });

  it('cut() emits PRINT 1,1 and chains fluently with the other builders', () => {
    const output = decode(
      new TsplEncoder().initialize(58).text(0, 0, 'A').cut().encode(),
    );
    expect(output.trim().endsWith('PRINT 1,1')).toBe(true);
  });

  it('text() uses the given fontName instead of the built-in "3" when provided', () => {
    const encoder = new TsplEncoder();
    encoder.text(0, 0, 'Trà sữa', 'VIETFONT');
    const bytes = encoder.encode();
    const ascii = Array.from(bytes).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('"VIETFONT"');
  });

  it('text() still defaults to font "3" when no fontName is given (unchanged behavior)', () => {
    const encoder = new TsplEncoder();
    encoder.text(0, 0, 'Trà sữa');
    const bytes = encoder.encode();
    const ascii = Array.from(bytes).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('"3"');
  });
});
