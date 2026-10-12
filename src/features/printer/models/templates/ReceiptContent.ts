import { lineTotalOf, type PrintItem } from './PrintItem';

/** Phần thanh toán của hoá đơn. */
export interface ReceiptPayment {
  /** Tên phương thức đã dịch sẵn (vd "Tiền mặt"). */
  methodName: string;

  /** Chỉ có khi trả tiền mặt; thiếu một trong hai số thì không in tiền nhận/tiền thừa. */
  amountReceived: number | null;

  changeAmount: number | null;
}

/** Dữ liệu một hoá đơn cần in; chữ đã định dạng sẵn, mẫu chỉ sắp xếp và tính tổng. */
export interface ReceiptContent {
  storeName: string | null;

  storeAddress: string | null;

  /** Mã đơn in sau dấu "#", có thể kèm ghi chú như "(In lại)". */
  orderNumber: string;

  /** Thời gian đặt đơn đã định dạng. */
  time: string;

  /** Tên hình thức phục vụ đã dịch sẵn (vd "Mang đi"). */
  serviceType: string | null;

  items: PrintItem[];

  discountAmount: number;

  deliveryFee: number;

  /** `null` thì hoá đơn không có phần thanh toán. */
  payment: ReceiptPayment | null;
}

export const totalQuantityOf = (content: ReceiptContent): number =>
  content.items.reduce((sum, item) => sum + item.quantity, 0);

export const subtotalOf = (content: ReceiptContent): number =>
  content.items.reduce((sum, item) => sum + lineTotalOf(item), 0);

export const grandTotalOf = (content: ReceiptContent): number =>
  subtotalOf(content) - content.discountAmount + content.deliveryFee;
