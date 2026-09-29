import type { ValueFormat } from './ValueFormat';

/** Đoạn chữ cố định. */
export interface TextSegment {
  /** Nội dung chữ cố định. */
  readonly text: string;
}

/** Đoạn lấy giá trị từ 1 biến dữ liệu template hoặc biến có sẵn (`$page`, `$unit`...). */
export interface VariableSegment {
  /** Tên biến. */
  readonly var: string;

  /** Cách hiển thị giá trị; bỏ trống thì dùng format mặc định theo kiểu biến. */
  readonly format?: ValueFormat;
}

/** Đoạn in chữ của 1 option kiểu `text` trong `settings` (VD dòng cuối hoá đơn). */
export interface OptionSegment {
  /** Tên option kiểu `text`. */
  readonly option: string;
}

/** 1 đoạn nội dung động của text/barcode/QR — nội dung là mảng segment ghép liền nhau. */
export type Segment = TextSegment | VariableSegment | OptionSegment;
