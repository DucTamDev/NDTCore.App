/** Kích thước 1 ký tự của font bitmap có sẵn trong máy in, ở hệ số phóng đại 1. */
export interface BitmapFontSize {
  /** Độ rộng 1 ký tự, dots. */
  readonly width: number;

  /** Chiều cao 1 ký tự, dots. */
  readonly height: number;
}

/** Bảng font bitmap của 1 ngôn ngữ, theo mã font native. */
export type BitmapFontTable = Readonly<Record<string, BitmapFontSize>>;

/** Bộ font bitmap của 1 ngôn ngữ và giới hạn chọn font theo cỡ chữ. */
export interface BitmapFontSet {
  /** Mọi font máy in có sẵn — dùng để đọc ngược cỡ chữ khi parse. */
  readonly fonts: BitmapFontTable;

  /** Font được tự chọn theo cỡ chữ, theo thứ tự ưu tiên khi cao bằng nhau (loại font chuyên dụng như OCR). */
  readonly selectable: readonly string[];

  /** Font dùng khi element không khai báo cỡ chữ, hoặc mã font đọc được không có trong bảng. */
  readonly defaultFont: string;

  /** Hệ số phóng đại lớn nhất lệnh TEXT của ngôn ngữ nhận được. */
  readonly maxMagnification: number;
}

/** Font native + hệ số phóng đại nguyên cho 1 cỡ chữ. */
export interface BitmapFontChoice {
  /** Mã font native, VD `'2'`. */
  readonly font: string;

  /** Hệ số phóng đại nguyên, từ 1. */
  readonly magnification: number;
}

/**
 * Chọn font + hệ số phóng đại có chiều cao gần `fontSizeDots` nhất. Khi bằng nhau thì ưu tiên hệ số nhỏ
 * (font gốc to nét hơn font nhỏ phóng đại), rồi tới thứ tự trong `selectable`.
 * Không khai báo cỡ chữ thì dùng font mặc định ở hệ số 1, giữ nguyên output cũ của compiler.
 */
export function chooseBitmapFont(fontSizeDots: number | undefined, fontSet: BitmapFontSet): BitmapFontChoice {
  if (fontSizeDots === undefined) return { font: fontSet.defaultFont, magnification: 1 };

  let best: BitmapFontChoice = { font: fontSet.defaultFont, magnification: 1 };
  let bestDifference = Number.POSITIVE_INFINITY;
  for (let magnification = 1; magnification <= fontSet.maxMagnification; magnification++) {
    for (const font of fontSet.selectable) {
      const difference = Math.abs(fontSet.fonts[font].height * magnification - fontSizeDots);
      if (difference < bestDifference) {
        best = { font, magnification };
        bestDifference = difference;
      }
    }
  }
  return best;
}

/** Chiều cao chữ thật (dots) khi in `font` ở `magnification`; mã font lạ thì tính theo font mặc định. */
export function bitmapFontHeight(
  font: string,
  magnification: number,
  fontSet: BitmapFontSet,
): number {
  return bitmapFontSize(font, fontSet).height * magnification;
}

/** Kích thước 1 ký tự ở hệ số 1 của `font`; mã font lạ thì dùng font mặc định. */
export function bitmapFontSize(font: string, fontSet: BitmapFontSet): BitmapFontSize {
  return fontSet.fonts[font] ?? fontSet.fonts[fontSet.defaultFont];
}
