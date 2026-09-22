/**
 * Options cho lệnh cắt giấy. Chỉ là mô tả khái niệm — không có logic phát
 * byte ở đây (việc đó thuộc về compiler của từng ngôn ngữ, VD
 * `language/escpos/EscPosCompiler.ts`).
 */
export interface CutOptions {
  /** Số nhãn/hoá đơn in ra trước khi cắt — mặc định 1 (cắt sau mỗi nhãn). */
  rows?: number;

  /** Kiểu cắt: `'full'` (cắt đứt hẳn), `'partial'` (chừa lại phần xé tay), hoặc `'off'` (tắt tự động cắt). */
  mode?: 'off' | 'partial' | 'full';
}

/** Một lệnh cắt giấy. */
export interface CutElement {
  type: 'cut';
  options?: CutOptions;
}
