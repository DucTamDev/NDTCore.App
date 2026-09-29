import { parseTemplate } from '..';

function validLabelJson(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    metadata: {
      id: 'product-label-default',
      name: 'Tem món mặc định',
      kind: 'label',
      locale: 'vi-VN',
      paper: { widthMm: 50, heightMm: 30 },
    },
    settings: { styles: {}, options: {} },
    content: {
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

function withContent(content: unknown): Record<string, unknown> {
  return { ...validLabelJson(), content };
}

function withMetadata(overrides: Record<string, unknown>): Record<string, unknown> {
  const json = validLabelJson();
  return { ...json, metadata: { ...(json.metadata as Record<string, unknown>), ...overrides } };
}

function withSettings(settings: unknown): Record<string, unknown> {
  return { ...validLabelJson(), settings };
}

const FONT_SIZE = { value: 16, unit: 'px' };

function issuePaths(json: unknown): readonly string[] {
  const result = parseTemplate(json);
  return result.ok ? [] : result.issues.map((issue) => issue.path);
}

function issuesOf(json: unknown): readonly { path: string; message: string }[] {
  const result = parseTemplate(json);
  return result.ok ? [] : result.issues.map((issue) => ({ path: issue.path, message: issue.message }));
}

function toppingRepeatJson(template: unknown = toppingNameJson(), maxItemsPerPage?: number): Record<string, unknown> {
  return {
    type: 'repeat',
    id: 'toppings',
    collection: 'toppings',
    ...(maxItemsPerPage === undefined ? {} : { maxItemsPerPage }),
    template,
  };
}

function toppingNameJson(): Record<string, unknown> {
  return { type: 'text', id: 'topping-name', content: [{ var: 'toppingName' }] };
}

function itemRepeatJson(
  id: string,
  template: unknown,
  maxItemsPerPage?: number,
): Record<string, unknown> {
  return {
    type: 'repeat',
    id,
    collection: 'items',
    ...(maxItemsPerPage === undefined ? {} : { maxItemsPerPage }),
    template,
  };
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
    if (!result.ok) expect(result.issues).toEqual([{ path: '', message: 'phải là object' }]);
  });

  it('từ chối template khác schema hiện tại, không migrate', () => {
    const newer = parseTemplate({ ...validLabelJson(), schemaVersion: 2 });
    const older = parseTemplate({ ...validLabelJson(), schemaVersion: 0 });

    expect(newer).toEqual({ ok: false, issues: [{ path: 'schemaVersion', message: 'phải là 1' }] });
    expect(older).toEqual({ ok: false, issues: [{ path: 'schemaVersion', message: 'phải là 1' }] });
  });

  it('báo lỗi đơn vị độ dài sai kèm path chính xác', () => {
    const json = withContent({
      type: 'container',
      id: 'root',
      style: { padding: { ...uniformInsets(2), top: { value: 2, unit: 'cm' } } },
      children: [],
    });

    expect(issuePaths(json)).toEqual(['content.style.padding.top.unit']);
  });

  it('báo lỗi độ dài âm', () => {
    const json = withContent({ type: 'line', id: 'line', thickness: { value: -1, unit: 'mm' } });

    expect(issuePaths(json)).toEqual(['content.thickness.value']);
  });

  it('báo lỗi loại node lạ thay vì bỏ qua', () => {
    const json = withContent({ type: 'container', id: 'root', children: [{ type: 'table', id: 't' }] });

    expect(issuePaths(json)).toEqual(['content.children[0].type']);
  });

  it('báo lỗi id node trùng', () => {
    const json = withContent({
      type: 'container',
      id: 'root',
      children: [
        { type: 'text', id: 'same', content: [] },
        { type: 'text', id: 'same', content: [] },
      ],
    });

    expect(issuePaths(json)).toEqual(['content.children[1].id']);
  });

  it('bắt buộc metadata và content', () => {
    const json = validLabelJson();
    delete json.metadata;
    delete json.content;

    expect(issuesOf(json)).toEqual([
      { path: 'metadata', message: 'phải là object' },
      { path: 'content', message: 'phải là object' },
    ]);
  });

  it('báo lỗi kind lạ', () => {
    expect(issuePaths(withMetadata({ kind: 'kitchen' }))).toEqual(['metadata.kind']);
  });

  it('bắt buộc chiều cao với label và cấm chiều cao với receipt', () => {
    expect(issuePaths(withMetadata({ paper: { widthMm: 50 } }))).toEqual(['metadata.paper.heightMm']);
    expect(issuePaths(withMetadata({ kind: 'receipt' }))).toEqual(['metadata.paper.heightMm']);
  });

  it('báo lỗi segment không có text lẫn var, và format sai loại', () => {
    const json = withContent({
      type: 'text',
      id: 'text',
      content: [{}, { var: 'orderCode', format: { type: 'percent' } }],
    });

    expect(issuePaths(json)).toEqual(['content.content[0]', 'content.content[1].format.type']);
  });

  it('báo lỗi segment có cả text lẫn var', () => {
    const json = withContent({ type: 'text', id: 'text', content: [{ text: 'x', var: 'orderCode' }] });

    expect(issuePaths(json)).toEqual(['content.content[0]']);
  });

  it('báo lỗi điều kiện sai dạng, kể cả điều kiện lồng', () => {
    const json = withContent({
      type: 'text',
      id: 'text',
      content: [],
      visibleWhen: { op: 'and', conditions: [{ op: 'gt', var: 'discount', value: null }, { op: 'between' }] },
    });

    expect(issuePaths(json)).toEqual([
      'content.visibleWhen.conditions[0].value',
      'content.visibleWhen.conditions[1].op',
    ]);
  });

  it('báo lỗi ảnh khai báo cả asset lẫn var', () => {
    const json = withContent({ type: 'image', id: 'logo', source: { asset: 'logo@v1', var: 'storeLogo' } });

    expect(issuePaths(json)).toEqual(['content.source']);
  });

  it('báo lỗi repeat thiếu collection và maxItemsPerPage không phải số nguyên dương', () => {
    const json = withContent({
      type: 'repeat',
      id: 'items',
      maxItemsPerPage: 0,
      template: { type: 'text', id: 'name', content: [] },
    });

    expect(issuePaths(json)).toEqual(['content.collection', 'content.maxItemsPerPage']);
  });

  it('chấp nhận repeat lồng tách tem khi repeat ngoài cùng có maxItemsPerPage là 1', () => {
    const json = withContent(itemRepeatJson('items', toppingRepeatJson(toppingNameJson(), 4), 1));

    expect(issuesOf(json)).toEqual([]);
  });

  it('báo lỗi repeat lồng tách tem khi repeat ngoài cùng có maxItemsPerPage khác 1', () => {
    const json = withContent(itemRepeatJson('items', toppingRepeatJson(toppingNameJson(), 4), 2));

    expect(issuesOf(json)).toEqual([
      {
        path: 'content.template.maxItemsPerPage',
        message: 'repeat lồng chỉ tách tem được khi repeat ngoài cùng có maxItemsPerPage là 1',
      },
    ]);
  });

  it('báo lỗi repeat lồng tách tem khi repeat ngoài cùng không phân trang', () => {
    const json = withContent(itemRepeatJson('items', toppingRepeatJson(toppingNameJson(), 4)));

    expect(issuesOf(json)).toEqual([
      {
        path: 'content.template.maxItemsPerPage',
        message: 'repeat lồng chỉ tách tem được khi repeat ngoài cùng có maxItemsPerPage',
      },
    ]);
  });

  it('báo lỗi maxItemsPerPage ở repeat lồng từ tầng 2 trở xuống', () => {
    const deeper = { ...toppingRepeatJson(toppingNameJson(), 2), id: 'deeper' };
    const json = withContent(itemRepeatJson('items', toppingRepeatJson(deeper), 1));

    expect(issuesOf(json)).toEqual([
      { path: 'content.template.template.maxItemsPerPage', message: 'chỉ tách tem được repeat lồng 1 tầng' },
    ]);
  });

  it('báo lỗi khi hơn 1 repeat ngoài cùng chứa repeat lồng tách tem', () => {
    const secondName = { ...toppingNameJson(), id: 'second-topping-name' };
    const secondToppings = { ...toppingRepeatJson(secondName, 4), id: 'second-toppings' };
    const json = withContent({
      type: 'container',
      id: 'root',
      children: [
        itemRepeatJson('first', toppingRepeatJson(toppingNameJson(), 4), 1),
        itemRepeatJson('second', secondToppings, 1),
      ],
    });

    expect(issuesOf(json)).toEqual([
      { path: 'content.children[1]', message: 'chỉ 1 repeat ngoài cùng được chứa repeat lồng có maxItemsPerPage' },
    ]);
  });

  it('không báo trùng lỗi MULTIPLE_CARRIERS khi repeat ngoài cùng thứ 2 chưa phân trang', () => {
    const unpagedName = { ...toppingNameJson(), id: 'unpaged-topping-name' };
    const unpagedToppings = { ...toppingRepeatJson(unpagedName, 4), id: 'unpaged-toppings' };
    const json = withContent({
      type: 'container',
      id: 'root',
      children: [
        itemRepeatJson('valid-carrier', toppingRepeatJson(toppingNameJson(), 4), 1),
        itemRepeatJson('unpaged-outer', unpagedToppings),
      ],
    });

    expect(issuesOf(json)).toEqual([
      {
        path: 'content.children[1].template.maxItemsPerPage',
        message: 'repeat lồng chỉ tách tem được khi repeat ngoài cùng có maxItemsPerPage',
      },
    ]);
  });
});

describe('parseTemplate — tham chiếu settings trong node', () => {
  it('chấp nhận styleName, segment option và điều kiện option đúng dạng', () => {
    const json = withContent({
      type: 'container',
      id: 'root',
      children: [
        {
          type: 'text',
          id: 'name',
          content: [{ text: 'x' }],
          styleName: 'itemName',
          style: { padding: uniformInsets(1) },
        },
        { type: 'text', id: 'footer', content: [{ option: 'footerText' }] },
        { type: 'text', id: 'price', content: [{ text: 'y' }], visibleWhen: { op: 'option', option: 'showPrice' } },
        {
          type: 'text',
          id: 'full-price',
          content: [{ text: 'z' }],
          visibleWhen: { op: 'not', condition: { op: 'option', option: 'priceStyle', equals: 'short' } },
        },
      ],
    });

    expect(issuesOf(json)).toEqual([]);
  });

  it('báo lỗi segment có nhiều hơn 1 trong text, var, option', () => {
    const json = withContent({ type: 'text', id: 'text', content: [{ text: 'x', option: 'footerText' }] });

    expect(issuesOf(json)).toEqual([
      { path: 'content.content[0]', message: 'segment chỉ được có 1 trong các field "text", "var", "option"' },
    ]);
  });

  it('báo lỗi điều kiện option thiếu tên hoặc equals sai kiểu', () => {
    const json = withContent({
      type: 'text',
      id: 'text',
      content: [],
      visibleWhen: { op: 'or', conditions: [{ op: 'option' }, { op: 'option', option: 'priceStyle', equals: 1 }] },
    });

    expect(issuesOf(json)).toEqual([
      { path: 'content.visibleWhen.conditions[0].option', message: 'phải là chuỗi khác rỗng' },
      { path: 'content.visibleWhen.conditions[1].equals', message: 'phải là chuỗi hoặc boolean' },
    ]);
  });

  it('báo lỗi text vừa có styleName vừa đặt thuộc tính chữ viết thẳng', () => {
    const json = withContent({
      type: 'text',
      id: 'text',
      content: [],
      styleName: 'itemName',
      style: { fontSize: FONT_SIZE, textAlign: 'center', padding: uniformInsets(1) },
    });

    expect(issuesOf(json)).toEqual([
      { path: 'content.style.fontSize', message: 'không dùng cùng styleName (style chữ lấy từ settings)' },
      { path: 'content.style.textAlign', message: 'không dùng cùng styleName (style chữ lấy từ settings)' },
    ]);
  });
});

describe('parseTemplate — settings', () => {
  it('chấp nhận style có tên và đủ 3 loại option hợp lệ', () => {
    const json = withSettings({
      styles: {
        itemName: {
          label: 'Tên món',
          value: { fontSize: FONT_SIZE, fontWeight: 'bold' },
          default: { fontSize: FONT_SIZE },
        },
      },
      options: {
        showPrice: { label: 'In giá món', type: 'boolean', value: false, default: true },
        footerText: { label: 'Dòng cuối', type: 'text', value: 'Wifi: abc', default: 'Cảm ơn quý khách' },
        priceStyle: {
          label: 'Kiểu giá',
          type: 'choice',
          choices: [
            { value: 'short', label: '45k' },
            { value: 'full', label: '45.000đ' },
          ],
          value: 'short',
          default: 'full',
        },
      },
    });

    expect(issuesOf(json)).toEqual([]);
  });

  it('bắt buộc có settings', () => {
    const json = validLabelJson();
    delete json.settings;

    expect(issuesOf(json)).toEqual([{ path: 'settings', message: 'phải là object' }]);
  });

  it('báo lỗi style thiếu nhãn hoặc value, và thuộc tính chữ sai', () => {
    const json = withSettings({ styles: { itemName: { label: '', default: { fontWeight: 'heavy' } } }, options: {} });

    expect(issuesOf(json)).toEqual([
      { path: 'settings.styles.itemName.label', message: 'phải là chuỗi khác rỗng' },
      { path: 'settings.styles.itemName.value', message: 'phải là object' },
      { path: 'settings.styles.itemName.default.fontWeight', message: 'phải là 1 trong: "normal", "bold"' },
    ]);
  });

  it('báo lỗi style có value chứa thuộc tính không phải chữ (VD padding)', () => {
    const json = withSettings({
      styles: {
        itemName: {
          label: 'Tên món',
          value: { fontSize: FONT_SIZE, padding: uniformInsets(1) },
          default: { fontSize: FONT_SIZE },
        },
      },
      options: {},
    });

    expect(issuesOf(json)).toEqual([
      { path: 'settings.styles.itemName.value.padding', message: 'không phải thuộc tính chữ' },
    ]);
  });

  it('báo lỗi option sai kiểu giá trị theo loại, và loại option lạ', () => {
    const json = withSettings({
      styles: {},
      options: {
        showPrice: { label: 'In giá', type: 'boolean', value: 'yes', default: true },
        footerText: { label: 'Dòng cuối', type: 'text', value: 'x', default: 1 },
        mode: { label: 'Chế độ', type: 'slider', value: 1, default: 1 },
      },
    });

    expect(issuesOf(json)).toEqual([
      { path: 'settings.options.showPrice.value', message: 'phải là true hoặc false' },
      { path: 'settings.options.footerText.default', message: 'phải là chuỗi' },
      { path: 'settings.options.mode.type', message: 'phải là 1 trong: "boolean", "text", "choice"' },
    ]);
  });

  it('báo lỗi option choice rỗng, lựa chọn trùng, và giá trị ngoài danh sách', () => {
    const json = withSettings({
      styles: {},
      options: {
        empty: { label: 'Rỗng', type: 'choice', choices: [], value: 'a', default: 'a' },
        priceStyle: {
          label: 'Kiểu giá',
          type: 'choice',
          choices: [
            { value: 'short', label: '45k' },
            { value: 'short', label: 'Ngắn' },
          ],
          value: 'full',
          default: 'short',
        },
      },
    });

    expect(issuesOf(json)).toEqual([
      { path: 'settings.options.empty.choices', message: 'phải có ít nhất 1 lựa chọn' },
      { path: 'settings.options.priceStyle.choices[1].value', message: 'giá trị "short" bị trùng' },
      { path: 'settings.options.priceStyle.value', message: 'phải là 1 trong: "short"' },
    ]);
  });
});
