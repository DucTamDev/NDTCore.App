import React from 'react';
import { Text, View } from 'react-native';
import type { ReactTestRenderer } from 'react-test-renderer';
import { renderTemplate } from '../__testing__/renderTemplate';
import { DEFAULT_LABEL_TEMPLATE, LabelTemplate } from '..';
import { labelPagesOf, type LabelContent, type LabelPage } from '../../models/templates/LabelContent';
import type { LabelTemplateOptions } from '../../models/templates/LabelTemplateOptions';

const toppings = ['a', 'b', 'c', 'd', 'e', 'f'].map((name) => ({ name, quantity: 1, price: 8000 }));

const content: LabelContent = {
  storeName: 'NDTCore',
  customerName: 'Anh Minh',
  orderNumber: 'A1024',
  serviceType: 'Mang đi',
  time: '10:42',
  items: [
    {
      name: 'Trà sữa trân châu',
      quantity: 1,
      unitPrice: 45000,
      attributes: ['Size M', 'Ít đá'],
      toppings,
      note: 'Không ống hút',
    },
  ],
};

const options: LabelTemplateOptions = { ...DEFAULT_LABEL_TEMPLATE, showServiceType: true };

const pages = labelPagesOf(content, options);

const render = (page: LabelPage): ReactTestRenderer =>
  renderTemplate(<LabelTemplate content={content} page={page} options={options} />);

const linesOf = (page: LabelPage): string[] =>
  render(page).root.findAllByType(Text).map((node) => String(node.props.children));

describe('LabelTemplate', () => {
  it('dòng trên theo thứ tự mã đơn → hình thức → số thứ tự ly', () => {
    expect(linesOf(pages[0]).slice(0, 3)).toEqual(['#A1024', 'Mang đi', 'Ly 1/1']);
  });

  it('tem đầu có "tem 1/2" sau tên món, thuộc tính, 5 topping và giá; không có ghi chú', () => {
    expect(linesOf(pages[0]).slice(3)).toEqual([
      'Trà sữa trân châu',
      'tem 1/2',
      'Size M · Ít đá',
      '+ a',
      '+ b',
      '+ c',
      '+ d',
      '+ e',
      '45.000đ',
    ]);
  });

  it('tem sau chỉ có topping còn lại và ghi chú', () => {
    expect(linesOf(pages[1]).slice(3)).toEqual(['Trà sữa trân châu', 'tem 2/2', '+ f', '* Không ống hút']);
  });

  it('LabelTemplate lấp đầy khung tem, không tự đặt chiều cao', () => {
    const root = render(pages[0]).root.findAllByType(View)[0];
    const style = Object.assign({}, ...[root.props.style].flat(2).filter(Boolean));
    expect(style.flex).toBe(1);
    expect(style.height).toBeUndefined();
  });
});

describe('LabelTemplate dòng dưới', () => {
  it('mặc định không có dòng dưới; bật thì tên cửa hàng · tên khách bên trái, giờ bên phải', () => {
    const footerOf = (labelOptions: LabelTemplateOptions): string[] => {
      const renderer = renderTemplate(<LabelTemplate content={content} page={pages[1]} options={labelOptions} />);
      const lines = renderer.root.findAllByType(Text).map((node) => String(node.props.children));
      return lines.slice(lines.indexOf('* Không ống hút') + 1);
    };

    expect(footerOf(DEFAULT_LABEL_TEMPLATE)).toEqual([]);
    const allOn = { ...DEFAULT_LABEL_TEMPLATE, showStoreName: true, showCustomerName: true, showTime: true };
    expect(footerOf(allOn)).toEqual(['NDTCore · Anh Minh', '10:42']);
  });
});
