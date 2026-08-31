import type { PrintMedia } from '../../types/printer.types';
import { CutterMode, PrintMediaType, TsplCodepage } from '../../types/printer.types';
import { PrintType } from '../../types/printConfiguration.types';
import type { MonochromeBitmap } from '../../utils/monochromeBitmap';
import { encodeCp1258 } from '../../utils/cp1258';
import { DOTS_PER_MM, PAPER_WIDTH_CHARS, PRINTABLE_WIDTH_MM } from '../../utils/paperSize';

/**
 * Mã hoá UTF-8 thật theo code point (không phải cắt byte thấp của
 * UTF-16 code unit) — bắt buộc để in đúng tiếng Việt có dấu. Đa số ký tự có
 * dấu tiếng Việt (vd `ố`, `ự`, `ư`, `đ`) nằm ngoài dải U+0000-U+00FF, cắt
 * bằng `& 0xff` sẽ ra byte sai hoàn toàn, không phải chỉ mất dấu. Đi cùng
 * lệnh `CODEPAGE UTF-8` ở `initialize()` để máy in TSPL hiểu đúng byte nhận
 * được là UTF-8.
 */
const encodeUtf8 = (text: string): number[] => {
  const bytes: number[] = [];
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      // eslint-disable-next-line no-bitwise -- intentional bit-shifting to split a code point into UTF-8 continuation bytes
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      // eslint-disable-next-line no-bitwise -- intentional bit-shifting to split a code point into UTF-8 continuation bytes
      bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(
        // eslint-disable-next-line no-bitwise -- intentional bit-shifting to split a code point into UTF-8 continuation bytes
        0xf0 | (codePoint >> 18),
        // eslint-disable-next-line no-bitwise -- intentional bit-shifting to split a code point into UTF-8 continuation bytes
        0x80 | ((codePoint >> 12) & 0x3f),
        // eslint-disable-next-line no-bitwise -- intentional bit-shifting to split a code point into UTF-8 continuation bytes
        0x80 | ((codePoint >> 6) & 0x3f),
        // eslint-disable-next-line no-bitwise -- intentional bit-shifting to split a code point into UTF-8 continuation bytes
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return bytes;
};

/**
 * Cắt byte thấp của mỗi code unit — dùng cho codepage 1 byte/ký tự (vd
 * `1252` Latin-1 Tây Âu). Ký tự tiếng Việt có dấu nằm ngoài U+00FF sẽ ra byte
 * sai; đó là giới hạn CỦA codepage 1252, không phải bug — người dùng chọn
 * `1258` nếu cần tiếng Việt.
 */
const encodeSingleByte = (text: string): number[] => {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    // eslint-disable-next-line no-bitwise -- intentional low-byte masking for a single-byte codepage
    bytes.push(text.charCodeAt(i) & 0xff);
  }
  return bytes;
};

/**
 * Chiều cao khổ giấy mặc định khai báo trong `SIZE`/`GAP` khi in Tem
 * (`PrintType.Label`) và driver chưa tự cấu hình `media.itemHeightMm`
 * (máy in đã lưu từ trước khi field này tồn tại). Với giấy tem rời có khe,
 * con số này phải khớp chiều dài tem VẬT LÝ để cảm biến dò khe hoạt động
 * đúng — không phải khớp nội dung cần in, và KHÔNG có nghĩa mọi máy đều dùng
 * tem 30mm (giấy vật lý mỗi nơi khác nhau) — xem `media.itemHeightMm`.
 * Nội dung cao hơn khổ giấy thật phải bị chặn ở tầng gọi (`TsplDriver`),
 * không thể "sửa" bằng cách nới `SIZE` lên tuỳ tiện.
 */
export const DEFAULT_LABEL_HEIGHT_MM = 30;

/**
 * Chiều cao "khai báo" cho `SIZE` khi in Hoá đơn (`PrintType.Receipt`) — giấy
 * cuộn liên tục không có khe vật lý thật nên không có khái niệm "khổ giấy"
 * cần khớp cảm biến như Tem; con số này chỉ là ngưỡng an toàn rộng rãi
 * (không phải giới hạn phần cứng thật) để tránh 1 document lỗi/vô hạn vòng
 * lặp tạo ra bitmap khổng lồ, KHÔNG nhằm giới hạn 1 hoá đơn bình thường.
 */
export const CONTINUOUS_HEIGHT_MM = 200;

export { DOTS_PER_MM };

/**
 * Chiều cao khai báo cho `SIZE`:
 * - die_cut → `itemHeightMm` (schema SP-A đảm bảo có).
 * - continuous Label → `itemHeightMm ?? DEFAULT_LABEL_HEIGHT_MM`.
 * - continuous Receipt (hoặc không truyền printType) → `CONTINUOUS_HEIGHT_MM`.
 *
 * Declared height for `SIZE`: die_cut → item height; continuous Label →
 * item height or the default; continuous Receipt → the wide safety ceiling.
 */
export const resolveSizeHeightMm = (media: PrintMedia, printType: PrintType): number => {
  if (media.type === PrintMediaType.dieCut) return media.itemHeightMm ?? DEFAULT_LABEL_HEIGHT_MM;
  if (printType === PrintType.Label) return media.itemHeightMm ?? DEFAULT_LABEL_HEIGHT_MM;
  return CONTINUOUS_HEIGHT_MM;
};

/**
 * Khoảng cách tâm-đến-tâm giữa 2 cột die-cut, theo dot. Chỉ có nghĩa khi
 * `media.type === 'die_cut'`.
 *
 * Centre-to-centre pitch between two die-cut columns, in dots.
 */
export const columnPitchDots = (media: PrintMedia): number =>
  ((media.itemWidthMm ?? 0) + (media.horizontalGapMm ?? 0)) * DOTS_PER_MM;

/**
 * x-offset (dot) cho từng cột: die_cut → `[0, pitch, ...]` (`columns` phần
 * tử); mọi trường hợp khác → `[0]`.
 *
 * Per-column x-offset in dots: die_cut → one entry per column; otherwise `[0]`.
 */
export const columnOffsets = (media: PrintMedia): number[] => {
  if (media.type !== PrintMediaType.dieCut) return [0];
  const pitch = columnPitchDots(media);
  return Array.from({ length: media.columns ?? 1 }, (_, i) => i * pitch);
};

/**
 * Số ký tự/dòng cho nội dung TEXT: die_cut → ước lượng theo `itemWidthMm`
 * (tỉ lệ với `PAPER_WIDTH_CHARS`/`PRINTABLE_WIDTH_MM` của khổ giấy); continuous
 * → `PAPER_WIDTH_CHARS[paperSize]` như cũ. `line`/`row` element dùng số này để
 * không tràn qua cột die-cut kế bên.
 *
 * Per-column character width for TEXT content: die_cut estimates from
 * `itemWidthMm`; continuous keeps the full paper char count.
 */
export const contentWidthChars = (media: PrintMedia): number => {
  if (media.type !== PrintMediaType.dieCut) return PAPER_WIDTH_CHARS[media.paperSize];
  const full = PAPER_WIDTH_CHARS[media.paperSize];
  const ratio = (media.itemWidthMm ?? 0) / PRINTABLE_WIDTH_MM[media.paperSize];
  return Math.max(1, Math.floor(full * ratio));
};

export class TsplEncoder {
  /**
   * Byte thô (không phải `string[]` như trước) — bắt buộc từ khi có
   * `image()`: dữ liệu `BITMAP` là byte nhị phân thật (1 bit/pixel), đưa qua
   * `encodeUtf8()` như các lệnh text khác sẽ diễn giải sai byte ≥ 0x80 thành
   * chuỗi UTF-8 nhiều byte, phá hỏng ảnh. Lệnh text (`SIZE`/`TEXT`/...) vẫn
   * UTF-8-encode ngay lúc push; `image()` nối thẳng byte nhị phân, không qua
   * `encodeUtf8()`.
   */
  private bytes: number[] = [];

  /**
   * Codepage đang khai báo — set 1 lần ở `initialize()`, quyết định cách
   * `text()` encode nội dung trong dấu `""`. Mặc định UTF-8 để giữ nguyên hành
   * vi cũ (bitmap/truetype strategy không truyền tham số này).
   */
  private codepage: TsplCodepage = TsplCodepage.utf8;

  private pushLine(line: string): void {
    this.bytes.push(...encodeUtf8(`${line}\r\n`));
  }

  /**
   * `SIZE`/`GAP` theo `media.type`:
   * - die_cut → giấy tem rời có khe thật giữa các hàng: `SIZE` khai báo BỀ
   *   RỘNG cả hàng (mọi cột + khe ngang) × `itemHeightMm`, `GAP <verticalGapMm>`
   *   để cảm biến dò khe dọc.
   * - continuous (Receipt hoặc Label, hoặc không truyền printType) → giấy cuộn
   *   liên tục KHÔNG có khe vật lý: `GAP 0,0` (tắt dò khe). Chiều cao lấy từ
   *   `resolveSizeHeightMm`.
   *
   * `SIZE`/`GAP` follow `media.type`: die_cut declares the full row width and
   * senses the vertical gap; continuous always emits `GAP 0,0`.
   */
  initialize(media: PrintMedia, printType: PrintType = PrintType.Receipt, codepage: TsplCodepage = TsplCodepage.utf8): this {
    this.codepage = codepage;
    const heightMm = resolveSizeHeightMm(media, printType);
    if (media.type === PrintMediaType.dieCut) {
      const columns = media.columns ?? 1;
      const rowWidthMm = columns * (media.itemWidthMm ?? 0) + (columns - 1) * (media.horizontalGapMm ?? 0);
      this.pushLine(`SIZE ${rowWidthMm} mm, ${heightMm} mm`);
      this.pushLine(`GAP ${media.verticalGapMm ?? 0} mm, 0 mm`);
    } else {
      this.pushLine(`SIZE ${PRINTABLE_WIDTH_MM[media.paperSize]} mm, ${heightMm} mm`);
      this.pushLine('GAP 0 mm, 0 mm');
    }
    this.pushLine(`CODEPAGE ${codepage}`);
    this.pushLine('CLS');
    return this;
  }

  /**
   * Font built-in `"3"` là bitmap font cơ bản của TSPL — trên nhiều dòng máy
   * chỉ có glyph ASCII, không có dấu tiếng Việt dù byte gửi lên đã đúng
   * UTF-8. Việc chọn font Unicode thật (vd font resident `TSS24.BF2` hoặc
   * tải font TrueType qua lệnh `DOWNLOAD`) phụ thuộc từng dòng máy TSPL cụ
   * thể — chưa verify trên phần cứng thật nên chưa hardcode ở đây, ghi nhận
   * là khoảng trống đã biết. `image()` (BITMAP) là đường vòng cho vấn đề này
   * khi nội dung cần hiển thị chính xác bất kể font máy in có gì.
   *
   * Tham số `fontName` cho phép ghi đè font mặc định — hữu ích khi cần font
   * custom (vd font TrueType đã tải qua `DOWNLOAD`, hoặc font resident cho
   * `renderMode: 'internalfont'`). Mặc định `'3'` để giữ lại hành vi hiện tại.
   *
   * Nội dung trong dấu `""` được encode theo `this.codepage` (set ở
   * `initialize()`): UTF-8 (mặc định) → `encodeUtf8`; `1258` → `encodeCp1258`
   * (byte nền + byte thanh tổ hợp); còn lại → byte thấp 1 byte/ký tự. Phần
   * cố định của lệnh luôn là ASCII.
   */
  text(x: number, y: number, content: string, fontName: string = '3'): this {
    const escaped = content.replace(/"/g, '\\"');
    if (this.codepage === TsplCodepage.utf8) {
      this.pushLine(`TEXT ${x},${y},"${fontName}",0,1,1,"${escaped}"`);
      return this;
    }
    const contentBytes = this.codepage === TsplCodepage.cp1258 ? encodeCp1258(escaped) : encodeSingleByte(escaped);
    this.bytes.push(...encodeSingleByte(`TEXT ${x},${y},"${fontName}",0,1,1,"`), ...contentBytes, ...encodeSingleByte('"\r\n'));
    return this;
  }

  barcode(x: number, y: number, content: string): this {
    const escaped = content.replace(/"/g, '\\"');
    this.pushLine(`BARCODE ${x},${y},"128",50,1,0,2,2,"${escaped}"`);
    return this;
  }

  qrcode(x: number, y: number, content: string): this {
    const escaped = content.replace(/"/g, '\\"');
    this.pushLine(`QRCODE ${x},${y},H,4,A,0,"${escaped}"`);
    return this;
  }

  /**
   * Lệnh `BITMAP` thật của TSPL: `BITMAP x,y,width(byte),height,mode,<byte
   * nhị phân>` — width tính theo BYTE (không phải pixel), theo sau bởi đúng
   * `widthBytes * heightPx` byte nhị phân thô rồi mới tới CRLF kế tiếp,
   * không phải text UTF-8. `mode=0` (OVERWRITE) — đè thẳng lên vùng in,
   * không cần OR/XOR với nội dung cũ vì mỗi bill là 1 lượt in mới.
   *
   * Đảo bit (`^ 0xff`) trước khi gửi: `MonochromeBitmap.bits` theo đúng chuẩn
   * TSPL2 (bit 1 = đen/in ra, xem `monochromeBitmap.ts`), nhưng firmware TSPL
   * clone trên phần cứng thực tế đã kiểm chứng (Xprinter XP-420B) lại đọc bit
   * này ngược — bit 1 = không in, khiến nền (bit=0) bị in đen và chữ (bit=1)
   * lại thành khoảng trắng. Đảo ở đây, ngay sát lúc build lệnh `BITMAP`, để
   * `MonochromeBitmap`/`rgbaToMonochromeBitmap()` vẫn giữ đúng nghĩa chuẩn,
   * không lan quirk riêng của 1 dòng máy in ra các phần dùng chung khác.
   */
  image(x: number, y: number, bitmap: MonochromeBitmap): this {
    this.bytes.push(...encodeUtf8(`BITMAP ${x},${y},${bitmap.widthBytes},${bitmap.heightPx},0,`));
    // Không dùng `push(...bitmap.bits)` — bill dài có thể tạo hàng chục nghìn
    // byte, spread từng đó phần tử làm argument cho `push()` vừa chậm vừa có
    // thể vượt giới hạn số argument của JS engine (Hermes). Vòng lặp thường
    // luôn an toàn và tuyến tính bất kể kích thước mảng.
    // eslint-disable-next-line no-bitwise -- intentional bit inversion, see doc comment above
    for (let i = 0; i < bitmap.bits.length; i += 1) this.bytes.push(bitmap.bits[i] ^ 0xff);
    this.bytes.push(...encodeUtf8('\r\n'));
    return this;
  }

  /**
   * `SET CUTTER` + `PRINT rows,1`:
   * - `per_row` → `SET CUTTER 1` (cắt sau mỗi hàng).
   * - `per_job` → `SET CUTTER <rows>` (cắt 1 lần sau cả job).
   * - `none` → `SET CUTTER OFF` (tắt hẳn dao cắt).
   *
   * `SET CUTTER` là thiết lập BỀN của máy in TSPL: một khi job gửi `SET CUTTER n`
   * thì máy vẫn tiếp tục cắt ở các job sau. Phát `SET CUTTER OFF` cho `none` để
   * kill-switch (`cutterMode: 'none'`) và giấy die_cut thật sự dừng được máy đã
   * từng nhận `SET CUTTER n`, thay vì chỉ "không set lại".
   *
   * `SET CUTTER` (or `SET CUTTER OFF` for `none`) then `PRINT rows,1`.
   */
  cut(rows: number, mode: CutterMode): this {
    if (mode === CutterMode.none) this.pushLine('SET CUTTER OFF');
    else if (mode === CutterMode.perRow) this.pushLine('SET CUTTER 1');
    else this.pushLine(`SET CUTTER ${rows}`);
    this.pushLine(`PRINT ${rows},1`);
    return this;
  }

  encode(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}
