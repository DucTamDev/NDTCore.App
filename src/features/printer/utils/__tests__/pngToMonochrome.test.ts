import UPNG from 'upng-js';
import { Buffer } from 'buffer';
import { decodePngBase64ToMonochrome } from '../pngToMonochrome';

const WHITE = [255, 255, 255, 255];
const BLACK = [0, 0, 0, 255];

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
    // Ảnh 8x1: nửa trái đen, nửa phải trắng.
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
