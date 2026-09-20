export const defaultCode = `import { labelTemplate, column, text, repeat } from 'printer-core';

export default labelTemplate()
  .size({ widthDots: 400, heightDots: 240, dpi: 203 })
  .root(
    column()
      .padding({ top: 8, right: 8, bottom: 8, left: 8 })
      .gap(4)
      .children(
        text.binding('product.name').fontSize(24).bold(),
        text.binding('product.price'),
        repeat('toppings')
          .maxItemsPerPage(6)
          .template(column().children(text.binding('name'))),
      ),
  )
  .build();
`;

export const defaultData = JSON.stringify(
  {
    product: { name: 'Trà sữa trân châu', price: '45,000đ' },
    toppings: [{ name: 'Trân châu' }, { name: 'Thạch dừa' }],
  },
  null,
  2,
);
