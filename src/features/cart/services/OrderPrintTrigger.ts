import { createElement } from 'react';
import { printService } from '../../printer/printing/PrintService';
import { PrintStatus } from '../../printer/models/printing/PrintStatus';
import type { PrintResult } from '../../printer/models/printing/PrintResult';
import { PrintKind } from '../../printer/models/printer/PrintKind';
import { labelPagesOf, type LabelContent } from '../../printer/models/templates/LabelContent';
import type { PrintItem, PrintTopping } from '../../printer/models/templates/PrintItem';
import type { ReceiptContent, ReceiptPayment } from '../../printer/models/templates/ReceiptContent';
import { DEFAULT_LABEL_TEMPLATE, LabelTemplate, ReceiptTemplate } from '../../printer/templates';
import type { CaptureImage } from '../../printer/hooks/usePrintImageCapture';
import { LoggerService } from '../../../services/LoggerService';
import { formatDateTime, formatTime, PAYMENT_METHOD_LABEL } from '../utils/billFormat';
import { SERVICE_TYPE_LABELS } from '../types/cart.types';
import type { CartItem, CreateOrderResponse, OrderDetail, OrderDetailItem, ServiceType } from '../types/cart.types';
import type { StoreViewModel } from '../../store/types/store.types';

/** Một option đã chọn, rút gọn về những gì bản in cần. */
interface SelectedOption {
  name: string;

  price: number;
}

const isServiceType = (value: string): value is ServiceType => value in SERVICE_TYPE_LABELS;

/** `ServiceType` từ API chưa được kiểm tra nên giá trị lạ in nguyên chuỗi gốc thay vì "undefined". */
const serviceTypeNameOf = (value: string): string => (isServiceType(value) ? SERVICE_TYPE_LABELS[value] : value);

/** Chọn cùng một topping nhiều lần thành một dòng "x2". */
const toppingsOf = (options: SelectedOption[]): PrintTopping[] => {
  const byName = new Map<string, PrintTopping>();

  for (const option of options) {
    const topping = byName.get(option.name);

    if (topping) {
      topping.quantity += 1;
      continue;
    }

    byName.set(option.name, { name: option.name, quantity: 1, price: option.price });
  }

  return [...byName.values()];
};

/** Option thuộc nhóm chọn-nhiều là topping; nhóm chọn-một (size, đường, đá) là thuộc tính. */
const toppingOptionIdsOf = (item: CartItem): Set<number> =>
  new Set(
    item.optionGroups
      .filter((group) => group.uiType === 'MultiSelect')
      .flatMap((group) => group.options.map((option) => option.id)),
  );

const toPrintItem = (item: CartItem): PrintItem => {
  const toppingIds = toppingOptionIdsOf(item);
  const attributes = item.options.filter((option) => !toppingIds.has(option.optionId));
  const toppings = item.options.filter((option) => toppingIds.has(option.optionId));

  return {
    name: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    attributes: attributes.map((option) => option.optionName),
    toppings: toppingsOf(toppings.map((option) => ({ name: option.optionName, price: option.price }))),
    note: item.note.trim() || null,
  };
};

/**
 * Đơn đã lưu không còn kiểu nhóm option nên option có giá coi là topping (topping luôn tính tiền, size/đường/đá thường
 * miễn phí); size có phụ thu vì thế in thành một dòng topping.
 */
const toReprintItem = (item: OrderDetailItem): PrintItem => {
  const attributes = item.Options.filter((option) => option.Price <= 0);
  const toppings = item.Options.filter((option) => option.Price > 0);

  return {
    name: item.ProductName,
    quantity: item.Quantity,
    unitPrice: item.UnitPrice,
    attributes: attributes.map((option) => option.OptionName),
    toppings: toppingsOf(toppings.map((option) => ({ name: option.OptionName, price: option.Price }))),
    note: item.Note,
  };
};

/** Phần cửa hàng của hoá đơn; cửa hàng chưa có số điện thoại. */
const storeOf = (
  store: StoreViewModel | null,
): Pick<ReceiptContent, 'logoUri' | 'storeName' | 'storeAddress' | 'storePhone'> => ({
  logoUri: store?.logoUrl ?? null,
  storeName: store?.name ?? null,
  storeAddress: store?.address ?? null,
  storePhone: null,
});

/** Dữ liệu hoá đơn app chưa thu thập; mẫu bỏ qua dòng tương ứng dù tuỳ chọn đang bật. */
const MISSING_ORDER_DETAILS: Pick<ReceiptContent, 'table' | 'cashierName' | 'vat' | 'wifi' | 'paymentQr'> = {
  table: null,
  cashierName: null,
  vat: null,
  wifi: null,
  paymentQr: null,
};

/** Tiền nhận và tiền thừa chỉ có nghĩa khi trả tiền mặt. */
const toReceiptPayment = (order: OrderDetail): ReceiptPayment | null => {
  const { PaymentMethod: method } = order;

  if (!method) {
    return null;
  }

  const isCash = method === 'Cash';
  return {
    methodName: PAYMENT_METHOD_LABEL[method] ?? method,
    amountReceived: isCash ? order.AmountReceived : null,
    changeAmount: isCash ? order.ChangeAmount : null,
  };
};

/**
 * Hoá đơn lúc thanh toán. Giảm giá, phí giao hàng, phương thức thanh toán chưa có UI thu thập nên luôn trống; số điện
 * thoại, bàn, thu ngân, VAT, Wi-Fi, QR chuyển khoản app chưa có dữ liệu.
 */
export const buildReceipt = (
  orderResponse: CreateOrderResponse,
  items: CartItem[],
  serviceType: ServiceType,
  store: StoreViewModel | null,
): ReceiptContent => ({
  ...storeOf(store),
  orderNumber: orderResponse.OrderNumber,
  time: formatDateTime(orderResponse.CreatedAt),
  serviceType: SERVICE_TYPE_LABELS[serviceType],
  ...MISSING_ORDER_DETAILS,
  items: items.map(toPrintItem),
  discountAmount: 0,
  deliveryFee: 0,
  payment: null,
  orderBarcode: orderResponse.OrderNumber,
});

/** Hoá đơn in lại từ đơn đã đặt, thêm "(In lại)" để phân biệt với hoá đơn gốc. */
export const buildReprintReceipt = (order: OrderDetail, store: StoreViewModel | null): ReceiptContent => ({
  ...storeOf(store),
  orderNumber: `${order.OrderNumber} (In lại)`,
  time: formatDateTime(order.CreatedAt),
  serviceType: serviceTypeNameOf(order.ServiceType),
  ...MISSING_ORDER_DETAILS,
  items: order.Items.map(toReprintItem),
  discountAmount: order.DiscountAmount,
  deliveryFee: order.DeliveryFee,
  payment: toReceiptPayment(order),
  orderBarcode: order.OrderNumber,
});

/** Tem lúc thanh toán; mỗi phần món một ly. */
export const buildLabels = (
  orderResponse: CreateOrderResponse,
  items: CartItem[],
  serviceType: ServiceType,
  store: StoreViewModel | null,
): LabelContent => ({
  storeName: store?.name ?? null,
  customerName: null,
  orderNumber: orderResponse.OrderNumber,
  serviceType: SERVICE_TYPE_LABELS[serviceType],
  time: formatTime(orderResponse.CreatedAt),
  items: items.map(toPrintItem),
});

export type PrintOutcome = 'ok' | 'no-printer' | 'failed';

/** Kết quả in một đơn lúc thanh toán. */
export interface OrderPrintOutcome {
  receipt: PrintOutcome;

  labels: PrintOutcome;
}

/** Lỗi in chỉ ghi log, người gọi quyết định có báo cho thu ngân hay không. */
const outcomeOf = (result: PrintResult, contentName: string): PrintOutcome => {
  if (result.status === PrintStatus.NoAvailablePrinter) return 'no-printer';
  if (result.status === PrintStatus.Success) return 'ok';

  const reason = result.error ? ` (${result.error.message})` : '';
  LoggerService.warning(`In ${contentName} không thành công: ${result.status}${reason}`);
  return 'failed';
};

/**
 * In hoá đơn kiểu "fire-and-forget": không bao giờ reject, mọi lỗi chỉ ghi log để `submit()` phía trên không bị ảnh
 * hưởng. `PrintService` chỉ chụp hoá đơn khi có máy in hoá đơn, mỗi khổ giấy một lần.
 */
export const printReceipt = async (content: ReceiptContent, captureImage: CaptureImage): Promise<PrintOutcome> => {
  try {
    const element = createElement(ReceiptTemplate, { content });
    const result = await printService.print(PrintKind.Receipt, (paper) => captureImage(element, paper));
    return outcomeOf(result, 'hoá đơn');
  } catch (err) {
    LoggerService.warning(`In hoá đơn thất bại: ${String(err)}`);
    return 'failed';
  }
};

/**
 * Mỗi con tem một lệnh in vì máy in tem chỉ nhận ảnh cao tối đa một con tem. Không có máy in tem, hoặc mọi máy in tem
 * đều lỗi, thì dừng luôn thay vì chờ lỗi lặp lại cho từng tem. Không bao giờ reject.
 */
export const printLabels = async (content: LabelContent, captureImage: CaptureImage): Promise<PrintOutcome> => {
  let outcome: PrintOutcome = 'ok';

  try {
    for (const page of labelPagesOf(content, DEFAULT_LABEL_TEMPLATE)) {
      const result = await printService.print(PrintKind.Label, (paper) =>
        captureImage(createElement(LabelTemplate, { content, page, paper }), paper),
      );
      const pageOutcome = outcomeOf(result, 'tem');
      const shouldStop = pageOutcome === 'no-printer' || result.status === PrintStatus.Failed;

      if (shouldStop) return pageOutcome;
      if (pageOutcome === 'failed') outcome = 'failed';
    }

    return outcome;
  } catch (err) {
    LoggerService.warning(`In tem thất bại: ${String(err)}`);
    return 'failed';
  }
};

/** In hoá đơn rồi mới in tem: chỉ có một khung chụp nên hai việc chụp không được chạy cùng lúc. */
export const printOrder = async (
  receipt: ReceiptContent,
  labels: LabelContent,
  captureImage: CaptureImage,
): Promise<OrderPrintOutcome> => {
  const receiptOutcome = await printReceipt(receipt, captureImage);
  const labelsOutcome = await printLabels(labels, captureImage);
  return { receipt: receiptOutcome, labels: labelsOutcome };
};
