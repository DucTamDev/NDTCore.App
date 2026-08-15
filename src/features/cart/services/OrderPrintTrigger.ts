import { PrintService } from '../../printer/services/PrintService';
import { LoggerService } from '../../../services/LoggerService';
import { SERVICE_TYPE_LABELS } from '../types/cart.types';
import type { CartItem, CreateOrderResponse, ServiceType } from '../types/cart.types';
import type { PrintDocument } from '../../printer/types/printDocument.types';

export const buildReceiptDocument = (
  orderResponse: CreateOrderResponse,
  items: CartItem[],
  serviceType: ServiceType,
): PrintDocument => ({
  elements: [
    { type: 'text', content: `Đơn ${orderResponse.OrderNumber} · ${SERVICE_TYPE_LABELS[serviceType]}`, x: 0, y: 0 },
    { type: 'line', x: 0, y: 20 },
    { type: 'table', rows: items.map((item) => [item.productName, String(item.quantity), item.note]), x: 0, y: 30 },
  ],
});

/**
 * Kích hoạt in hoá đơn theo kiểu "fire-and-forget": gửi thẳng 1 document cho
 * toàn bộ đơn tới PrintService. Không bao giờ reject — mọi lỗi đều bị nuốt
 * và ghi log cảnh báo, để submit() phía trên không bị ảnh hưởng.
 *
 * Triggers receipt printing "fire-and-forget": sends one document for the
 * whole order straight to PrintService. Never rejects — every error is
 * swallowed and logged as a warning, so the calling submit() is unaffected.
 *
 * @returns true nếu chưa thiết lập máy in cho Hoá đơn (no-available-printer).
 */
export const printReceipt = async (document: PrintDocument): Promise<boolean> => {
  try {
    const result = await PrintService.print('Receipt', document);
    if (result.status === 'failed' || result.status === 'partial-failure') {
      LoggerService.warning(`In hoá đơn không thành công: ${result.status}`);
    }
    return result.status === 'no-available-printer';
  } catch (err) {
    LoggerService.warning(`In hoá đơn thất bại: ${String(err)}`);
    return false;
  }
};
