/** Kết quả compile: lệnh máy in + cảnh báo về những gì máy in không làm được. */
export interface CompileResult<TOutput> {
  /** Chuỗi lệnh (TSPL) hoặc byte (ESC/POS) để gửi tới máy in. */
  readonly output: TOutput;

  /** Field/element bị bỏ qua hoặc gộp vì ngôn ngữ không hỗ trợ; mỗi cảnh báo xuất hiện 1 lần. */
  readonly warnings: readonly string[];
}
