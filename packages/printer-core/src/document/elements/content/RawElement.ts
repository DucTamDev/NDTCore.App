/**
 * Element raw — chuỗi lệnh máy in hoặc dãy byte được chèn thẳng vào output
 * đã compile, bỏ qua hoàn toàn mô hình element của builder.
 */
export interface RawElement {
  type: 'raw';
  /** Nội dung chèn thẳng — chuỗi lệnh (hầu hết ngôn ngữ) hoặc byte thô (ESC/POS, Star PRNT). */
  content: string | Uint8Array;
}
