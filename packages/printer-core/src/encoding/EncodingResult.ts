import type { CodePage } from './CodePage';

/** Kết quả mã hoá chữ cho máy in: byte và code page mà byte đó giả định. */
export interface EncodingResult {
  /** Byte đã mã hoá, gửi thẳng tới máy in. */
  bytes: Uint8Array;

  /** Code page của byte; null khi không cần code page (toàn ASCII hoặc gửi thẳng UTF-8). */
  codePage: CodePage | null;

  /** Ký tự không có trong code page nào, đã thay bằng '?'. */
  unmappedChars: string[];
}
