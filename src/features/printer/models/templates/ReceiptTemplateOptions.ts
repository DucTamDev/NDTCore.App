import type { PrintPadding } from './PrintPadding';

/** Cỡ chữ từng phần của hoá đơn (dot; 24 ≈ chữ cao 3mm). */
export interface ReceiptFontSizes {
  storeName: number;

  /** Địa chỉ cửa hàng. */
  storeInfo: number;

  /** Dòng "HOÁ ĐƠN BÁN HÀNG". */
  title: number;

  /** Mã đơn, thời gian, hình thức. */
  orderInfo: number;

  itemName: number;

  /** Dòng phụ của món: số lượng × đơn giá, tuỳ chọn, topping, ghi chú. */
  itemDetail: number;

  /** Tổng số lượng, tạm tính, giảm giá, phí giao. */
  totals: number;

  grandTotal: number;

  payment: number;

  footer: number;
}

/** Phần hiển thị của hoá đơn; khổ giấy và cắt giấy thuộc máy in. */
export interface ReceiptTemplateOptions {
  fontSize: ReceiptFontSizes;

  padding: PrintPadding;

  /** Khoảng cách giữa các phần: đầu bill, thông tin đơn, món, tổng, thanh toán (dot). */
  sectionGap: number;

  /** Khoảng cách giữa các dòng trong một phần (dot). */
  lineGap: number;

  /** Logo ở đầu bill; ảnh màu in qua ngưỡng đen trắng nên nên dùng logo nét đơn sắc. */
  showLogo: boolean;

  showStoreName: boolean;

  showAddress: boolean;

  showPhone: boolean;

  showOrderNumber: boolean;

  showTime: boolean;

  showServiceType: boolean;

  showTable: boolean;

  showCashier: boolean;

  /** Dòng thuộc tính (size, đường, đá) và các dòng topping dưới mỗi món. */
  showItemOptions: boolean;

  showItemNote: boolean;

  /** Dòng "số lượng × đơn giá"; tắt thì số lượng ghi trước tên món ("2x Cà phê"). */
  showUnitPrice: boolean;

  showTotalQuantity: boolean;

  showSubtotal: boolean;

  /** Chỉ in khi đơn có giảm giá. */
  showDiscount: boolean;

  /** Chỉ in khi đơn có phí giao hàng. */
  showDeliveryFee: boolean;

  /** Dòng VAT; tiền VAT luôn cộng vào tổng cộng dù dòng này tắt. */
  showVat: boolean;

  showPaymentMethod: boolean;

  /** Tiền nhận và tiền thừa; chỉ in khi nội dung có đủ hai số này (trả tiền mặt). */
  showCashChange: boolean;

  /** Tên và mật khẩu Wi-Fi ở chân bill. */
  showWifi: boolean;

  /** Mã QR chuyển khoản ở chân bill. */
  showPaymentQr: boolean;

  /** Mã vạch CODE128 của đơn ở chân bill. */
  showOrderBarcode: boolean;

  /** Lời cảm ơn cuối bill; chuỗi rỗng thì không in. */
  footerText: string;
}
