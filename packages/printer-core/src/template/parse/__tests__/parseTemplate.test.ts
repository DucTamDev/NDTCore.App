import { parseTemplate } from '..';

function validLabelJson(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: 'product-label-default',
    name: 'Tem món mặc định',
    catalog: 'test-order',
    media: 'label',
    locale: 'vi-VN',
    paper: { widthMm: 50, heightMm: 30 },
    root: {
      type: 'container',
      id: 'root',
      style: { direction: 'column', gap: { value: 1, unit: 'mm' }, padding: uniformInsets(2) },
      children: [
        {
          type: 'text',
          id: 'title',
          content: [{ text: 'Bàn ' }, { var: 'tableName', format: { type: 'text', transform: 'upper' } }],
          style: { fontSize: { value: 16, unit: 'px' }, fontWeight: 'bold', lineHeight: 1.2 },
          visibleWhen: { op: 'exists', var: 'tableName' },
        },
        { type: 'line', id: 'divider', pattern: 'dashed', thickness: { value: 0.3, unit: 'mm' } },
        { type: 'image', id: 'logo', source: { var: 'storeLogo' } },
        { type: 'barcode', id: 'code', content: [{ var: 'orderCode' }], symbology: 'code128', readable: true },
        {
          type: 'repeat',
          id: 'items',
          collection: 'items',
          expand: 'quantity',
          maxItemsPerPage: 1,
          template: { type: 'qrcode', id: 'qr', content: [{ var: 'itemName' }], errorCorrection: 'M' },
        },
      ],
    },
  };
}

function uniformInsets(valueMm: number): Record<string, unknown> {
  const side = { value: valueMm, unit: 'mm' };
  return { top: side, right: side, bottom: side, left: side };
}

function withRoot(root: unknown): Record<string, unknown> {
  return { ...validLabelJson(), root };
}

function issuePaths(json: unknown): readonly string[] {
  const result = parseTemplate(json);
  return result.ok ? [] : result.issues.map((issue) => issue.path);
}

describe('parseTemplate', () => {
  it('chấp nhận template hợp lệ và trả đúng object', () => {
    const json = validLabelJson();
    const result = parseTemplate(json);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.template).toEqual(json);
  });

  it('báo lỗi khi input không phải object', () => {
    const result = parseTemplate('not a template');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toEqual([{ path: '', message: 'template phải là object JSON' }]);
  });

  it('báo lỗi rõ ràng khi schemaVersion cao hơn app đang chạy', () => {
    const result = parseTemplate({ ...validLabelJson(), schemaVersion: 2 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].message).toContain('phiên bản app mới hơn');
  });

  it('báo lỗi đơn vị độ dài sai kèm path chính xác', () => {
    const json = withRoot({
      type: 'container',
      id: 'root',
      style: { padding: { ...uniformInsets(2), top: { value: 2, unit: 'cm' } } },
      children: [],
    });

    expect(issuePaths(json)).toEqual(['root.style.padding.top.unit']);
  });

  it('báo lỗi độ dài âm', () => {
    const json = withRoot({ type: 'line', id: 'line', thickness: { value: -1, unit: 'mm' } });

    expect(issuePaths(json)).toEqual(['root.thickness.value']);
  });

  it('báo lỗi loại node lạ thay vì bỏ qua', () => {
    const json = withRoot({ type: 'container', id: 'root', children: [{ type: 'table', id: 't' }] });

    expect(issuePaths(json)).toEqual(['root.children[0].type']);
  });

  it('báo lỗi id node trùng', () => {
    const json = withRoot({
      type: 'container',
      id: 'root',
      children: [
        { type: 'text', id: 'same', content: [] },
        { type: 'text', id: 'same', content: [] },
      ],
    });

    expect(issuePaths(json)).toEqual(['root.children[1].id']);
  });

  it('bắt buộc chiều cao với label và cấm chiều cao với receipt', () => {
    expect(issuePaths({ ...validLabelJson(), paper: { widthMm: 50 } })).toEqual(['paper.heightMm']);
    expect(issuePaths({ ...validLabelJson(), media: 'receipt' })).toEqual(['paper.heightMm']);
  });

  it('báo lỗi segment không có text lẫn var, và format sai loại', () => {
    const json = withRoot({
      type: 'text',
      id: 'text',
      content: [{}, { var: 'orderCode', format: { type: 'percent' } }],
    });

    expect(issuePaths(json)).toEqual(['root.content[0]', 'root.content[1].format.type']);
  });

  it('báo lỗi điều kiện sai dạng, kể cả điều kiện lồng', () => {
    const json = withRoot({
      type: 'text',
      id: 'text',
      content: [],
      visibleWhen: { op: 'and', conditions: [{ op: 'gt', var: 'discount', value: null }, { op: 'between' }] },
    });

    expect(issuePaths(json)).toEqual([
      'root.visibleWhen.conditions[0].value',
      'root.visibleWhen.conditions[1].op',
    ]);
  });

  it('báo lỗi ảnh khai báo cả asset lẫn var', () => {
    const json = withRoot({ type: 'image', id: 'logo', source: { asset: 'logo@v1', var: 'storeLogo' } });

    expect(issuePaths(json)).toEqual(['root.source']);
  });

  it('báo lỗi repeat thiếu collection và maxItemsPerPage không phải số nguyên dương', () => {
    const json = withRoot({
      type: 'repeat',
      id: 'items',
      maxItemsPerPage: 0,
      template: { type: 'text', id: 'name', content: [] },
    });

    expect(issuePaths(json)).toEqual(['root.collection', 'root.maxItemsPerPage']);
  });
});
