import type { DieCutPaper, PaperOptions } from '../../models/paper/PaperOptions';
import { CutterMode, PaperType } from '../../models/paper/PaperOptions';
import { PrintKind } from '../../models/printer/PrintKind';
import type { MonochromeBitmap } from '../../rendering/MonochromeBitmap';
import { DOTS_PER_MM, PAPER_SIZE_SPECS, CONTINUOUS_HEIGHT_MM } from '../../models/paper/paperSpec';

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
 * Chiều cao khai báo trong `SIZE` khi in tem trên giấy cuộn (không có kích thước tem). Nội dung cao hơn phải bị
 * chặn ở nơi gọi; nới `SIZE` không làm máy in thêm giấy.
 */
export const DEFAULT_LABEL_HEIGHT_MM = 30;

export { DOTS_PER_MM, CONTINUOUS_HEIGHT_MM };

/** Chiều cao khai báo cho `SIZE`: giấy tem theo con tem; tem trên giấy cuộn theo mặc định; hoá đơn theo trần an toàn. */
export const resolveSizeHeightMm = (media: PaperOptions, kind: PrintKind): number => {
  if (media.type === PaperType.DieCut) {
    return media.itemHeightMm;
  }

  if (kind === PrintKind.Label) {
    return DEFAULT_LABEL_HEIGHT_MM;
  }

  return CONTINUOUS_HEIGHT_MM;
};

/** Khoảng cách tâm-đến-tâm giữa hai cột tem (dot). */
export const columnPitchDots = (media: DieCutPaper): number => (media.itemWidthMm + media.horizontalGapMm) * DOTS_PER_MM;

/** Toạ độ x (dot) của từng cột: giấy tem một phần tử mỗi cột; giấy cuộn chỉ `[0]`. */
export const columnOffsets = (media: PaperOptions): number[] => {
  if (media.type !== PaperType.DieCut) {
    return [0];
  }

  const pitch = columnPitchDots(media);
  return Array.from({ length: media.columns }, (_, i) => i * pitch);
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

  private pushLine(line: string): void {
    this.bytes.push(...encodeUtf8(`${line}\r\n`));
  }

  /**
   * `SIZE`/`GAP` theo `media.type`:
   * - die_cut → giấy tem rời có khe thật giữa các hàng: `SIZE` khai báo BỀ
   *   RỘNG cả hàng (mọi cột + khe ngang) × `itemHeightMm`, `GAP <verticalGapMm>`
   *   để cảm biến dò khe dọc.
   * - continuous (Receipt hoặc Label, hoặc không truyền kind) → giấy cuộn
   *   liên tục KHÔNG có khe vật lý: `GAP 0,0` (tắt dò khe). Chiều cao lấy từ
   *   `resolveSizeHeightMm`.
   *
   * `SIZE`/`GAP` follow `media.type`: die_cut declares the full row width and
   * senses the vertical gap; continuous always emits `GAP 0,0`.
   */
  initialize(media: PaperOptions, kind: PrintKind = PrintKind.Receipt): this {
    const heightMm = resolveSizeHeightMm(media, kind);

    if (media.type === PaperType.DieCut) {
      const { columns } = media;
      const rowWidthMm = columns * media.itemWidthMm + (columns - 1) * media.horizontalGapMm;
      this.pushLine(`SIZE ${rowWidthMm} mm, ${heightMm} mm`);
      this.pushLine(`GAP ${media.verticalGapMm} mm, 0 mm`);
    } else {
      this.pushLine(`SIZE ${PAPER_SIZE_SPECS[media.paperSize].printableWidthMm} mm, ${heightMm} mm`);
      this.pushLine('GAP 0 mm, 0 mm');
    }

    this.pushLine('CODEPAGE UTF-8');
    this.pushLine('CLS');
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
   * TSPL2 (bit 1 = đen/in ra, xem `rendering/MonochromeBitmap.ts`), nhưng firmware TSPL
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
    for (let i = 0; i < bitmap.bits.length; i += 1) {
      // eslint-disable-next-line no-bitwise -- intentional bit inversion, see doc comment above
      this.bytes.push(bitmap.bits[i] ^ 0xff);
    }

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
    switch (mode) {
      case CutterMode.None:
        this.pushLine('SET CUTTER OFF');
        break;
      case CutterMode.PerRow:
        this.pushLine('SET CUTTER 1');
        break;
      default:
        this.pushLine(`SET CUTTER ${rows}`);
    }

    this.pushLine(`PRINT ${rows},1`);
    return this;
  }

  encode(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}
