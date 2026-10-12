import React from 'react';
import { View } from 'react-native';
import { formatCurrency } from '../../../utils/formatCurrency';
import { basePriceOf, lineTotalOf, toppingTextOf, type PrintItem } from '../models/templates/PrintItem';
import {
  grandTotalOf,
  subtotalOf,
  totalQuantityOf,
  type ReceiptContent,
} from '../models/templates/ReceiptContent';
import type { ReceiptTemplateOptions } from '../models/templates/ReceiptTemplateOptions';
import { DEFAULT_RECEIPT_TEMPLATE } from './TemplateDefaults';
import { PrintDivider, PrintRow, PrintText, paddingStyleOf } from './PrintLayout';

type Lines = React.ReactElement[];

/** Một phần của hoá đơn, giữa hai đường kẻ. */
interface ReceiptSection {
  key: string;

  lines: Lines;
}

const STORE_SECTION_KEY = 'store';

const storeLines = (content: ReceiptContent, options: ReceiptTemplateOptions): Lines => {
  const { fontSize } = options;
  const lines: Lines = [];

  if (options.showStoreName && content.storeName) {
    lines.push(<PrintText key="name" size={fontSize.storeName} bold center>{content.storeName}</PrintText>);
  }

  if (options.showAddress && content.storeAddress) {
    lines.push(<PrintText key="address" size={fontSize.storeInfo} center>{content.storeAddress}</PrintText>);
  }

  return lines;
};

const orderLines = (content: ReceiptContent, options: ReceiptTemplateOptions): Lines => {
  const size = options.fontSize.orderInfo;
  const lines: Lines = [
    <PrintText key="title" size={options.fontSize.title} bold center>HOÁ ĐƠN BÁN HÀNG</PrintText>,
  ];

  if (options.showOrderNumber) {
    lines.push(<PrintRow key="number" label="Mã đơn" value={`#${content.orderNumber}`} size={size} />);
  }

  if (options.showTime && content.time) {
    lines.push(<PrintRow key="time" label="Thời gian" value={content.time} size={size} />);
  }

  if (options.showServiceType && content.serviceType) {
    lines.push(<PrintRow key="service" label="Hình thức" value={content.serviceType} size={size} />);
  }

  return lines;
};

/** Tắt dòng "số lượng × đơn giá" thì số lượng ghi trước tên món để không mất thông tin. */
const itemNameOf = (item: PrintItem, options: ReceiptTemplateOptions): string =>
  options.showUnitPrice || item.quantity === 1 ? item.name : `${item.quantity}x ${item.name}`;

/** Giá dòng topping là tiền topping của cả số lượng món, để các dòng phụ cộng lại đúng thành tiền. */
const toppingLines = (item: PrintItem, key: string, size: number): Lines =>
  item.toppings.map((topping, index) => {
    const amount = topping.price * topping.quantity * item.quantity;
    const value = amount > 0 ? formatCurrency(amount) : undefined;
    const label = `+ ${toppingTextOf(topping)}`;
    return <PrintRow key={`${key}-topping-${index}`} label={label} value={value} size={size} indent />;
  });

const itemLines = (item: PrintItem, key: string, options: ReceiptTemplateOptions): Lines => {
  const { itemName, itemDetail } = options.fontSize;
  const totalText = formatCurrency(lineTotalOf(item));
  const lines: Lines = [
    <PrintRow key={key} label={itemNameOf(item, options)} value={totalText} size={itemName} bold />,
  ];

  if (options.showUnitPrice) {
    const unitText = `${item.quantity} x ${formatCurrency(basePriceOf(item))}`;
    lines.push(<PrintText key={`${key}-unit`} size={itemDetail} indent>{unitText}</PrintText>);
  }

  if (options.showItemOptions && item.attributes.length > 0) {
    const attributeText = item.attributes.join(', ');
    lines.push(<PrintText key={`${key}-attributes`} size={itemDetail} indent>{attributeText}</PrintText>);
  }

  if (options.showItemOptions) {
    lines.push(...toppingLines(item, key, itemDetail));
  }

  if (options.showItemNote && item.note) {
    lines.push(<PrintText key={`${key}-note`} size={itemDetail} indent>{`Ghi chú: ${item.note}`}</PrintText>);
  }

  return lines;
};

const totalLines = (content: ReceiptContent, options: ReceiptTemplateOptions): Lines => {
  const size = options.fontSize.totals;
  const showDiscount = options.showDiscount && content.discountAmount > 0;
  const showDeliveryFee = options.showDeliveryFee && content.deliveryFee > 0;
  const lines: Lines = [];

  if (options.showTotalQuantity) {
    lines.push(<PrintRow key="quantity" label="Tổng số lượng" value={String(totalQuantityOf(content))} size={size} />);
  }

  if (options.showSubtotal) {
    lines.push(<PrintRow key="subtotal" label="Tạm tính" value={formatCurrency(subtotalOf(content))} size={size} />);
  }

  if (showDiscount) {
    const discountText = `-${formatCurrency(content.discountAmount)}`;
    lines.push(<PrintRow key="discount" label="Giảm giá" value={discountText} size={size} />);
  }

  if (showDeliveryFee) {
    const deliveryFeeText = formatCurrency(content.deliveryFee);
    lines.push(<PrintRow key="delivery" label="Phí giao hàng" value={deliveryFeeText} size={size} />);
  }

  const grandTotalText = formatCurrency(grandTotalOf(content));
  lines.push(<PrintRow key="total" label="TỔNG CỘNG" value={grandTotalText} size={options.fontSize.grandTotal} bold />);
  return lines;
};

const paymentLines = (content: ReceiptContent, options: ReceiptTemplateOptions): Lines => {
  const { payment } = content;
  const size = options.fontSize.payment;

  if (!payment) {
    return [];
  }

  const lines: Lines = [];

  if (options.showPaymentMethod) {
    lines.push(<PrintRow key="method" label="Thanh toán" value={payment.methodName} size={size} />);
  }

  const { amountReceived, changeAmount } = payment;
  const hasCashChange = amountReceived !== null && changeAmount !== null;

  if (options.showCashChange && hasCashChange) {
    lines.push(<PrintRow key="received" label="Tiền nhận" value={formatCurrency(amountReceived)} size={size} />);
    lines.push(<PrintRow key="change" label="Tiền thừa" value={formatCurrency(changeAmount)} size={size} />);
  }

  return lines;
};

const footerLines = (options: ReceiptTemplateOptions): Lines =>
  options.footerText
    ? [<PrintText key="footer" size={options.fontSize.footer} bold center>{options.footerText}</PrintText>]
    : [];

/** Phần trống thì bỏ luôn cả đường kẻ của nó. */
const sectionsOf = (content: ReceiptContent, options: ReceiptTemplateOptions): ReceiptSection[] =>
  [
    { key: STORE_SECTION_KEY, lines: storeLines(content, options) },
    { key: 'order', lines: orderLines(content, options) },
    { key: 'items', lines: content.items.flatMap((item, index) => itemLines(item, `item-${index}`, options)) },
    { key: 'totals', lines: totalLines(content, options) },
    { key: 'payment', lines: paymentLines(content, options) },
    { key: 'footer', lines: footerLines(options) },
  ].filter((section) => section.lines.length > 0);

/** Thuộc tính của mẫu hoá đơn. */
interface ReceiptTemplateProps {
  content: ReceiptContent;

  options?: ReceiptTemplateOptions;
}

/** Hoá đơn khách hàng để chụp thành ảnh in; rộng theo khung chụp (bề rộng vùng in của giấy). */
export const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({ content, options = DEFAULT_RECEIPT_TEMPLATE }) => {
  const sections = sectionsOf(content, options);

  return (
    <View style={[paddingStyleOf(options.padding), { gap: options.sectionGap }]}>
      {sections.map((section, index) => (
        <React.Fragment key={section.key}>
          {index > 0 ? <PrintDivider dashed={sections[index - 1].key !== STORE_SECTION_KEY} /> : null}
          <View style={{ gap: options.lineGap }}>{section.lines}</View>
        </React.Fragment>
      ))}
    </View>
  );
};
