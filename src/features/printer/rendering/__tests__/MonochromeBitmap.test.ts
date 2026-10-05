import { rgbaToMonochromeBitmap, decodePngBase64ToMonochrome } from '../MonochromeBitmap';
import UPNG from 'upng-js';
import { Buffer } from 'buffer';

const WHITE = [255, 255, 255, 255];
const BLACK = [0, 0, 0, 255];
const TRANSPARENT = [10, 20, 30, 0];

const buildRgba = (rows: number[][][]): Uint8Array => {
  const flat = rows.flat(2);
  return new Uint8Array(flat);
};

describe('rgbaToMonochromeBitmap', () => {
  it('computes widthBytes as ceil(widthPx / 8), rounding up a partial byte', () => {
    const rgba = buildRgba([[WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE]]); // 9px wide
    const bitmap = rgbaToMonochromeBitmap(rgba, 9, 1);
    expect(bitmap.widthBytes).toBe(2);
    expect(bitmap.bits.length).toBe(2);
  });

  it('sets bit 0 (all white) for an all-white row', () => {
    const rgba = buildRgba([[WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE]]);
    const bitmap = rgbaToMonochromeBitmap(rgba, 8, 1);
    expect(bitmap.bits[0]).toBe(0b00000000);
  });

  it('sets bit 1 (all black) for an all-black row', () => {
    const rgba = buildRgba([[BLACK, BLACK, BLACK, BLACK, BLACK, BLACK, BLACK, BLACK]]);
    const bitmap = rgbaToMonochromeBitmap(rgba, 8, 1);
    expect(bitmap.bits[0]).toBe(0b11111111);
  });

  it('packs bits MSB-first — the leftmost pixel maps to the highest bit', () => {
    const rgba = buildRgba([[BLACK, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE]]);
    const bitmap = rgbaToMonochromeBitmap(rgba, 8, 1);
    expect(bitmap.bits[0]).toBe(0b10000000);
  });

  it('treats a fully transparent pixel as white regardless of its RGB', () => {
    const rgba = buildRgba([[TRANSPARENT, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE]]);
    const bitmap = rgbaToMonochromeBitmap(rgba, 8, 1);
    expect(bitmap.bits[0]).toBe(0b00000000);
  });

  it('produces heightPx * widthBytes total bytes for a multi-row image', () => {
    const rgba = buildRgba([
      [BLACK, BLACK, BLACK, BLACK, BLACK, BLACK, BLACK, BLACK],
      [WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE],
    ]);
    const bitmap = rgbaToMonochromeBitmap(rgba, 8, 2);
    expect(bitmap.heightPx).toBe(2);
    expect(bitmap.bits.length).toBe(2);
    expect(bitmap.bits[0]).toBe(0b11111111);
    expect(bitmap.bits[1]).toBe(0b00000000);
  });

  it('respects a custom threshold', () => {
    const gray = [100, 100, 100, 255];
    const rgba = buildRgba([[gray, gray, gray, gray, gray, gray, gray, gray]]);
    expect(rgbaToMonochromeBitmap(rgba, 8, 1, 50).bits[0]).toBe(0b00000000);
    expect(rgbaToMonochromeBitmap(rgba, 8, 1, 150).bits[0]).toBe(0b11111111);
  });
});


/**
 * Tự build 1 PNG thật (qua `UPNG.encode` — cùng thư viện, nhưng chỉ dùng ở
 * test để tạo fixture, không dùng trong code thật) rồi decode lại bằng
 * `decodePngBase64ToMonochrome` — verify round-trip thật thay vì mock
 * `upng-js`, vì đây chính là phần rủi ro nhất (tương thích PNG thật) cần
 * chứng minh bằng dữ liệu nhị phân thật, không phải giả lập.
 */
const buildPngBase64 = (widthPx: number, heightPx: number, pixels: number[][]): string => {
  const rgba = new Uint8Array(pixels.flat());
  const pngBytes = new Uint8Array(UPNG.encode([rgba.buffer], widthPx, heightPx, 0));
  return Buffer.from(pngBytes).toString('base64');
};

describe('decodePngBase64ToMonochrome', () => {
  it('decodes a real PNG and thresholds it into a matching monochrome bitmap', () => {
    const pixels = [BLACK, BLACK, BLACK, BLACK, WHITE, WHITE, WHITE, WHITE];
    const base64Png = buildPngBase64(8, 1, pixels);

    const bitmap = decodePngBase64ToMonochrome(base64Png);

    expect(bitmap.widthBytes).toBe(1);
    expect(bitmap.heightPx).toBe(1);
    expect(bitmap.bits[0]).toBe(0b11110000);
  });

  it('decodes a multi-row PNG preserving row order', () => {
    const pixels = [
      ...[BLACK, BLACK, BLACK, BLACK, BLACK, BLACK, BLACK, BLACK],
      ...[WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE],
    ];
    const base64Png = buildPngBase64(8, 2, pixels);

    const bitmap = decodePngBase64ToMonochrome(base64Png);

    expect(bitmap.heightPx).toBe(2);
    expect(bitmap.bits[0]).toBe(0b11111111);
    expect(bitmap.bits[1]).toBe(0b00000000);
  });
});
