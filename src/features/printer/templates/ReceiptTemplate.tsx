import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { usePrintRenderContext } from '@ndtcore/printer';
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
import { PrintDivider, PrintRow, PrintText, usePaddingStyle } from './PrintLayout';
import { PrintBarcode, PrintQrCode } from './PrintCodes';

type Lines = React.ReactElement[];

/** Một phần của hoá đơn, giữa hai đường kẻ. */
interface ReceiptSection {
  key: string;

  lines: Lines;
}

const STORE_SECTION_KEY = 'store';

/** Logo khoảng 12mm. */
const LOGO_SIZE_DOTS = 96;

/** Logo cửa hàng căn giữa, cạnh đo bằng dot chuẩn. */
const PrintLogo: React.FC<{ uri: string }> = ({ uri }) => {
  const { toDp } = usePrintRenderContext();
  const size = toDp(LOGO_SIZE_DOTS);

  return <Image source={{ uri }} style={[styles.logo, { width: size, height: size }]} resizeMode="contain" />;
};

const storeLines = (content: ReceiptContent, options: ReceiptTemplateOptions): Lines => {
  const { fontSize } = options;
  const lines: Lines = [];

  // Ảnh tải bất đồng bộ còn khung chụp chụp ngay khi layout xong, nên logo phải có sẵn trong bộ nhớ đệm ảnh mới
  // chắc chắn hiện trên bản in.
  if (options.showLogo && content.logoUri) {
    lines.push(<PrintLogo key="logo" uri={content.logoUri} />);
  }

  if (options.showStoreName && content.storeName) {
    lines.push(<PrintText key="name" size={fontSize.storeName} bold center>{content.storeName}</PrintText>);
  }

  if (options.showAddress && content.storeAddress) {
    lines.push(<PrintText key="address" size={fontSize.storeInfo} center>{content.storeAddress}</PrintText>);
  }

  if (options.showPhone && content.storePhone) {
    lines.push(<PrintText key="phone" size={fontSize.storeInfo} center>{`ĐT: ${content.storePhone}`}</PrintText>);
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

  if (options.showTable && content.table) {
    lines.push(<PrintRow key="table" label="Bàn" value={content.table} size={size} />);
  }

  if (options.showCashier && content.cashierName) {
    lines.push(<PrintRow key="cashier" label="Thu ngân" value={content.cashierName} size={size} />);
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

  if (options.showVat && content.vat) {
    const vatLabel = `VAT ${content.vat.ratePercent}%`;
    lines.push(<PrintRow key="vat" label={vatLabel} value={formatCurrency(content.vat.amount)} size={size} />);
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

const footerLines = (content: ReceiptContent, options: ReceiptTemplateOptions): Lines => {
  const size = options.fontSize.footer;
  const { wifi, paymentQr, orderBarcode } = content;
  const lines: Lines = [];

  if (options.showWifi && wifi) {
    lines.push(<PrintText key="wifi" size={size} center>{`Wi-Fi: ${wifi.ssid}`}</PrintText>);
    lines.push(<PrintText key="wifi-password" size={size} center>{`Mật khẩu: ${wifi.password}`}</PrintText>);
  }

  if (options.showPaymentQr && paymentQr) {
    const qrCaption = `Quét để chuyển khoản ${formatCurrency(grandTotalOf(content))}`;
    lines.push(<PrintQrCode key="qr" value={paymentQr} />);
    lines.push(<PrintText key="qr-caption" size={size} center>{qrCaption}</PrintText>);
  }

  if (options.showOrderBarcode && orderBarcode) {
    lines.push(<PrintBarcode key="barcode" value={orderBarcode} />);
    lines.push(<PrintText key="barcode-text" size={size} center>{orderBarcode}</PrintText>);
  }

  if (options.footerText) {
    lines.push(<PrintText key="footer" size={size} bold center>{options.footerText}</PrintText>);
  }

  return lines;
};

/** Phần trống thì bỏ luôn cả đường kẻ của nó. */
const sectionsOf = (content: ReceiptContent, options: ReceiptTemplateOptions): ReceiptSection[] =>
  [
    { key: STORE_SECTION_KEY, lines: storeLines(content, options) },
    { key: 'order', lines: orderLines(content, options) },
    { key: 'items', lines: content.items.flatMap((item, index) => itemLines(item, `item-${index}`, options)) },
    { key: 'totals', lines: totalLines(content, options) },
    { key: 'payment', lines: paymentLines(content, options) },
    { key: 'footer', lines: footerLines(content, options) },
  ].filter((section) => section.lines.length > 0);

/** Thuộc tính của mẫu hoá đơn. */
interface ReceiptTemplateProps {
  content: ReceiptContent;

  options?: ReceiptTemplateOptions;
}

/** Hoá đơn khách hàng để chụp thành ảnh in; rộng theo khung chụp (bề rộng vùng in của giấy). */
export const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({ content, options = DEFAULT_RECEIPT_TEMPLATE }) => {
  const { toDp } = usePrintRenderContext();
  const paddingStyle = usePaddingStyle(options.padding);
  const sections = sectionsOf(content, options);

  return (
    <View style={[paddingStyle, { gap: toDp(options.sectionGap) }]}>
      {sections.map((section, index) => (
        <React.Fragment key={section.key}>
          {index > 0 ? <PrintDivider dashed={sections[index - 1].key !== STORE_SECTION_KEY} /> : null}
          <View style={{ gap: toDp(options.lineGap) }}>{section.lines}</View>
        </React.Fragment>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  logo: { alignSelf: 'center' },
});
