import { lineTotalOf, type PrintItem } from './PrintItem';

/** Phần thanh toán của hoá đơn. */
export interface ReceiptPayment {
  /** Tên phương thức đã dịch sẵn (vd "Tiền mặt"). */
  methodName: string;

  /** Chỉ có khi trả tiền mặt; thiếu một trong hai số thì không in tiền nhận/tiền thừa. */
  amountReceived: number | null;

  changeAmount: number | null;
}

/** Thuế VAT của đơn. */
export interface ReceiptVat {
  /** Thuế suất (%), in trong nhãn "VAT 8%". */
  ratePercent: number;

  /** Tiền VAT, cộng vào tổng cộng. */
  amount: number;
}

/** Wi-Fi cho khách in ở chân bill. */
export interface ReceiptWifi {
  ssid: string;

  password: string;
}

/** Dữ liệu một hoá đơn cần in; chữ đã định dạng sẵn, mẫu chỉ sắp xếp và tính tổng. */
export interface ReceiptContent {
  /** URI ảnh logo cửa hàng. */
  logoUri: string | null;

  storeName: string | null;

  storeAddress: string | null;

  storePhone: string | null;

  /** Mã đơn in sau dấu "#", có thể kèm ghi chú như "(In lại)". */
  orderNumber: string;

  /** Thời gian đặt đơn đã định dạng. */
  time: string;

  /** Tên hình thức phục vụ đã dịch sẵn (vd "Mang đi"). */
  serviceType: string | null;

  /** Số bàn khi ăn tại quán. */
  table: string | null;

  cashierName: string | null;

  items: PrintItem[];

  discountAmount: number;

  deliveryFee: number;

  /** `null` khi đơn không tính VAT. */
  vat: ReceiptVat | null;

  /** `null` thì hoá đơn không có phần thanh toán. */
  payment: ReceiptPayment | null;

  wifi: ReceiptWifi | null;

  /** Nội dung mã QR chuyển khoản (chuỗi VietQR); `null` thì không in QR. */
  paymentQr: string | null;

  /** Giá trị mã vạch của đơn, thường là mã đơn gốc; chỉ nhận ký tự ASCII (giới hạn của CODE128). */
  orderBarcode: string | null;
}

export const totalQuantityOf = (content: ReceiptContent): number =>
  content.items.reduce((sum, item) => sum + item.quantity, 0);

export const subtotalOf = (content: ReceiptContent): number =>
  content.items.reduce((sum, item) => sum + lineTotalOf(item), 0);

export const grandTotalOf = (content: ReceiptContent): number =>
  subtotalOf(content) - content.discountAmount + content.deliveryFee + (content.vat?.amount ?? 0);
