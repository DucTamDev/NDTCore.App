import UPNG from 'upng-js';
import { Buffer } from 'buffer';
import { EscPosLanguage } from '../EscPosLanguage';
import { makeEscPosLanguage, makePrinter } from '../../../testing/printerFixtures';
import { CutterMode } from '../../../models/paper/CutterMode';
import { PaperSize } from '../../../models/paper/PaperSize';
import { PaperType } from '../../../models/paper/PaperType';
import { decodePngBase64ToMonochrome, type MonochromeBitmap } from '../../../rendering/MonochromeBitmap';

jest.mock('../../../rendering/MonochromeBitmap', () => {
  const actual = jest.requireActual('../../../rendering/MonochromeBitmap');
  return { __esModule: true, ...actual, decodePngBase64ToMonochrome: jest.fn(actual.decodePngBase64ToMonochrome) };
});
import { PrintErrorCode } from '../../../errors';
import type { PrintOptions } from '../../../models/printing/PrintOptions';

const printer = makePrinter({ language: makeEscPosLanguage() });

/** Ảnh 2x6 toàn đen: chuẩn hoá về bề rộng 576px thì cao 1728px (216mm). */
const tallPngBase64 = (): string => {
  const rgba = new Uint8Array(2 * 6 * 4);

  for (let alpha = 3; alpha < rgba.length; alpha += 4) {
    rgba[alpha] = 255;
  }

  return Buffer.from(new Uint8Array(UPNG.encode([rgba.buffer], 2, 6, 0, [], true))).toString('base64');
};

describe('EscPosLanguage', () => {
  it('ảnh không giải mã được → IMAGE_INVALID', () => {
    expect(() => EscPosLanguage.encode(printer, 'not-a-png')).toThrow(
      expect.objectContaining({ code: PrintErrorCode.INVALID_IMAGE }),
    );
  });

  it('giấy cuộn không giới hạn chiều cao: ảnh dài hơn 200mm vẫn encode được', () => {
    expect(() => EscPosLanguage.encode(printer, tallPngBase64())).not.toThrow();
  });
});

/** Encode với ảnh giải mã ra đúng `bitmap` trên giấy cuộn 80mm có `cutterMode` cho trước. */
const encodeBitmap = (bitmap: MonochromeBitmap, cutterMode: CutterMode, options?: PrintOptions): Uint8Array => {
  (decodePngBase64ToMonochrome as jest.Mock).mockReturnValueOnce(bitmap);
  const paper = { type: PaperType.Continuous, paperSize: PaperSize.Mm80, cutterMode } as const;

  return EscPosLanguage.encode(makePrinter({ language: makeEscPosLanguage(), paper }), 'png', options);
};

describe('EscPosLanguage.encode — byte GS v 0', () => {
  it('phát đúng header ESC @ + GS v 0 (m=0) với width/height little-endian, theo sau bởi đúng data bits', () => {
    const bits = new Uint8Array([0xff, 0x00, 0x0f, 0xf0, 0xaa, 0x55]);
    const bitmap: MonochromeBitmap = { widthBytes: 2, heightPx: 3, bits };
    const bytes = encodeBitmap(bitmap, CutterMode.PerJob);

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
    const bytes = encodeBitmap(bitmap, CutterMode.None);

    expect(bytes[6]).toBe(0x2c);
    expect(bytes[7]).toBe(0x01);
    expect(bytes[8]).toBe(0xf4);
    expect(bytes[9]).toBe(0x01);
  });

  it('cutterMode = none → không phát cut_bytes ([0x1b, 0x6d]) ở cuối', () => {
    const bitmap: MonochromeBitmap = { widthBytes: 1, heightPx: 1, bits: new Uint8Array([0xff]) };
    const bytes = encodeBitmap(bitmap, CutterMode.None);

    // header (6) + width/height (4) + 1 byte data = 11 byte, không có gì thêm sau đó.
    expect(bytes.length).toBe(11);
    expect(Array.from(bytes.slice(-1))).toEqual([0xff]);
  });

  it('cutterMode = perJob → phát cut_bytes ([0x1b, 0x6d]) ngay sau data', () => {
    const bitmap: MonochromeBitmap = { widthBytes: 1, heightPx: 1, bits: new Uint8Array([0xff]) };
    const bytes = encodeBitmap(bitmap, CutterMode.PerJob);

    expect(bytes.length).toBe(13);
    expect(Array.from(bytes.slice(-2))).toEqual([0x1b, 0x6d]);
  });

  it('cutterMode = perRow → cũng phát cut_bytes (chỉ "none" mới bỏ qua)', () => {
    const bitmap: MonochromeBitmap = { widthBytes: 1, heightPx: 1, bits: new Uint8Array([0x00]) };
    const bytes = encodeBitmap(bitmap, CutterMode.PerRow);

    expect(Array.from(bytes.slice(-2))).toEqual([0x1b, 0x6d]);
  });

  it('data KHÔNG bị đảo bit — khớp nguyên MonochromeBitmap.bits (khác lệnh BITMAP của TSPL)', () => {
    const bits = new Uint8Array([0b10110100, 0b00000000, 0b11111111]);
    const bitmap: MonochromeBitmap = { widthBytes: 3, heightPx: 1, bits };
    const bytes = encodeBitmap(bitmap, CutterMode.None);

    expect(Array.from(bytes.slice(10, 13))).toEqual(Array.from(bits));
  });
});

describe('EscPosLanguage.encode — tùy chọn in', () => {
  const dot: MonochromeBitmap = { widthBytes: 1, heightPx: 1, bits: new Uint8Array([0xff]) };
  const page = [0x1d, 0x76, 0x30, 0x00, 1, 0, 1, 0, 0xff];

  it('copies: lặp lại ảnh, mỗi bản cắt riêng', () => {
    const bytes = encodeBitmap(dot, CutterMode.PerJob, { copies: 2 });

    expect(Array.from(bytes)).toEqual([0x1b, 0x40, ...page, 0x1b, 0x6d, ...page, 0x1b, 0x6d]);
  });

  it('cut: false thì không gửi lệnh cắt dù giấy cấu hình cắt', () => {
    const bytes = encodeBitmap(dot, CutterMode.PerJob, { cut: false });

    expect(Array.from(bytes)).toEqual([0x1b, 0x40, ...page]);
  });

  it('feedMm: ESC J trước lệnh cắt, quá 255 dot thì tách nhiều lệnh', () => {
    const bytes = encodeBitmap(dot, CutterMode.PerJob, { feedMm: 40 }); // 320 dot

    expect(Array.from(bytes.slice(-8))).toEqual([0x1b, 0x4a, 255, 0x1b, 0x4a, 65, 0x1b, 0x6d]);
  });

  it('cashDrawer: mở ngăn kéo sau khi in xong', () => {
    const bytes = encodeBitmap(dot, CutterMode.None, { copies: 2, cashDrawer: true });

    expect(Array.from(bytes.slice(-5))).toEqual([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    expect(Array.from(bytes).filter((byte) => byte === 0x70)).toHaveLength(1);
  });
});
