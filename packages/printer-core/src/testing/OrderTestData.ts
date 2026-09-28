import { defineTemplateData, defineCollection } from '../template/data';

/** Topping của 1 món trong data test. */
export interface TestTopping {
  /** Tên topping. */
  readonly name: string;

  /** Giá topping, đơn vị đồng. */
  readonly price: number;
}

/** 1 món trong data test. */
export interface TestOrderItem {
  /** Tên món. */
  readonly name: string;

  /** Số lượng, dùng cho `expand`. */
  readonly quantity: number;

  /** Đơn giá, đơn vị đồng. */
  readonly price: number;

  /** Ghi chú món; có thể không có. */
  readonly note?: string;

  /** Danh sách topping của món. */
  readonly toppings: readonly TestTopping[];
}

/** Đơn hàng dùng làm data test cho dữ liệu template/resolver/validate. */
export interface TestOrder {
  /** Mã đơn, VD 'HD001'. */
  readonly code: string;

  /** Tên bàn; đơn mang về thì không có. */
  readonly tableName?: string;

  /** Thời điểm tạo đơn, chuỗi ISO 8601. */
  readonly createdAt: string;

  /** Tiền giảm giá, đơn vị đồng. */
  readonly discount: number;

  /** Mã asset logo cửa hàng; có thể không có. */
  readonly storeLogo?: string;

  /** Danh sách món trong đơn. */
  readonly items: readonly TestOrderItem[];
}

const TOPPINGS = defineCollection({
  label: 'Topping',
  get: (item: TestOrderItem) => item.toppings,
  variables: {
    toppingName: { label: 'Tên topping', type: 'string', get: (topping) => topping.name },
    toppingPrice: { label: 'Giá topping', type: 'money', get: (topping) => topping.price },
  },
});

const ITEMS = defineCollection({
  label: 'Danh sách món',
  get: (order: TestOrder) => order.items,
  variables: {
    itemName: { label: 'Tên món', type: 'string', get: (item) => item.name },
    quantity: { label: 'Số lượng', type: 'number', get: (item) => item.quantity },
    itemTotal: { label: 'Thành tiền', type: 'money', get: (item) => item.price * item.quantity },
    itemNote: { label: 'Ghi chú món', type: 'string', optional: true, get: (item) => item.note },
    legacyItemName: { label: 'Tên món (cũ)', type: 'string', deprecated: 'Dùng itemName', get: (item) => item.name },
  },
  collections: { toppings: TOPPINGS },
});

/** Data mẫu: 2 món (trà sữa ×3 có 1 topping, cà phê ×2 có ghi chú). */
export const TEST_ORDER_SAMPLE: TestOrder = {
  code: 'HD001',
  tableName: 'Bàn 5',
  createdAt: '2026-09-24T10:30:00',
  discount: 5000,
  storeLogo: 'store-logo@v1',
  items: [
    { name: 'Trà sữa', quantity: 3, price: 45000, toppings: [{ name: 'Trân châu', price: 5000 }] },
    { name: 'Cà phê', quantity: 2, price: 30000, note: 'Ít đá', toppings: [] },
  ],
};

/** TemplateDataDefinition đơn hàng dùng chung cho test của dữ liệu template, template, resolution, layout. */
export const TEST_ORDER_DATA = defineTemplateData({
  id: 'test-order',
  version: 1,
  sample: TEST_ORDER_SAMPLE,
  variables: {
    orderCode: { label: 'Mã đơn', type: 'string', get: (order) => order.code },
    tableName: { label: 'Tên bàn', type: 'string', optional: true, get: (order) => order.tableName },
    createdAt: { label: 'Giờ tạo đơn', type: 'datetime', get: (order) => order.createdAt },
    discount: { label: 'Giảm giá', type: 'money', get: (order) => order.discount },
    storeLogo: { label: 'Logo cửa hàng', type: 'asset', optional: true, get: (order) => order.storeLogo },
  },
  collections: { items: ITEMS },
});
