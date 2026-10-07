import { createElement } from 'react';
import { printService } from '../../printer/printing/PrintService';
import { PrintStatus } from '../../printer/models/printing/PrintStatus';
import { PrintKind } from '../../printer/models/printer/PrintKind';
import type { CaptureImage } from '../../printer/hooks/usePrintImageCapture';
import { LoggerService } from '../../../services/LoggerService';
import { formatDateTime } from '../utils/billFormat';
import { ReceiptView } from '../components/ReceiptView';
import { SERVICE_TYPE_LABELS } from '../types/cart.types';
import type { CartItem, CreateOrderResponse, OrderDetail, Receipt, ServiceType } from '../types/cart.types';
import type { StoreViewModel } from '../../store/types/store.types';

const isServiceType = (value: string): value is ServiceType => value in SERVICE_TYPE_LABELS;

/** Bill lúc thanh toán. Giảm giá, phí giao hàng, phương thức thanh toán chưa có UI thu thập nên luôn trống. */
export const buildReceipt = (
  orderResponse: CreateOrderResponse,
  items: CartItem[],
  serviceType: ServiceType,
  store: StoreViewModel | null,
): Receipt => ({
  storeName: store?.name ?? null,
  storeAddress: store?.address ?? null,
  headerRows: [
    { label: 'Mã đơn', value: `#${orderResponse.OrderNumber}` },
    { label: 'Thời gian', value: formatDateTime(orderResponse.CreatedAt) },
    { label: 'Hình thức', value: SERVICE_TYPE_LABELS[serviceType] },
  ],
  items: items.map((item) => ({
    name: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    note: item.note.trim() || null,
  })),
  discountAmount: 0,
  deliveryFee: 0,
  paymentMethod: null,
  amountReceived: null,
  changeAmount: null,
});

/**
 * Bill in lại từ đơn đã đặt, thêm "(In lại)" để phân biệt với bill gốc. `ServiceType` từ API chưa được kiểm tra nên
 * giá trị lạ in nguyên chuỗi gốc thay vì "undefined".
 */
export const buildReprintReceipt = (order: OrderDetail, store: StoreViewModel | null): Receipt => ({
  storeName: store?.name ?? null,
  storeAddress: store?.address ?? null,
  headerRows: [
    { label: 'Mã đơn', value: `#${order.OrderNumber} (In lại)` },
    { label: 'Thời gian', value: formatDateTime(order.CreatedAt) },
    {
      label: 'Hình thức',
      value: isServiceType(order.ServiceType) ? SERVICE_TYPE_LABELS[order.ServiceType] : order.ServiceType,
    },
  ],
  items: order.Items.map((item) => ({
    name: item.ProductName,
    quantity: item.Quantity,
    unitPrice: item.UnitPrice,
    note: item.Note,
  })),
  discountAmount: order.DiscountAmount,
  deliveryFee: order.DeliveryFee,
  paymentMethod: order.PaymentMethod,
  amountReceived: order.AmountReceived,
  changeAmount: order.ChangeAmount,
});

export type PrintReceiptOutcome = 'ok' | 'no-printer' | 'failed';

/**
 * In bill kiểu "fire-and-forget": không bao giờ reject, mọi lỗi chỉ ghi log để `submit()` phía trên không bị ảnh
 * hưởng. `PrintService` chỉ chụp bill khi có máy in hoá đơn, mỗi khổ giấy một lần.
 */
export const printReceipt = async (receipt: Receipt, captureImage: CaptureImage): Promise<PrintReceiptOutcome> => {
  try {
    const content = createElement(ReceiptView, { receipt });
    const result = await printService.print(PrintKind.Receipt, (paper) => captureImage(content, paper));
    if (result.status === PrintStatus.NoAvailablePrinter) return 'no-printer';
    if (result.status === PrintStatus.Failed || result.status === PrintStatus.PartialFailure) {
      const reason = result.error ? ` (${result.error.message})` : '';
      LoggerService.warning(`In hoá đơn không thành công: ${result.status}${reason}`);
      return 'failed';
    }
    return 'ok';
  } catch (err) {
    LoggerService.warning(`In hoá đơn thất bại: ${String(err)}`);
    return 'failed';
  }
};
