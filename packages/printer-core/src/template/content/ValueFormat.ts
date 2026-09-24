/** Ký hiệu tiền tệ; chuỗi rỗng là chỉ in số. */
export type CurrencySymbol = 'đ' | '₫' | 'VND' | '';

/** In số có phân tách hàng nghìn, VD `45.000`. */
export interface NumberFormat {
  readonly type: 'number';

  /** Số chữ số thập phân; mặc định 0. */
  readonly decimals?: number;
}

/** In số tiền kèm ký hiệu, VD `45.000đ`. */
export interface CurrencyFormat {
  readonly type: 'currency';

  /** Ký hiệu tiền tệ; mặc định `đ`. */
  readonly symbol?: CurrencySymbol;

  /** Số chữ số thập phân; mặc định 0. */
  readonly decimals?: number;
}

/** In ngày giờ theo pattern. */
export interface DateTimeFormat {
  readonly type: 'datetime';

  /** Pattern gồm các token `dd`, `MM`, `yyyy`, `yy`, `HH`, `mm`, `ss`; ký tự khác giữ nguyên. */
  readonly pattern: string;
}

/** In chuỗi, có thể đổi hoa/thường và cắt ngắn. */
export interface TextFormat {
  readonly type: 'text';

  /** Đổi chữ hoa/thường; bỏ trống là giữ nguyên. */
  readonly transform?: 'upper' | 'lower';

  /** Số ký tự tối đa, cắt phần thừa; bỏ trống là không giới hạn. */
  readonly maxLength?: number;
}

/** Cách hiển thị giá trị của 1 biến; bỏ trống thì dùng format mặc định theo kiểu biến. */
export type ValueFormat = NumberFormat | CurrencyFormat | DateTimeFormat | TextFormat;
