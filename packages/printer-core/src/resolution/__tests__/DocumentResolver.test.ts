import { createDocumentResolver, type AssetProvider, type ResolvedNode, type ResolvedPage } from '..';
import { defineCatalog, defineCollection } from '../../catalog';
import type { TemplateDocument, TemplateMedia, TemplateNode } from '../../template';
import { TEST_ORDER_CATALOG, TEST_ORDER_SAMPLE, type TestOrder } from '../../testing';
import type { Bitmap } from '../../types';

const LOGO_BITMAP: Bitmap = { data: new Uint8Array(8), width: 8, height: 8, bytesPerRow: 1 };
const NO_ASSETS: AssetProvider = { get: () => undefined };
const LOGO_ASSETS: AssetProvider = { get: (assetId) => (assetId === 'store-logo@v1' ? LOGO_BITMAP : undefined) };

const resolver = createDocumentResolver();

function documentWith(root: TemplateNode, media: TemplateMedia = 'receipt'): TemplateDocument {
  return {
    schemaVersion: 1,
    id: 'template',
    name: 'Template',
    catalog: 'test-order',
    media,
    locale: 'vi-VN',
    paper: media === 'label' ? { widthMm: 50, heightMm: 30 } : { widthMm: 72 },
    root,
  };
}

function resolvePages(
  root: TemplateNode,
  data: TestOrder = TEST_ORDER_SAMPLE,
  assets: AssetProvider = NO_ASSETS,
): readonly ResolvedPage[] {
  return resolver.resolve(documentWith(root), data, { catalog: TEST_ORDER_CATALOG, assets });
}

/** Mọi chuỗi text trong cây, theo thứ tự duyệt. */
function textsOf(node: ResolvedNode): readonly string[] {
  if (node.type === 'text') return [node.value];
  if (node.type === 'container') return node.children.flatMap(textsOf);
  return [];
}

function pageTexts(page: ResolvedPage): readonly string[] {
  if (page.status !== 'ok') throw new Error(`trang ${page.pageIndex} lỗi: ${page.message}`);
  return textsOf(page.node);
}

function itemLabel(): TemplateNode {
  return {
    type: 'repeat',
    id: 'items',
    collection: 'items',
    expand: 'quantity',
    maxItemsPerPage: 1,
    template: {
      type: 'text',
      id: 'label',
      content: [
        { var: 'itemName' },
        { text: ' ' },
        { var: '$position' },
        { text: '/' },
        { var: '$total' },
        { text: ' ly ' },
        { var: '$unit' },
        { text: '/' },
        { var: '$unitCount' },
      ],
    },
  };
}

describe('DocumentResolver — nội dung', () => {
  it('ghép segment chữ + biến, format mặc định theo kiểu và format khai báo', () => {
    const root: TemplateNode = {
      type: 'text',
      id: 'header',
      content: [
        { var: 'tableName' },
        { text: ' · ' },
        { var: 'createdAt', format: { type: 'datetime', pattern: 'HH:mm' } },
        { text: ' · giảm ' },
        { var: 'discount' },
      ],
    };

    expect(pageTexts(resolvePages(root)[0])).toEqual(['Bàn 5 · 10:30 · giảm 5.000đ']);
  });

  it('biến optional rỗng in chuỗi rỗng', () => {
    const root: TemplateNode = { type: 'text', id: 'table', content: [{ text: 'Bàn: ' }, { var: 'tableName' }] };
    const takeAway: TestOrder = { ...TEST_ORDER_SAMPLE, tableName: undefined };

    expect(pageTexts(resolvePages(root, takeAway)[0])).toEqual(['Bàn: ']);
  });

  it('biến bắt buộc rỗng thành trang lỗi có nodeId', () => {
    const root: TemplateNode = { type: 'text', id: 'code', content: [{ var: 'orderCode' }] };
    const noCode = { ...TEST_ORDER_SAMPLE, code: undefined } as unknown as TestOrder;

    expect(resolvePages(root, noCode)).toEqual([
      { status: 'error', pageIndex: 0, nodeId: 'code', message: 'biến "orderCode" không có giá trị' },
    ]);
  });

  it('giá trị không hợp format thành trang lỗi', () => {
    const root: TemplateNode = { type: 'text', id: 'time', content: [{ var: 'createdAt' }] };
    const badTime: TestOrder = { ...TEST_ORDER_SAMPLE, createdAt: 'hôm qua' };
    const [page] = resolvePages(root, badTime);

    expect(page.status).toBe('error');
    if (page.status === 'error') expect(page.message).toContain('biến "createdAt"');
  });

  it('barcode/QR dùng chung segment', () => {
    const root: TemplateNode = {
      type: 'container',
      id: 'root',
      children: [
        { type: 'barcode', id: 'barcode', content: [{ var: 'orderCode' }], symbology: 'code128' },
        { type: 'qrcode', id: 'qr', content: [{ text: 'https://ndt.vn/o/' }, { var: 'orderCode' }] },
      ],
    };
    const [page] = resolvePages(root);

    expect(page.status === 'ok' && page.node.type === 'container' && page.node.children).toEqual([
      { type: 'barcode', id: 'barcode', value: 'HD001', symbology: 'code128' },
      { type: 'qrcode', id: 'qr', value: 'https://ndt.vn/o/HD001' },
    ]);
  });
});

describe('DocumentResolver — scope tường minh', () => {
  it('biến collection dùng ngoài vòng lặp thành trang lỗi', () => {
    const root: TemplateNode = { type: 'text', id: 'name', content: [{ var: 'itemName' }] };

    expect(resolvePages(root)[0]).toMatchObject({ status: 'error', nodeId: 'name' });
  });

  it('biến gốc trong vòng lặp luôn đọc từ data gốc, không bị field trùng tên của phần tử che', () => {
    const lines = defineCollection({
      label: 'Dòng',
      get: (order: { readonly lines: readonly { readonly code: string }[] }) => order.lines,
      variables: { lineCode: { label: 'Mã dòng', type: 'string', get: (line) => line.code } },
    });
    const catalog = defineCatalog({
      id: 'shadow',
      version: 1,
      sample: { code: 'ORDER', lines: [{ code: 'LINE' }] },
      variables: { orderCode: { label: 'Mã đơn', type: 'string', get: (order) => order.code } },
      collections: { lines },
    });
    const template: TemplateDocument = {
      ...documentWith({
        type: 'repeat',
        id: 'lines',
        collection: 'lines',
        template: { type: 'text', id: 'text', content: [{ var: 'orderCode' }, { text: '/' }, { var: 'lineCode' }] },
      }),
      catalog: 'shadow',
    };

    const [page] = resolver.resolve(template, catalog.sample, { catalog, assets: NO_ASSETS });

    expect(pageTexts(page)).toEqual(['ORDER/LINE']);
  });

  it('collection lồng đọc từ phần tử của collection cha', () => {
    const root: TemplateNode = {
      type: 'repeat',
      id: 'items',
      collection: 'items',
      template: {
        type: 'repeat',
        id: 'toppings',
        collection: 'toppings',
        template: {
          type: 'text',
          id: 'topping',
          content: [{ var: 'itemName' }, { text: ' + ' }, { var: 'toppingName' }],
        },
      },
    };

    expect(pageTexts(resolvePages(root)[0])).toEqual(['Trà sữa + Trân châu']);
  });
});

describe('DocumentResolver — lặp, expand, phân trang', () => {
  it('expand mỗi ly 1 tem: $position/$total tính sau expand, $unit/$unitCount theo từng món', () => {
    const pages = resolvePages(itemLabel());

    expect(pages.map((page) => pageTexts(page)[0])).toEqual([
      'Trà sữa 1/5 ly 1/3',
      'Trà sữa 2/5 ly 2/3',
      'Trà sữa 3/5 ly 3/3',
      'Cà phê 4/5 ly 1/2',
      'Cà phê 5/5 ly 2/2',
    ]);
  });

  it('maxItemsPerPage áp dụng trên danh sách sau expand', () => {
    const root: TemplateNode = { ...itemLabel(), maxItemsPerPage: 2 } as TemplateNode;
    const pages = resolvePages(root);

    expect(pages.map((page) => pageTexts(page).length)).toEqual([2, 2, 1]);
  });

  it('$page/$pageCount dùng được ở mọi chỗ', () => {
    const root: TemplateNode = {
      type: 'container',
      id: 'root',
      children: [
        itemLabel(),
        {
          type: 'text',
          id: 'footer',
          content: [{ text: 'Trang ' }, { var: '$page' }, { text: '/' }, { var: '$pageCount' }],
        },
      ],
    };

    expect(resolvePages(root).map((page) => pageTexts(page)[1])).toEqual([
      'Trang 1/5',
      'Trang 2/5',
      'Trang 3/5',
      'Trang 4/5',
      'Trang 5/5',
    ]);
  });

  it('repeat không phân trang in mọi phần tử trên 1 trang', () => {
    const root: TemplateNode = {
      type: 'repeat',
      id: 'items',
      collection: 'items',
      template: { type: 'text', id: 'name', content: [{ var: 'itemName' }] },
    };

    expect(resolvePages(root).map(pageTexts)).toEqual([['Trà sữa', 'Cà phê']]);
  });

  it('repeat bị ẩn không tạo thêm trang', () => {
    const root: TemplateNode = { ...itemLabel(), visibleWhen: { op: 'eq', var: 'orderCode', value: 'KHÁC' } };

    expect(resolvePages(root)).toHaveLength(1);
  });

  it('expand không phải số nguyên dương thành trang lỗi', () => {
    const zeroQuantity: TestOrder = {
      ...TEST_ORDER_SAMPLE,
      items: [{ ...TEST_ORDER_SAMPLE.items[0], quantity: 0 }],
    };

    expect(resolvePages(itemLabel(), zeroQuantity)).toEqual([
      {
        status: 'error',
        pageIndex: 0,
        nodeId: 'items',
        message: 'expand "quantity" phải là số nguyên dương, nhận "0"',
      },
    ]);
  });

  it('collection không phải mảng thành trang lỗi thay vì throw', () => {
    const broken = { ...TEST_ORDER_SAMPLE, items: undefined } as unknown as TestOrder;

    expect(resolvePages(itemLabel(), broken)[0]).toMatchObject({ status: 'error', nodeId: 'items' });
  });

  it('1 phần tử expand sai chỉ làm lỗi đúng trang của nó, các trang khác vẫn in được', () => {
    const order: TestOrder = {
      ...TEST_ORDER_SAMPLE,
      items: [
        TEST_ORDER_SAMPLE.items[0],
        { ...TEST_ORDER_SAMPLE.items[1], name: 'Trà đá', quantity: 0 },
        TEST_ORDER_SAMPLE.items[1],
      ],
    };
    const pages = resolvePages(itemLabel(), order);

    expect(pages).toHaveLength(6);
    expect(pages.map((page) => page.status)).toEqual(['ok', 'ok', 'ok', 'error', 'ok', 'ok']);
    expect(pages[3]).toMatchObject({
      status: 'error',
      nodeId: 'items',
      message: 'expand "quantity" phải là số nguyên dương, nhận "0"',
    });
  });
});

describe('DocumentResolver — biến có sẵn dùng sai scope', () => {
  it('$position ở gốc (không trong repeat) thành trang lỗi', () => {
    const root: TemplateNode = { type: 'text', id: 'pos', content: [{ var: '$position' }] };

    expect(resolvePages(root)[0]).toEqual({
      status: 'error',
      pageIndex: 0,
      nodeId: 'pos',
      message: 'biến "$position" chỉ dùng được bên trong repeat',
    });
  });

  it('$unit trong repeat không có expand thành trang lỗi', () => {
    const root: TemplateNode = {
      type: 'repeat',
      id: 'items',
      collection: 'items',
      template: { type: 'text', id: 'unit', content: [{ var: '$unit' }] },
    };

    expect(resolvePages(root)[0]).toEqual({
      status: 'error',
      pageIndex: 0,
      nodeId: 'unit',
      message: 'biến "$unit" chỉ dùng được bên trong repeat có expand',
    });
  });

  it('$page ở gốc vẫn in bình thường', () => {
    const root: TemplateNode = { type: 'text', id: 'page', content: [{ var: '$page' }] };

    expect(pageTexts(resolvePages(root)[0])).toEqual(['1']);
  });
});

describe('DocumentResolver — điều kiện', () => {
  function visibleTextFor(condition: NonNullable<TemplateNode['visibleWhen']>): readonly string[] {
    const root: TemplateNode = { type: 'text', id: 'text', content: [{ text: 'X' }], visibleWhen: condition };
    return pageTexts(resolvePages(root)[0]);
  }

  it.each([
    [{ op: 'exists', var: 'tableName' }, ['X']],
    [{ op: 'notEmpty', var: 'tableName' }, ['X']],
    [{ op: 'eq', var: 'orderCode', value: 'HD001' }, ['X']],
    [{ op: 'neq', var: 'orderCode', value: 'HD001' }, []],
    [{ op: 'gt', var: 'discount', value: 0 }, ['X']],
    [{ op: 'gte', var: 'discount', value: 5000 }, ['X']],
    [{ op: 'lt', var: 'discount', value: 5000 }, []],
    [{ op: 'lte', var: 'discount', value: 4999 }, []],
    [{ op: 'gt', var: 'orderCode', value: 0 }, []],
    [{ op: 'and', conditions: [{ op: 'exists', var: 'tableName' }, { op: 'gt', var: 'discount', value: 0 }] }, ['X']],
    [{ op: 'or', conditions: [{ op: 'lt', var: 'discount', value: 0 }, { op: 'exists', var: 'orderCode' }] }, ['X']],
    [{ op: 'not', condition: { op: 'exists', var: 'tableName' } }, []],
  ] as const)('%j', (condition, expected) => {
    expect(visibleTextFor(condition)).toEqual(expected);
  });

  it('notEmpty sai với chuỗi rỗng, exists đúng', () => {
    const emptyTable: TestOrder = { ...TEST_ORDER_SAMPLE, tableName: '' };
    const root: TemplateNode = {
      type: 'container',
      id: 'root',
      children: [
        { type: 'text', id: 'a', content: [{ text: 'exists' }], visibleWhen: { op: 'exists', var: 'tableName' } },
        { type: 'text', id: 'b', content: [{ text: 'notEmpty' }], visibleWhen: { op: 'notEmpty', var: 'tableName' } },
      ],
    };

    expect(pageTexts(resolvePages(root, emptyTable)[0])).toEqual(['exists']);
  });
});

describe('DocumentResolver — ảnh', () => {
  it('tra bitmap theo mã asset lấy từ biến', () => {
    const root: TemplateNode = { type: 'image', id: 'logo', source: { var: 'storeLogo' } };
    const [page] = resolvePages(root, TEST_ORDER_SAMPLE, LOGO_ASSETS);

    expect(page).toEqual({ status: 'ok', pageIndex: 0, node: { type: 'image', id: 'logo', bitmap: LOGO_BITMAP } });
  });

  it('biến ảnh optional rỗng thì bỏ qua ảnh', () => {
    const root: TemplateNode = {
      type: 'container',
      id: 'root',
      children: [{ type: 'image', id: 'logo', source: { var: 'storeLogo' } }],
    };
    const noLogo: TestOrder = { ...TEST_ORDER_SAMPLE, storeLogo: undefined };
    const [page] = resolvePages(root, noLogo, LOGO_ASSETS);

    expect(page.status === 'ok' && page.node.type === 'container' && page.node.children).toEqual([]);
  });

  it('thiếu asset chỉ làm lỗi đúng trang cần ảnh đó, trang khác vẫn in được', () => {
    const root: TemplateNode = {
      ...itemLabel(),
      template: {
        type: 'container',
        id: 'item',
        children: [
          { type: 'text', id: 'name', content: [{ var: 'itemName' }] },
          {
            type: 'image',
            id: 'coffee-icon',
            source: { asset: 'coffee@v1' },
            visibleWhen: { op: 'eq', var: 'itemName', value: 'Cà phê' },
          },
        ],
      },
    } as TemplateNode;

    const statuses = resolvePages(root).map((page) => page.status);

    expect(statuses).toEqual(['ok', 'ok', 'ok', 'error', 'error']);
  });
});

describe('DocumentResolver — catalog', () => {
  it('throw khi template dùng catalog khác catalog truyền vào', () => {
    const template = { ...documentWith({ type: 'text', id: 't', content: [] }), catalog: 'kitchen' };

    const options = { catalog: TEST_ORDER_CATALOG, assets: NO_ASSETS };

    expect(() => resolver.resolve(template, TEST_ORDER_SAMPLE, options)).toThrow(
      'Template dùng catalog "kitchen", không phải "test-order"',
    );
  });
});
