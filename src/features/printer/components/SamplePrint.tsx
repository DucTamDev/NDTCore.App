import React from 'react';
import { LabelTemplate, ReceiptTemplate } from '../templates';
import type { LabelContent, LabelPage } from '../models/templates/LabelContent';
import type { PrintItem } from '../models/templates/PrintItem';
import type { ReceiptContent } from '../models/templates/ReceiptContent';
import type { PaperOptions } from '../models/paper/PaperOptions';

const SAMPLE_ORDER_NUMBER = 'DEMO001';

const SAMPLE_ITEMS: PrintItem[] = [
  {
    name: 'Cà phê sữa đá',
    quantity: 2,
    unitPrice: 29000,
    attributes: ['Size L', 'Ít đá'],
    toppings: [],
    note: null,
  },
  {
    name: 'Trà sữa trân châu',
    quantity: 1,
    unitPrice: 77000,
    attributes: ['Size M', '50% đường', 'Ít đá'],
    toppings: [
      { name: 'Trân châu đen', quantity: 2, price: 8000 },
      { name: 'Thạch dừa', quantity: 1, price: 8000 },
      { name: 'Pudding trứng', quantity: 1, price: 8000 },
    ],
    note: 'Không lấy ống hút',
  },
  {
    name: 'Bánh mì thịt nướng',
    quantity: 1,
    unitPrice: 35000,
    attributes: [],
    toppings: [],
    note: null,
  },
];

const formatSampleDateTime = (): string =>
  new Date().toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const SAMPLE_RECEIPT: ReceiptContent = {
  storeName: 'NDTCore Coffee',
  storeAddress: '123 Nguyễn Huệ, Quận 1, TP.HCM',
  orderNumber: `${SAMPLE_ORDER_NUMBER} (In thử)`,
  time: '',
  serviceType: 'Mang đi',
  items: SAMPLE_ITEMS,
  discountAmount: 10000,
  deliveryFee: 0,
  payment: { methodName: 'Tiền mặt', amountReceived: 200000, changeAmount: 40000 },
};

/** Ly trà sữa có topping để tem in thử có đủ các dòng. */
const SAMPLE_LABEL_ITEM = SAMPLE_ITEMS[1];

const SAMPLE_LABEL: LabelContent = {
  storeName: 'NDTCore Coffee',
  orderNumber: SAMPLE_ORDER_NUMBER,
  serviceType: 'Mang đi',
  time: '',
  items: [SAMPLE_LABEL_ITEM],
};

const SAMPLE_LABEL_PAGE: LabelPage = {
  item: SAMPLE_LABEL_ITEM,
  cupNumber: 1,
  cupCount: 1,
  partNumber: 1,
  partCount: 1,
  toppings: SAMPLE_LABEL_ITEM.toppings,
};

/** Hoá đơn mẫu cho "In thử": dữ liệu cố định, dùng đúng mẫu của hoá đơn thật. */
export const SampleReceipt: React.FC = () => (
  <ReceiptTemplate content={{ ...SAMPLE_RECEIPT, time: formatSampleDateTime() }} />
);

/** Tem mẫu cho "In thử": một ly trà sữa có topping, cao đúng một con tem của `paper`. */
export const SampleLabel: React.FC<{ paper: PaperOptions }> = ({ paper }) => (
  <LabelTemplate content={SAMPLE_LABEL} page={SAMPLE_LABEL_PAGE} paper={paper} />
);
