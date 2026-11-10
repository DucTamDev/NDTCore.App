import { createElement } from 'react';
import { Image } from 'react-native';
import {
  PrinterError,
  PrinterErrorCode,
  PrinterKind,
  printerManager,
  printService,
  type PrintPart,
  type PrintRenderer,
} from '@ndtcore/printer';
import { labelPagesOf, type LabelContent } from '../../printer/models/templates/LabelContent';
import type { PrintItem, PrintTopping } from '../../printer/models/templates/PrintItem';
import type { ReceiptContent, ReceiptPayment } from '../../printer/models/templates/ReceiptContent';
import { DEFAULT_LABEL_TEMPLATE, LabelTemplate, ReceiptTemplate } from '../../printer/templates';
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

/** Tem in lại từ đơn đã đặt; không ghi "(In lại)" vì dòng trên của tem hẹp, thêm chữ đẩy số thứ tự ly xuống dòng. */
export const buildReprintLabels = (order: OrderDetail, store: StoreViewModel | null): LabelContent => ({
  storeName: store?.name ?? null,
  customerName: null,
  orderNumber: order.OrderNumber,
  serviceType: serviceTypeNameOf(order.ServiceType),
  time: formatTime(order.CreatedAt),
  items: order.Items.map(toReprintItem),
});

/** `failed`: lỗi trước khi Job vào hàng; lỗi của máy in đến sau qua sự kiện của package. */
export type PrintOutcome = 'queued' | 'no-printer' | 'failed';

/** Kết quả đưa một đơn vào hàng đợi in. */
export interface OrderPrintOutcome {
  /** Phần hoá đơn. */
  receipt: PrintOutcome;

  /** Phần tem. */
  labels: PrintOutcome;
}

/** Có máy in nhận loại nội dung này không; tính lúc bấm in để cảnh báo ngay. */
const outcomeFor = (kind: PrinterKind): PrintOutcome =>
  printerManager.getPrinters().some((printer) => printer.config.kind === kind) ? 'queued' : 'no-printer';

/** Phần in của Job; bỏ phần không có renderer vì package coi phần rỗng là yêu cầu sai. */
const partsOf = (receipt: ReceiptContent, labels: LabelContent): PrintPart[] => {
  const receiptRenderers: PrintRenderer[] = [() => createElement(ReceiptTemplate, { content: receipt })];
  const labelRenderers: PrintRenderer[] = labelPagesOf(labels, DEFAULT_LABEL_TEMPLATE).map(
    (page) => () => createElement(LabelTemplate, { content: labels, page }),
  );

  return [
    { kind: PrinterKind.Receipt, renderers: receiptRenderers },
    { kind: PrinterKind.Label, renderers: labelRenderers },
  ].filter((part) => part.renderers.length > 0);
};

/** Ảnh tải bất đồng bộ còn khung chụp chụp ngay khi layout xong, nên logo phải có sẵn trong bộ nhớ đệm ảnh. */
const prefetchLogoAsync = async (logoUri: string | null): Promise<void> => {
  if (!logoUri) {
    return;
  }

  try {
    await Image.prefetch(logoUri);
  } catch (err) {
    LoggerService.warning(`Tải sẵn logo để in thất bại: ${String(err)}`);
  }
};

/**
 * Một đơn là một Job: hoá đơn rồi tem, package chụp tuần tự và giữ thứ tự giữa các đơn. Trả về khi Job đã vào hàng,
 * không chờ in xong; không bao giờ reject để `submit()` phía trên không bị ảnh hưởng.
 */
export const printOrderAsync = async (receipt: ReceiptContent, labels: LabelContent): Promise<OrderPrintOutcome> => {
  const outcome: OrderPrintOutcome = {
    receipt: outcomeFor(PrinterKind.Receipt),
    labels: outcomeFor(PrinterKind.Label),
  };

  try {
    await prefetchLogoAsync(receipt.logoUri);
    await printService.printAsync({ title: `Đơn #${receipt.orderNumber}`, parts: partsOf(receipt, labels) });
    return outcome;
  } catch (err) {
    // Không có máy nào nhận phần nào: đã báo bằng no-printer, không phải lỗi in.
    if (err instanceof PrinterError && err.code === PrinterErrorCode.PrinterNotAssigned) {
      return outcome;
    }

    LoggerService.warning(`Đưa đơn vào hàng đợi in thất bại: ${String(err)}`);
    return { receipt: 'failed', labels: 'failed' };
  }
};

/** Cảnh báo biết ngay lúc bấm in; chưa có máy in tem là bình thường nên không cảnh báo. */
export const printWarningOf = (outcome: OrderPrintOutcome): string | null => {
  if (outcome.receipt === 'no-printer') return 'Chưa thiết lập máy in cho Hoá đơn';
  if (outcome.receipt === 'failed') return 'Không chụp được hoá đơn để in';
  if (outcome.labels === 'failed') return 'Không chụp được tem để in';
  return null;
};
