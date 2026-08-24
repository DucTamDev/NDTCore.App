import type { PaperSize } from '../types/printer.types';
import type { PrintType } from '../types/printConfiguration.types';
import type { MonochromeBitmap } from '../utils/monochromeBitmap';

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
 * Chiều cao khổ giấy mặc định khai báo trong `SIZE`/`GAP` khi in Tem
 * (`PrintType.Label`) và máy in chưa tự cấu hình `PrinterConfig.labelHeightMm`
 * (máy in đã lưu từ trước khi field này tồn tại). Với giấy tem rời có khe,
 * con số này phải khớp chiều dài tem VẬT LÝ để cảm biến dò khe hoạt động
 * đúng — không phải khớp nội dung cần in, và KHÔNG có nghĩa mọi máy đều dùng
 * tem 30mm (giấy vật lý mỗi nơi khác nhau) — xem `PrinterConfig.labelHeightMm`.
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

/** 203dpi — mật độ dot tiêu chuẩn của phần lớn máy in nhiệt TSPL (8 dot/mm). */
export const DOTS_PER_MM = 8;

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
   * `printType === 'Label'` → giấy tem rời có khe thật: khai báo `GAP 2mm,0mm`
   * (dò khe) + `labelHeightMm` khớp khổ tem vật lý. Mọi trường hợp khác
   * (`'Receipt'` hoặc không truyền — vd `identify()`-only flow không có
   * printType) → giấy cuộn liên tục, không có khe thật: `GAP 0,0` (tắt dò
   * khe) + `CONTINUOUS_HEIGHT_MM` (ngưỡng an toàn rộng, không phải khổ giấy
   * thật cần khớp).
   */
  initialize(paperSize: PaperSize, printType: PrintType = 'Receipt', labelHeightMm: number = DEFAULT_LABEL_HEIGHT_MM): this {
    const widthMm = paperSize === '58mm' ? 50 : 72;
    if (printType === 'Label') {
      this.pushLine(`SIZE ${widthMm} mm, ${labelHeightMm} mm`);
      this.pushLine('GAP 2 mm, 0 mm');
    } else {
      this.pushLine(`SIZE ${widthMm} mm, ${CONTINUOUS_HEIGHT_MM} mm`);
      this.pushLine('GAP 0 mm, 0 mm');
    }
    this.pushLine('CODEPAGE UTF-8');
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
   */
  text(x: number, y: number, content: string): this {
    const escaped = content.replace(/"/g, '\\"');
    this.pushLine(`TEXT ${x},${y},"3",0,1,1,"${escaped}"`);
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
   */
  image(x: number, y: number, bitmap: MonochromeBitmap): this {
    this.bytes.push(...encodeUtf8(`BITMAP ${x},${y},${bitmap.widthBytes},${bitmap.heightPx},0,`));
    // Không dùng `push(...bitmap.bits)` — bill dài có thể tạo hàng chục nghìn
    // byte, spread từng đó phần tử làm argument cho `push()` vừa chậm vừa có
    // thể vượt giới hạn số argument của JS engine (Hermes). Vòng lặp thường
    // luôn an toàn và tuyến tính bất kể kích thước mảng.
    for (let i = 0; i < bitmap.bits.length; i += 1) this.bytes.push(bitmap.bits[i]);
    this.bytes.push(...encodeUtf8('\r\n'));
    return this;
  }

  cut(): this {
    this.pushLine('PRINT 1,1');
    return this;
  }

  encode(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}
