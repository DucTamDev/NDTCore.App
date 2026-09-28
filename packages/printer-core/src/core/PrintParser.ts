import type { PrintParseResult } from './PrintParseResult';

/** Đọc ngược lệnh máy in thành cấu trúc để kiểm tra hoặc chuyển sang ngôn ngữ khác. */
export interface PrintParser<TCommand = unknown> {
  parse(source: string | Uint8Array): PrintParseResult<TCommand>;
}
