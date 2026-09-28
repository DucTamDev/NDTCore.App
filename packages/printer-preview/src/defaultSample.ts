export const defaultCode = `import {
  column,
  defineTemplateData,
  defineCollection,
  eq,
  gt,
  insets,
  labelTemplate,
  mm,
  px,
  text,
} from 'printer-core';

interface Topping {
  readonly name: string;
}

interface Product {
  readonly name: string;
  readonly price: number;
  readonly quantity: number;
  readonly toppings: readonly Topping[];
}

interface LabelData {
  readonly orderCode: string;
  readonly products: readonly Product[];
}

const sample: LabelData = {
  orderCode: 'HD001',
  products: [
    { name: 'Trà sữa trân châu', price: 45000, quantity: 2, toppings: [{ name: 'Trân châu' }, { name: 'Thạch dừa' }] },
  ],
};

const toppings = defineCollection({
  label: 'Topping',
  get: (product: Product) => product.toppings,
  variables: {
    toppingName: { label: 'Tên topping', type: 'string', get: (topping) => topping.name },
  },
});

const products = defineCollection({
  label: 'Danh sách món',
  get: (data: LabelData) => data.products,
  variables: {
    productName: { label: 'Tên món', type: 'string', get: (product) => product.name },
    productPrice: { label: 'Giá món', type: 'money', get: (product) => product.price },
    quantity: { label: 'Số lượng', type: 'number', get: (product) => product.quantity },
  },
  collections: { toppings },
});

export const templateData = defineTemplateData({
  id: 'product-label',
  version: 1,
  sample,
  variables: {
    orderCode: { label: 'Mã đơn', type: 'string', get: (data) => data.orderCode },
  },
  collections: { products },
});

export default labelTemplate(templateData)
  .id('product-label-default')
  .name('Tem món mặc định')
  .paper({ widthMm: 50, heightMm: 30 })
  .root((scope) =>
    scope
      .repeat({ collection: 'products', expand: 'quantity' }, (product) =>
        column()
          .padding(insets(mm(2)))
          .gap(mm(1))
          .children(
            text([product.var('productName')]).fontSize(px(16)).bold(),
            text([product.var('productPrice')]).visibleWhen(eq('$part', 1)),
            product
              .repeat({ collection: 'toppings' }, (topping) => text([{ text: '+ ' }, topping.var('toppingName')]))
              .maxItemsPerPage(4),
            text([
              product.var('orderCode'),
              { text: ' · ' },
              product.var('$unit'),
              { text: '/' },
              product.var('$unitCount'),
            ]),
            text([{ text: '(tiếp ' }, product.var('$part'), { text: '/' }, product.var('$partCount'), { text: ')' }])
              .visibleWhen(gt('$partCount', 1)),
          ),
      )
      .maxItemsPerPage(1),
  )
  .build();
`;

export const defaultData = JSON.stringify(
  {
    orderCode: 'HD001',
    products: [
      {
        name: 'Trà sữa trân châu',
        price: 45000,
        quantity: 2,
        toppings: [{ name: 'Trân châu' }, { name: 'Thạch dừa' }],
      },
    ],
  },
  null,
  2,
);
