import type { PrintPadding } from './PrintPadding';

/** Cỡ chữ từng phần của tem (dot). */
export interface LabelFontSizes {
  /** Dòng trên: mã đơn, hình thức, số thứ tự ly. */
  header: number;

  itemName: number;

  /** Dòng thuộc tính (size, đường, đá) và giá. */
  attributes: number;

  toppings: number;

  note: number;

  /** Dòng dưới: tên cửa hàng, giờ. */
  footer: number;
}

/**
 * Tem dán ly: mỗi ly ít nhất một tem. Cỡ tem theo giấy của máy in, không tự tăng; ly nhiều topping hơn
 * `maxToppingsPerLabel` thì tách phần còn lại sang tem kế ("tem 2/2" bên phải tên món).
 */
export interface LabelTemplateOptions {
  fontSize: LabelFontSizes;

  padding: PrintPadding;

  /** Khoảng cách giữa các dòng (dot). */
  lineGap: number;

  /**
   * Số dòng topping tối đa trên một tem, ít nhất 1. Topping x2, x3 ghi cùng dòng nên tính theo số loại, không theo
   * tổng số lượng.
   */
  maxToppingsPerLabel: number;

  showOrderNumber: boolean;

  showServiceType: boolean;

  /** "Ly n/N" theo thứ tự ly trong cả đơn. */
  showCupIndex: boolean;

  /** Dòng thuộc tính (size, đường, đá), chỉ ở tem đầu của ly. */
  showAttributes: boolean;

  /** Tắt thì mỗi ly đúng một tem. */
  showToppings: boolean;

  /** Ghi chú món, chỉ ở tem cuối của ly. */
  showItemNote: boolean;

  /** Giá một ly, chỉ ở tem đầu của ly. */
  showPrice: boolean;

  showStoreName: boolean;

  showTime: boolean;
}
