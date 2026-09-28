import type { PrintElement } from '../document';

/** Kết quả chung mà parser của mọi ngôn ngữ trả. */
export interface PrintParseResult<TCommand = unknown> {
  /** Lệnh đọc được theo thứ tự xuất hiện; cấu trúc từng lệnh riêng theo ngôn ngữ. */
  commands: TCommand[];

  /** Element dựng lại được từ lệnh. */
  elements: PrintElement[];

  /** Khổ ngang (dots); bỏ trống khi ngôn ngữ không có lệnh khai báo khổ, để phân biệt với giá trị 0 thật. */
  widthDots?: number;

  /** Chiều dài tem (dots); bỏ trống khi ngôn ngữ không có lệnh khai báo, để phân biệt với giá trị 0 thật. */
  heightDots?: number;

  /** Lệnh không nhận diện được hoặc dữ liệu hỏng gặp khi parse. */
  warnings: string[];
}
