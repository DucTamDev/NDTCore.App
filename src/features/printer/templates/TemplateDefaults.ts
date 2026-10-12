import { FontSizePreset, scaleFontSizes } from '../models/templates/FontSizePreset';
import type { LabelFontSizes, LabelTemplateOptions } from '../models/templates/LabelTemplateOptions';
import type { ReceiptFontSizes, ReceiptTemplateOptions } from '../models/templates/ReceiptTemplateOptions';

/** Cỡ chữ hoá đơn mức `Normal`; nhỏ nhất ở mức `Small` là 14 dot, còn đọc được dấu tiếng Việt trên giấy nhiệt. */
export const NORMAL_RECEIPT_FONT_SIZES: ReceiptFontSizes = {
  storeName: 27,
  storeInfo: 19,
  title: 22,
  orderInfo: 19,
  itemName: 20,
  itemDetail: 17,
  totals: 19,
  grandTotal: 26,
  payment: 19,
  footer: 19,
};

/** Cỡ chữ tem mức `Normal`, vừa tem 40×30mm với 5 dòng topping. */
export const NORMAL_LABEL_FONT_SIZES: LabelFontSizes = {
  header: 15,
  itemName: 15,
  attributes: 12,
  toppings: 12,
  note: 12,
  footer: 15,
};

export const DEFAULT_RECEIPT_TEMPLATE: ReceiptTemplateOptions = {
  fontSize: scaleFontSizes(NORMAL_RECEIPT_FONT_SIZES, FontSizePreset.Small),
  padding: { top: 16, right: 10, bottom: 40, left: 10 },
  sectionGap: 10,
  lineGap: 5,
  showStoreName: true,
  showAddress: true,
  showOrderNumber: true,
  showTime: true,
  showServiceType: true,
  showItemOptions: true,
  showItemNote: true,
  showUnitPrice: true,
  showTotalQuantity: true,
  showSubtotal: true,
  showDiscount: true,
  showDeliveryFee: true,
  showPaymentMethod: true,
  showCashChange: true,
  footerText: 'Cảm ơn quý khách! Hẹn gặp lại',
};

export const DEFAULT_LABEL_TEMPLATE: LabelTemplateOptions = {
  fontSize: { ...NORMAL_LABEL_FONT_SIZES },
  padding: { top: 10, right: 10, bottom: 10, left: 10 },
  lineGap: 4,
  maxToppingsPerLabel: 5,
  showOrderNumber: true,
  showServiceType: false,
  showCupIndex: true,
  showAttributes: true,
  showToppings: true,
  showItemNote: true,
  showPrice: true,
  showStoreName: false,
  showTime: false,
};
