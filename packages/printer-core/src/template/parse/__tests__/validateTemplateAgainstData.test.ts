import { validateTemplateAgainstData } from '..';
import { TEST_ORDER_DATA } from '../../../testing';
import type { TemplateDocument, TemplateNode } from '../..';

const description = TEST_ORDER_DATA.describe();

function documentWithRoot(root: TemplateNode): TemplateDocument {
  return {
    schemaVersion: 1,
    metadata: {
      id: 'template',
      name: 'Template',
      kind: 'receipt',
      locale: 'vi-VN',
      paper: { widthMm: 72 },
    },
    settings: { styles: {}, options: {} },
    content: root,
  };
}

function textOf(variable: string, format?: { readonly type: 'currency' }): TemplateNode {
  return { type: 'text', id: `text-${variable}`, content: [format ? { var: variable, format } : { var: variable }] };
}

function repeatItems(template: TemplateNode, expand?: string): TemplateNode {
  return { type: 'repeat', id: 'items', collection: 'items', ...(expand ? { expand } : {}), template };
}

function errorsOf(root: TemplateNode): readonly string[] {
  return validateTemplateAgainstData(documentWithRoot(root), description).errors.map((issue) => issue.message);
}

describe('validateTemplateAgainstData', () => {
  it('không có lỗi với template dùng đúng biến và scope', () => {
    const root: TemplateNode = {
      type: 'container',
      id: 'root',
      children: [
        textOf('orderCode'),
        textOf('$page'),
        { type: 'image', id: 'logo', source: { var: 'storeLogo' } },
        repeatItems(
          {
            type: 'container',
            id: 'item',
            children: [
              textOf('itemName'),
              textOf('orderCode'),
              textOf('$unit'),
              { type: 'repeat', id: 'toppings', collection: 'toppings', template: textOf('toppingName') },
            ],
          },
          'quantity',
        ),
      ],
    };

    const result = validateTemplateAgainstData(documentWithRoot(root), description);

    expect(result).toEqual({ errors: [], warnings: [] });
  });

  it('báo lỗi biến không có trong dữ liệu template', () => {
    expect(errorsOf(textOf('missing'))).toEqual(['dữ liệu template "test-order" không có biến "missing"']);
  });

  it('báo lỗi biến của collection dùng ngoài vòng lặp, kèm tên hiển thị của collection', () => {
    const result = validateTemplateAgainstData(documentWithRoot(textOf('itemName')), description);

    expect(result.errors).toEqual([
      { path: 'content.content[0]', message: 'biến "itemName" chỉ dùng được trong vòng lặp "Danh sách món"' },
    ]);
  });

  it('báo lỗi collection lồng được lặp ngoài collection cha', () => {
    const root: TemplateNode = {
      type: 'repeat',
      id: 'toppings',
      collection: 'toppings',
      template: textOf('toppingName'),
    };

    expect(errorsOf(root)).toEqual(['collection "toppings" chỉ lặp được bên trong vòng lặp "Danh sách món"']);
  });

  it('báo lỗi collection không tồn tại', () => {
    const root: TemplateNode = { type: 'repeat', id: 'r', collection: 'payments', template: textOf('orderCode') };

    expect(errorsOf(root)).toEqual(['dữ liệu template không có collection "payments"']);
  });

  it('báo lỗi expand không phải biến number của đúng collection', () => {
    expect(errorsOf(repeatItems(textOf('itemName'), 'itemName'))).toEqual([
      'expand phải là biến kiểu "number", "itemName" là "string"',
    ]);
    expect(errorsOf(repeatItems(textOf('itemName'), 'discount'))).toEqual([
      'expand phải là biến của collection "items"',
    ]);
  });

  it('báo lỗi ảnh dùng biến không phải kiểu asset', () => {
    const root: TemplateNode = { type: 'image', id: 'logo', source: { var: 'orderCode' } };

    expect(errorsOf(root)).toEqual(['ảnh phải dùng biến kiểu "asset", "orderCode" là "string"']);
  });

  it('báo lỗi format không hợp kiểu biến', () => {
    expect(errorsOf(textOf('orderCode', { type: 'currency' }))).toEqual([
      'format "currency" không dùng được cho biến kiểu "string"',
    ]);
  });

  it('báo lỗi biến có sẵn dùng sai scope', () => {
    expect(errorsOf(textOf('$position'))).toEqual(['biến "$position" chỉ dùng được bên trong repeat']);
    expect(errorsOf(repeatItems(textOf('$unit')))).toEqual(['biến "$unit" chỉ dùng được bên trong repeat có expand']);
  });

  it('kiểm tra cả biến trong điều kiện ẩn/hiện', () => {
    const root: TemplateNode = {
      type: 'text',
      id: 'note',
      content: [{ text: 'Ghi chú' }],
      visibleWhen: { op: 'not', condition: { op: 'exists', var: 'itemNote' } },
    };

    expect(errorsOf(root)).toEqual(['biến "itemNote" chỉ dùng được trong vòng lặp "Danh sách món"']);
  });

  it('biến deprecated chỉ cảnh báo, không phải lỗi', () => {
    const result = validateTemplateAgainstData(
      documentWithRoot(repeatItems(textOf('legacyItemName'))),
      description,
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      { path: 'content.template.content[0]', message: 'biến "legacyItemName" đã ngừng dùng: Dùng itemName' },
    ]);
  });
});
