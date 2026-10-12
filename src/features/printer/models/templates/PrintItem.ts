/** Một loại topping của món. */
export interface PrintTopping {
  name: string;

  /** Số phần topping trong một món, ít nhất 1. */
  quantity: number;

  /** Giá một phần topping; 0 thì không in giá. */
  price: number;
}

/** Một món trên hoá đơn hoặc tem. */
export interface PrintItem {
  name: string;

  quantity: number;

  /** Đơn giá một món, đã gồm mọi tuỳ chọn và topping. */
  unitPrice: number;

  /** Tuỳ chọn chọn-một như size, đường, đá; đã gồm phụ thu nếu có. */
  attributes: string[];

  toppings: PrintTopping[];

  note: string | null;
}

/** Số lượng chỉ ghi khi từ 2 trở lên, cùng dòng với tên để không tốn thêm dòng. */
export const toppingTextOf = (topping: PrintTopping): string =>
  topping.quantity > 1 ? `${topping.name} x${topping.quantity}` : topping.name;

/** Tiền topping của một món. */
const toppingAmountOf = (item: PrintItem): number =>
  item.toppings.reduce((sum, topping) => sum + topping.price * topping.quantity, 0);

/** Đơn giá trước topping: hoá đơn in dòng "số lượng × giá này" rồi từng dòng topping, cộng lại đúng thành tiền. */
export const basePriceOf = (item: PrintItem): number => item.unitPrice - toppingAmountOf(item);

export const lineTotalOf = (item: PrintItem): number => item.unitPrice * item.quantity;
