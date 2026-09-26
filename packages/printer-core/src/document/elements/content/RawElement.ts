/**
 * Element raw — chuỗi lệnh máy in hoặc dãy byte được chèn thẳng vào output
 * đã compile, bỏ qua hoàn toàn mô hình element của builder.
 */
export interface RawElement {
  type: 'raw';
  /** Nội dung chèn thẳng — chuỗi lệnh (TSPL) hoặc byte thô (ESC/POS). */
  content: string | Uint8Array;
}
