import { buildEscPosBitmapBytes } from '../EscPosBitmapEncoder';
import { CutterMode } from '../../../models/media/PrintMedia';
import type { MonochromeBitmap } from '../../../utils/monochromeBitmap';

describe('buildEscPosBitmapBytes', () => {
  it('phát đúng header ESC @ + GS v 0 (m=0) với width/height little-endian, theo sau bởi đúng data bits', () => {
    const bitmap: MonochromeBitmap = { widthBytes: 2, heightPx: 3, bits: new Uint8Array([0xff, 0x00, 0x0f, 0xf0, 0xaa, 0x55]) };
    const bytes = buildEscPosBitmapBytes(bitmap, CutterMode.perJob);

    expect(Array.from(bytes.slice(0, 10))).toEqual([
      0x1b, 0x40, // ESC @
      0x1d, 0x76, 0x30, 0x00, // GS v 0, m=0
      2, 0, // widthBytes little-endian
      3, 0, // heightPx little-endian
    ]);
    expect(Array.from(bytes.slice(10, 16))).toEqual(Array.from(bitmap.bits));
  });

  it('width/height > 255 encode đúng little-endian 2 byte (không tràn byte thấp)', () => {
    const widthBytes = 300; // 0x012C -> low 0x2C, high 0x01
    const heightPx = 500; // 0x01F4 -> low 0xF4, high 0x01
    const bitmap: MonochromeBitmap = { widthBytes, heightPx, bits: new Uint8Array(widthBytes * heightPx) };
    const bytes = buildEscPosBitmapBytes(bitmap, CutterMode.none);

    expect(bytes[6]).toBe(0x2c);
    expect(bytes[7]).toBe(0x01);
    expect(bytes[8]).toBe(0xf4);
    expect(bytes[9]).toBe(0x01);
  });

  it('cutterMode = none → không phát cut_bytes ([0x1b, 0x6d]) ở cuối', () => {
    const bitmap: MonochromeBitmap = { widthBytes: 1, heightPx: 1, bits: new Uint8Array([0xff]) };
    const bytes = buildEscPosBitmapBytes(bitmap, CutterMode.none);

    // header (6) + width/height (4) + 1 byte data = 11 byte, không có gì thêm sau đó.
    expect(bytes.length).toBe(11);
    expect(Array.from(bytes.slice(-1))).toEqual([0xff]);
  });

  it('cutterMode = perJob → phát cut_bytes ([0x1b, 0x6d]) ngay sau data', () => {
    const bitmap: MonochromeBitmap = { widthBytes: 1, heightPx: 1, bits: new Uint8Array([0xff]) };
    const bytes = buildEscPosBitmapBytes(bitmap, CutterMode.perJob);

    expect(bytes.length).toBe(13);
    expect(Array.from(bytes.slice(-2))).toEqual([0x1b, 0x6d]);
  });

  it('cutterMode = perRow → cũng phát cut_bytes (chỉ "none" mới bỏ qua)', () => {
    const bitmap: MonochromeBitmap = { widthBytes: 1, heightPx: 1, bits: new Uint8Array([0x00]) };
    const bytes = buildEscPosBitmapBytes(bitmap, CutterMode.perRow);

    expect(Array.from(bytes.slice(-2))).toEqual([0x1b, 0x6d]);
  });

  it('data KHÔNG bị đảo bit — khớp nguyên vẹn MonochromeBitmap.bits (khác quirk đảo bit riêng của lệnh BITMAP TSPL)', () => {
    const bits = new Uint8Array([0b10110100, 0b00000000, 0b11111111]);
    const bitmap: MonochromeBitmap = { widthBytes: 3, heightPx: 1, bits };
    const bytes = buildEscPosBitmapBytes(bitmap, CutterMode.none);

    expect(Array.from(bytes.slice(10, 13))).toEqual(Array.from(bits));
  });
});
