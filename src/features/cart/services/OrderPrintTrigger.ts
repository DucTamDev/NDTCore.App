import { PrintService, type PrintDocumentVariants } from '../../printer/printing/PrintService';
import { LoggerService } from '../../../services/LoggerService';
import { formatCurrency } from '../../../utils/formatCurrency';
import { formatDateTime, PAYMENT_METHOD_LABEL } from '../utils/billFormat';
import { SERVICE_TYPE_LABELS } from '../types/cart.types';
import type { CartItem, CreateOrderResponse, OrderDetail, ServiceType } from '../types/cart.types';
import type { StoreViewModel } from '../../store/types/store.types';
import type { PrintDocument, PrintElement } from '../../printer/types/printDocument.types';
import type { PrintType } from '../../printer/types/printConfiguration.types';
import type { PaperSize } from '../../printer/types/printer.types';

interface BillItem {
  name: string;
  quantity: number;
  unitPrice: number;
  note: string | null;
}

const isServiceType = (value: string): value is ServiceType => value in SERVICE_TYPE_LABELS;

interface BillHeaderRow {
  left: string;
  right: string;
}

/**
 * `Omit<PrintElement, 'x' | 'y'>` không dùng được trực tiếp — `PrintElement`
 * là union, `Omit` chỉ giữ lại field CHUNG giữa mọi nhánh (chỉ `type`), làm
 * mất hết `content`/`left`/`right`/... riêng của từng loại. Distribute qua
 * từng nhánh (`T extends unknown ? ... : never`) để giữ đúng field riêng.
 */
type PositionlessElement<T> = T extends unknown ? Omit<T, 'x' | 'y'> : never;

/**
 * Dựng toàn bộ nội dung bill, dùng chung cho cả bill lúc thanh toán
 * (`buildReceiptDocument`) và bill in lại từ lịch sử (`buildReprintDocument`)
 * — 2 nguồn dữ liệu khác shape nhau (`CartItem[]` vs `OrderDetailItem[]`) nên
 * mỗi hàm public tự chuẩn hoá input thành `BillItem[]`/`BillHeaderRow[]`
 * trước khi gọi hàm này, tránh viết lặp logic tính dòng/tổng tiền ở 2 nơi.
 */
const buildBillElements = (
  store: StoreViewModel | null,
  headerRows: BillHeaderRow[],
  items: BillItem[],
  discountAmount: number,
  deliveryFee: number,
  paymentMethod: string | null,
  amountReceived: number | null,
  changeAmount: number | null,
): PrintElement[] => {
  const elements: PrintElement[] = [];
  let y = 0;
  const push = (element: PositionlessElement<PrintElement>): void => {
    elements.push({ ...element, x: 0, y } as PrintElement);
    y += 20;
  };

  if (store?.name) push({ type: 'text', content: store.name });
  if (store?.address) push({ type: 'text', content: store.address });

  push({ type: 'line' });
  for (const row of headerRows) push({ type: 'row', left: row.left, right: row.right });

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const total = subtotal - discountAmount + deliveryFee;

  push({ type: 'line' });
  push({ type: 'text', content: 'SẢN PHẨM' });
  for (const item of items) {
    const label = item.quantity > 1 ? `${item.quantity}x ${item.name}` : item.name;
    push({ type: 'row', left: label, right: formatCurrency(item.unitPrice * item.quantity) });
    if (item.note) push({ type: 'text', content: `  Ghi chú: ${item.note}` });
  }
  push({ type: 'line' });

  push({ type: 'row', left: 'Tổng số lượng', right: String(totalQuantity) });
  push({ type: 'row', left: 'Tạm tính', right: formatCurrency(subtotal) });
  if (discountAmount > 0) push({ type: 'row', left: 'Giảm giá', right: `-${formatCurrency(discountAmount)}` });
  if (deliveryFee > 0) push({ type: 'row', left: 'Phí giao hàng', right: formatCurrency(deliveryFee) });
  push({ type: 'line' });
  push({ type: 'row', left: 'TỔNG THANH TOÁN', right: formatCurrency(total) });

  if (paymentMethod) {
    push({ type: 'row', left: 'Phương thức', right: PAYMENT_METHOD_LABEL[paymentMethod] ?? paymentMethod });
    if (paymentMethod === 'Cash' && amountReceived !== null && changeAmount !== null) {
      push({ type: 'row', left: 'Số tiền nhận', right: formatCurrency(amountReceived) });
      push({ type: 'row', left: 'Tiền thừa', right: formatCurrency(changeAmount) });
    }
  }

  push({ type: 'line' });
  push({ type: 'text', content: 'Cảm ơn quý khách! Hẹn gặp lại lần sau' });

  return elements;
};

export const buildReceiptDocument = (
  orderResponse: CreateOrderResponse,
  items: CartItem[],
  serviceType: ServiceType,
  store: StoreViewModel | null,
): PrintDocument => {
  const headerRows: BillHeaderRow[] = [
    { left: 'Mã đơn', right: `#${orderResponse.OrderNumber}` },
    { left: 'Thời gian', right: formatDateTime(orderResponse.CreatedAt) },
    { left: 'Hình thức', right: SERVICE_TYPE_LABELS[serviceType] },
  ];
  const billItems: BillItem[] = items.map((item) => ({
    name: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    note: item.note.trim() || null,
  }));
  // Discount/phí giao hàng/phương thức thanh toán chưa có UI thu thập ở bước
  // thanh toán hiện tại (CartService.toCreateOrderRequest luôn gửi 0/null) —
  // bill lúc thanh toán vì vậy chưa có các dòng này, khác với bill in lại
  // (buildReprintDocument) vốn đọc thẳng từ OrderDetail đã lưu ở BE.
  return { elements: buildBillElements(store, headerRows, billItems, 0, 0, null, null, null) };
};

/**
 * Dựng lại document in từ một đơn đã đặt trước đó (ví dụ: xem lịch sử đơn
 * hôm nay rồi bấm in lại) — cùng khuôn dạng với buildReceiptDocument, thêm
 * nhãn "(In lại)" để phân biệt với bill gốc lúc thanh toán.
 *
 * order.ServiceType đến thẳng từ API, không được validate — nếu gặp giá trị
 * lạ (dữ liệu cũ, kênh mới chưa có nhãn), in nguyên chuỗi gốc thay vì
 * "undefined" ra giấy thật.
 */
export const buildReprintDocument = (order: OrderDetail, store: StoreViewModel | null): PrintDocument => {
  const serviceTypeLabel = isServiceType(order.ServiceType) ? SERVICE_TYPE_LABELS[order.ServiceType] : order.ServiceType;
  const headerRows: BillHeaderRow[] = [
    { left: 'Mã đơn', right: `#${order.OrderNumber} (In lại)` },
    { left: 'Thời gian', right: formatDateTime(order.CreatedAt) },
    { left: 'Hình thức', right: serviceTypeLabel },
  ];
  const billItems: BillItem[] = order.Items.map((item) => ({
    name: item.ProductName,
    quantity: item.Quantity,
    unitPrice: item.UnitPrice,
    note: item.Note,
  }));
  return {
    elements: buildBillElements(
      store,
      headerRows,
      billItems,
      order.DiscountAmount,
      order.DeliveryFee,
      order.PaymentMethod,
      order.AmountReceived,
      order.ChangeAmount,
    ),
  };
};

export type PrintReceiptOutcome = 'ok' | 'no-printer' | 'failed';

/** Chụp `document` (đã render qua `BillImagePreview`) thành base64 PNG cho khổ giấy cho trước — implement thật ở `useBillImageCapture` (cần React tree nên không thể sống ở tầng service). Trả `null` nếu capture thất bại. */
export type CaptureBillImage = (document: PrintDocument, paperSize: PaperSize) => Promise<string | null>;

/**
 * Chỉ render + chụp ảnh khi thật sự có máy in TSPL được gán cho `printType`
 * (`PrintService.imageDocumentPaperSize`) — capture tốn chi phí (layout +
 * screenshot native), không làm nếu không có máy nào cần tới. Capture thất
 * bại (trả `null`) không chặn in — rơi về `text` cho máy TSPL đó, chấp nhận
 * rủi ro thiếu dấu tiếng Việt còn hơn không in được gì.
 */
const buildPrintDocumentVariants = async (
  printType: PrintType,
  textDocument: PrintDocument,
  captureBillImage: CaptureBillImage,
): Promise<PrintDocumentVariants> => {
  const paperSize = PrintService.imageDocumentPaperSize(printType);
  if (!paperSize) return { text: textDocument };
  const base64 = await captureBillImage(textDocument, paperSize);
  if (!base64) return { text: textDocument };
  return { text: textDocument, image: { elements: [{ type: 'image', data: base64, x: 0, y: 0 }] } };
};

/**
 * Kích hoạt in hoá đơn theo kiểu "fire-and-forget": gửi thẳng document cho
 * toàn bộ đơn tới PrintService. Không bao giờ reject — mọi lỗi đều bị nuốt
 * và ghi log cảnh báo, để submit() phía trên không bị ảnh hưởng.
 *
 * Triggers receipt printing "fire-and-forget": sends the order's documents
 * straight to PrintService. Never rejects — every error is swallowed and
 * logged as a warning, so the calling submit() is unaffected.
 */
export const printReceipt = async (
  textDocument: PrintDocument,
  captureBillImage: CaptureBillImage,
): Promise<PrintReceiptOutcome> => {
  try {
    const documents = await buildPrintDocumentVariants('Receipt', textDocument, captureBillImage);
    const result = await PrintService.print('Receipt', documents);
    if (result.status === 'no-available-printer') return 'no-printer';
    if (result.status === 'failed' || result.status === 'partial-failure') {
      LoggerService.warning(`In hoá đơn không thành công: ${result.status}`);
      return 'failed';
    }
    return 'ok';
  } catch (err) {
    LoggerService.warning(`In hoá đơn thất bại: ${String(err)}`);
    return 'failed';
  }
};
