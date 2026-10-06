import UPNG from 'upng-js';
import { Buffer } from 'buffer';

/** Độ sáng (0–255) dưới ngưỡng này là chấm đen. */
const DEFAULT_THRESHOLD = 128;

/** Ảnh 1-bit đóng gói theo hàng, bit cao nhất của mỗi byte là pixel bên trái; bit `1` là chấm in (đen). */
export interface MonochromeBitmap {
  /** Số byte mỗi hàng, `ceil(rộng px / 8)`; lệnh in raster nhận chiều rộng theo byte. */
  widthBytes: number;

  /** Số hàng pixel. */
  heightPx: number;

  /** `widthBytes * heightPx` byte, hàng trên trước. */
  bits: Uint8Array;
}

/** Ảnh RGBA đã decode. */
interface RgbaImage {
  /** Pixel theo hàng, mỗi pixel 4 byte R, G, B, A. */
  data: Uint8Array;

  /** Chiều rộng (px). */
  width: number;

  /** Chiều cao (px). */
  height: number;
}

/** Pixel trong suốt là nền nên luôn trắng, bất kể màu RGB bên dưới. */
const luminanceAt = (rgba: Uint8Array, offset: number): number => {
  if (rgba[offset + 3] === 0) {
    return 255;
  }

  return (rgba[offset] * 299 + rgba[offset + 1] * 587 + rgba[offset + 2] * 114) / 1000;
};

const setDot = (bits: Uint8Array, widthBytes: number, x: number, y: number): void => {
  // eslint-disable-next-line no-bitwise -- mỗi byte chứa 8 pixel, pixel trái nhất ở bit cao nhất
  bits[y * widthBytes + Math.floor(x / 8)] |= 0x80 >> x % 8;
};

const copyPixel = (src: Uint8Array, srcOffset: number, dst: Uint8Array, dstOffset: number): void => {
  dst[dstOffset] = src[srcOffset];
  dst[dstOffset + 1] = src[srcOffset + 1];
  dst[dstOffset + 2] = src[srcOffset + 2];
  dst[dstOffset + 3] = src[srcOffset + 3];
};

/** `upng-js` decode thuần JS vì RN không có Canvas; ảnh chụp chỉ có một frame nên lấy frame đầu. */
const decodePng = (base64Png: string): RgbaImage => {
  const decoded = UPNG.decode(Buffer.from(base64Png, 'base64'));
  const [rgba] = UPNG.toRGBA8(decoded);
  return { data: new Uint8Array(rgba), width: decoded.width, height: decoded.height };
};

/**
 * Thu nhỏ nearest-neighbor về `width`, giữ tỉ lệ. Ảnh chụp theo pixel vật lý (dp × pixel ratio) nên rộng hơn khổ giấy
 * 2–3 lần; thu nhỏ ở đây thay vì truyền kích thước cho `captureRef` vì kích thước đó phải đọc từ `onLayout`, sự kiện
 * có thể bắn với số đo tạm trước khi nội dung đo xong.
 */
const resizeToWidth = (image: RgbaImage, width: number): RgbaImage => {
  const scale = image.width / width;
  const height = Math.max(1, Math.round(image.height / scale));
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const srcY = Math.min(image.height - 1, Math.floor(y * scale));

    for (let x = 0; x < width; x += 1) {
      const srcX = Math.min(image.width - 1, Math.floor(x * scale));
      copyPixel(image.data, (srcY * image.width + srcX) * 4, data, (y * width + x) * 4);
    }
  }

  return { data, width, height };
};

/** Lấy ngưỡng độ sáng để ra ảnh đen trắng thuần, vì lệnh in raster không có màu hay mức xám. */
export const rgbaToMonochromeBitmap = (
  rgba: Uint8Array,
  widthPx: number,
  heightPx: number,
  threshold = DEFAULT_THRESHOLD,
): MonochromeBitmap => {
  const widthBytes = Math.ceil(widthPx / 8);
  const bits = new Uint8Array(widthBytes * heightPx);

  for (let y = 0; y < heightPx; y += 1) {
    for (let x = 0; x < widthPx; x += 1) {
      if (luminanceAt(rgba, (y * widthPx + x) * 4) < threshold) {
        setDot(bits, widthBytes, x, y);
      }
    }
  }

  return { widthBytes, heightPx, bits };
};

/**
 * PNG base64 (không tiền tố `data:`) → bitmap 1-bit. Có `targetWidthPx` khác bề rộng ảnh thì thu về đúng bề rộng đó
 * trước khi lấy ngưỡng.
 */
export const decodePngBase64ToMonochrome = (base64Png: string, targetWidthPx?: number): MonochromeBitmap => {
  const decoded = decodePng(base64Png);
  const needsResize = targetWidthPx !== undefined && decoded.width !== targetWidthPx;
  const image = needsResize ? resizeToWidth(decoded, targetWidthPx) : decoded;
  return rgbaToMonochromeBitmap(image.data, image.width, image.height);
};
