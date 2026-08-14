import { OrderPrintPlanner } from '../../printer/services/OrderPrintPlanner';
import { PrintService } from '../../printer/services/PrintService';
import { LoggerService } from '../../../services/LoggerService';
import type { CartItem, CreateOrderResponse, ServiceType } from '../types/cart.types';
import type { ProductViewModel } from '../../catalog/types/catalog.types';
import type { Order } from '../../printer/types/order.types';

export const buildOrderFromCart = (
  orderResponse: CreateOrderResponse,
  items: CartItem[],
  serviceType: ServiceType,
  products: ProductViewModel[],
): Order => ({
  id: orderResponse.Id,
  orderNumber: orderResponse.OrderNumber,
  serviceType,
  items: items.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    categoryId: products.find((product) => product.id === item.productId)?.categoryId ?? null,
    quantity: item.quantity,
    note: item.note,
  })),
});

/**
 * Kích hoạt việc in đơn hàng theo kiểu "fire-and-forget": lập kế hoạch in
 * (routing theo destination) rồi gửi từng plan tới `PrintService`. Hàm này
 * không bao giờ reject — mọi lỗi (lập kế hoạch thất bại hoặc in thất bại)
 * đều được nuốt và ghi log cảnh báo, để lời gọi `submit()` phía trên không
 * bị ảnh hưởng bởi kết quả in ấn.
 *
 * Triggers order printing "fire-and-forget": builds print plans (routed by
 * destination) then sends each plan to `PrintService`. This never rejects —
 * every failure (planning or printing) is swallowed and logged as a warning,
 * so the calling `submit()` is unaffected by the printing outcome.
 *
 * @returns Số lượng món không xác định được điểm in (unrouted items count).
 */
export const triggerPrinting = async (order: Order): Promise<number> => {
  let unroutedCount = 0;
  try {
    const { plans, unrouted } = await OrderPrintPlanner.createPlans(order);
    unroutedCount = unrouted.length;
    if (unroutedCount > 0) {
      LoggerService.warning(`Đơn ${order.orderNumber}: ${unroutedCount} món chưa có cấu hình in`);
    }
    await Promise.all(plans.map((plan) => PrintService.print(plan)));
  } catch (err) {
    LoggerService.warning(`Đơn ${order.orderNumber}: in thất bại — ${String(err)}`);
  }
  return unroutedCount;
};
