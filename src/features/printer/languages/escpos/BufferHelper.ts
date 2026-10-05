import { Buffer } from 'buffer';

/** Gom nhiều `Buffer` rời rồi nối một lần ở cuối, tránh copy lại toàn bộ sau mỗi lần thêm. */
export class BufferHelper {
  /** Các buffer đã thêm, theo thứ tự. */
  private buffers: Buffer[] = [];

  /** Tổng số byte của `buffers`. */
  private size = 0;

  /** Độ dài tổng (byte) đã tích luỹ. / Total accumulated byte length. */
  get length(): number {
    return this.size;
  }

  /**
   * Thêm 1 buffer vào cuối. / Append one buffer.
   * @param buffer Buffer cần nối. / Buffer to concatenate.
   */
  concat = (buffer: Buffer): this => {
    this.buffers.push(buffer);
    this.size += buffer.length;
    return this;
  };

  /** Xoá toàn bộ nội dung đã tích luỹ. / Clear all accumulated content. */
  empty = (): this => {
    this.buffers = [];
    this.size = 0;
    return this;
  };

  /** Nối tất cả buffer thành 1. / Concatenate everything into a single buffer. */
  toBuffer = (): Buffer => Buffer.concat(this.buffers, this.size);

  /**
   * Nối rồi encode ra chuỗi. / Concatenate then encode to string.
   * @param encoding Kiểu encode (vd `'base64'`). / Encoding (e.g. `'base64'`).
   */
  toString = (encoding?: BufferEncoding): string => this.toBuffer().toString(encoding);
}
