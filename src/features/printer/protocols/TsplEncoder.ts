import type { PaperSize } from '../types/printer.types';

export class TsplEncoder {
  private commands: string[] = [];

  initialize(paperSize: PaperSize): this {
    const widthMm = paperSize === '58mm' ? 50 : 72;
    this.commands.push(`SIZE ${widthMm} mm, 30 mm`);
    this.commands.push('GAP 2 mm, 0 mm');
    this.commands.push('CLS');
    return this;
  }

  text(x: number, y: number, content: string): this {
    const escaped = content.replace(/"/g, '\\"');
    this.commands.push(`TEXT ${x},${y},"3",0,1,1,"${escaped}"`);
    return this;
  }

  barcode(x: number, y: number, content: string): this {
    const escaped = content.replace(/"/g, '\\"');
    this.commands.push(`BARCODE ${x},${y},"128",50,1,0,2,2,"${escaped}"`);
    return this;
  }

  qrcode(x: number, y: number, content: string): this {
    const escaped = content.replace(/"/g, '\\"');
    this.commands.push(`QRCODE ${x},${y},H,4,A,0,"${escaped}"`);
    return this;
  }

  /**
   * Mã hoá lệnh `BITMAP` để in ảnh raster. Lệnh `BITMAP` thật của TSPL cần
   * thêm các trường width-in-bytes/height/mode đứng trước dữ liệu ảnh thô —
   * dạng tối giản này chỉ mang theo những gì `PrintImageElement` hiện có
   * (`x`, `y`, `data`). Việc mở rộng `data` thành payload bitmap có cấu trúc
   * đầy đủ là việc cần làm tiếp theo, ghi nhận là khoảng trống đã biết, không
   * lặng lẽ coi đây là cách hiện thực đầy đủ.
   * (Encodes the `BITMAP` command for raster images. TSPL's real `BITMAP`
   * command needs width-in-bytes/height/mode fields ahead of the raw data —
   * this minimal form only carries what `PrintImageElement` currently has
   * (`x`, `y`, `data`). Extending `data` to a structured bitmap payload is
   * real follow-up work, tracked as a known gap, not silently treated as a
   * complete implementation.)
   */
  image(x: number, y: number, data: string): this {
    this.commands.push(`BITMAP ${x},${y},${data}`);
    return this;
  }

  cut(): this {
    this.commands.push('PRINT 1,1');
    return this;
  }

  encode(): Uint8Array {
    const payload = `${this.commands.join('\r\n')}\r\n`;
    const bytes = new Uint8Array(payload.length);
    for (let i = 0; i < payload.length; i += 1) {
      // eslint-disable-next-line no-bitwise -- intentional single-byte masking to produce raw TSPL output bytes
      bytes[i] = payload.charCodeAt(i) & 0xff;
    }
    return bytes;
  }
}
