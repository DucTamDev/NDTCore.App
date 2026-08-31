import { TsplEncoder, columnPitchDots, columnOffsets, resolveSizeHeightMm } from '../TsplEncoder';
import { PrintType } from '../../../models/printing/PrintType';
import { PrintMediaType, CutterMode } from '../../../models/media/PrintMedia';
import type { PrintMedia } from '../../../models/media/PrintMedia';
import type { MonochromeBitmap } from '../../../utils/monochromeBitmap';

const CONT = (paperSize: PrintMedia['paperSize'] = 58): PrintMedia => ({ type: PrintMediaType.continuous, paperSize });
const DIE = (): PrintMedia => ({
  type: PrintMediaType.dieCut,
  paperSize: 100,
  itemWidthMm: 30,
  itemHeightMm: 20,
  columns: 3,
  horizontalGapMm: 2,
  verticalGapMm: 3,
});

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
    const output = decode(new TsplEncoder().initialize(CONT(58)).encode());
    expect(output).toContain('SIZE 50 mm, 200 mm');
    expect(output).toContain('GAP 0 mm, 0 mm');
    expect(output).toContain('CODEPAGE UTF-8');
    expect(output).toContain('CLS');
  });

  it('initialize(continuous, Label) does NOT gap-sense — GAP 0,0, DEFAULT_LABEL_HEIGHT_MM, sized for 58mm paper', () => {
    const output = decode(new TsplEncoder().initialize(CONT(58), PrintType.Label).encode());
    expect(output).toContain('SIZE 50 mm, 30 mm');
    expect(output).toContain('GAP 0 mm, 0 mm');
  });

  it('initialize(die_cut) emits row-wide SIZE + gap-sensing GAP verticalGapMm', () => {
    const output = decode(new TsplEncoder().initialize(DIE()).encode());
    expect(output).toContain('SIZE 94 mm, 20 mm'); // 3*30 + 2*2
    expect(output).toContain('GAP 3 mm, 0 mm');
  });

  it('initialize(continuous 100) emits SIZE 96 mm for the 100mm paper size', () => {
    const output = decode(new TsplEncoder().initialize(CONT(100)).encode());
    expect(output).toContain('SIZE 96 mm, 200 mm');
  });

  it('initialize(continuous 104) emits SIZE 104 mm for the 104mm paper size', () => {
    const output = decode(new TsplEncoder().initialize(CONT(104)).encode());
    expect(output).toContain('SIZE 104 mm, 200 mm');
  });

  it('columnPitchDots = (itemWidthMm + horizontalGapMm) * 8', () => {
    expect(columnPitchDots(DIE())).toBe(256); // (30+2)*8
  });

  it('columnOffsets: die_cut → [0, pitch, 2*pitch]; continuous → [0]', () => {
    expect(columnOffsets(DIE())).toEqual([0, 256, 512]);
    expect(columnOffsets(CONT())).toEqual([0]);
  });

  it('resolveSizeHeightMm: die_cut → itemHeightMm; continuous Receipt → CONTINUOUS_HEIGHT_MM; continuous Label → itemHeightMm ?? DEFAULT', () => {
    expect(resolveSizeHeightMm(DIE(), PrintType.Label)).toBe(20);
    expect(resolveSizeHeightMm(CONT(), PrintType.Receipt)).toBe(200);
    expect(resolveSizeHeightMm(CONT(), PrintType.Label)).toBe(30);
  });

  it('cut(3, per_job) → SET CUTTER 3 then PRINT 3,1', () => {
    const output = decode(new TsplEncoder().cut(3, CutterMode.perJob).encode());
    expect(output).toContain('SET CUTTER 3');
    expect(output.trim().endsWith('PRINT 3,1')).toBe(true);
  });

  it('cut(2, per_row) → SET CUTTER 1 then PRINT 2,1', () => {
    const output = decode(new TsplEncoder().cut(2, CutterMode.perRow).encode());
    expect(output).toContain('SET CUTTER 1');
    expect(output).toContain('PRINT 2,1');
  });

  it('cut(1, none) → SET CUTTER OFF then PRINT 1,1 last (persistent setting must be turned off, not just left unset)', () => {
    const output = decode(new TsplEncoder().cut(1, CutterMode.none).encode());
    expect(output).toContain('SET CUTTER OFF');
    expect(output.trim().endsWith('PRINT 1,1')).toBe(true);
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

  it('cut() emits PRINT rows,1 and chains fluently with the other builders', () => {
    const output = decode(
      new TsplEncoder().initialize(CONT(58)).text(0, 0, 'A').cut(1, CutterMode.perJob).encode(),
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

  describe('codepage', () => {
    it('initialize() emits CODEPAGE UTF-8 by default', () => {
      expect(decode(new TsplEncoder().initialize(CONT(58)).encode())).toContain('CODEPAGE UTF-8');
    });

    it('initialize(..., "1258") emits CODEPAGE 1258', () => {
      const ascii = Array.from(new TsplEncoder().initialize(CONT(58), PrintType.Receipt, '1258').encode())
        .map((b) => String.fromCharCode(b)).join('');
      expect(ascii).toContain('CODEPAGE 1258');
    });

    it('text() encodes content as CP1258 bytes (base + combining tone) under codepage 1258', () => {
      const bytes = Array.from(new TsplEncoder().initialize(CONT(58), PrintType.Receipt, '1258').text(0, 0, 'Trà sữa').encode());
      // command prefix is ASCII, content "Trà sữa" -> T r à(0xE0) ' ' s ữ(0xFD 0xDE) a
      expect(bytes.join(',')).toContain([0x54, 0x72, 0xe0, 0x20, 0x73, 0xfd, 0xde, 0x61].join(','));
    });

    it('text() under codepage 1252 truncates to the low byte (no multi-byte UTF-8 for accented chars)', () => {
      const bytes = Array.from(new TsplEncoder().initialize(CONT(58), PrintType.Receipt, '1252').text(0, 0, 'é').encode());
      // 'é' = U+00E9 -> single byte 0xE9, never [0xC3, 0xA9] (UTF-8)
      expect(bytes).toContain(0xe9);
      expect(bytes.join(',')).not.toContain('195,169');
    });

    it('text() keeps UTF-8 multi-byte encoding when codepage is UTF-8 (unchanged behavior)', () => {
      const output = decode(new TsplEncoder().initialize(CONT(58)).text(0, 0, 'é').encode());
      expect(output).toContain('"é"');
    });
  });
});
