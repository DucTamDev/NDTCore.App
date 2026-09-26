/** Kết quả chung mà parser của mọi ngôn ngữ đều trả. */
export interface ParsedCommands {
  /** Lệnh đọc được theo thứ tự xuất hiện; cấu trúc từng lệnh riêng theo ngôn ngữ. */
  commands: unknown[];

  /** Lệnh không nhận diện được hoặc dữ liệu hỏng gặp khi parse. */
  warnings: string[];
}

/** Đọc ngược lệnh máy in thành cấu trúc để kiểm tra hoặc chuyển sang ngôn ngữ khác. */
export interface PrintParser<TResult> {
  parse(source: string | Uint8Array): TResult;
}
