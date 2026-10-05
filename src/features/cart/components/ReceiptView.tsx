import React from 'react';
import { View } from 'react-native';
import { PrintDivider, PrintRow, PrintText } from '../../printer/components/PrintLayout';
import { formatCurrency } from '../../../utils/formatCurrency';
import { PAYMENT_METHOD_LABEL } from '../utils/billFormat';
import type { Receipt, ReceiptItem } from '../types/cart.types';

const itemLabel = (item: ReceiptItem): string => (item.quantity > 1 ? `${item.quantity}x ${item.name}` : item.name);

const ReceiptItemLines: React.FC<{ item: ReceiptItem }> = ({ item }) => (
  <>
    <PrintRow label={itemLabel(item)} value={formatCurrency(item.unitPrice * item.quantity)} />
    {item.note ? <PrintText>{`  Ghi chú: ${item.note}`}</PrintText> : null}
  </>
);

/** Phần thanh toán; tiền nhận/tiền thừa chỉ có nghĩa khi trả tiền mặt. */
const PaymentLines: React.FC<{ receipt: Receipt }> = ({ receipt }) => {
  const { paymentMethod, amountReceived, changeAmount } = receipt;

  if (!paymentMethod) {
    return null;
  }

  const showCash = paymentMethod === 'Cash' && amountReceived !== null && changeAmount !== null;

  return (
    <>
      <PrintRow label="Phương thức" value={PAYMENT_METHOD_LABEL[paymentMethod] ?? paymentMethod} />
      {showCash ? <PrintRow label="Số tiền nhận" value={formatCurrency(amountReceived)} /> : null}
      {showCash ? <PrintRow label="Tiền thừa" value={formatCurrency(changeAmount)} /> : null}
    </>
  );
};

/** Bill khách hàng để chụp thành ảnh in; bill lúc thanh toán và bill in lại dùng chung bố cục này. */
export const ReceiptView: React.FC<{ receipt: Receipt }> = ({ receipt }) => {
  const { storeName, storeAddress, headerRows, items, discountAmount, deliveryFee } = receipt;
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const total = subtotal - discountAmount + deliveryFee;

  return (
    <View>
      {storeName ? <PrintText>{storeName}</PrintText> : null}
      {storeAddress ? <PrintText>{storeAddress}</PrintText> : null}
      <PrintDivider />
      {headerRows.map((row) => (
        <PrintRow key={row.label} label={row.label} value={row.value} />
      ))}
      <PrintDivider />
      <PrintText>SẢN PHẨM</PrintText>
      {items.map((item, index) => (
        <ReceiptItemLines key={index} item={item} />
      ))}
      <PrintDivider />
      <PrintRow label="Tổng số lượng" value={String(totalQuantity)} />
      <PrintRow label="Tạm tính" value={formatCurrency(subtotal)} />
      {discountAmount > 0 ? <PrintRow label="Giảm giá" value={`-${formatCurrency(discountAmount)}`} /> : null}
      {deliveryFee > 0 ? <PrintRow label="Phí giao hàng" value={formatCurrency(deliveryFee)} /> : null}
      <PrintDivider />
      <PrintRow label="TỔNG THANH TOÁN" value={formatCurrency(total)} />
      <PaymentLines receipt={receipt} />
      <PrintDivider />
      <PrintText>Cảm ơn quý khách! Hẹn gặp lại lần sau</PrintText>
    </View>
  );
};
