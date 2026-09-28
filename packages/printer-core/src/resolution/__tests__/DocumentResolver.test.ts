import { createDocumentResolver, type AssetProvider, type ResolvedNode, type ResolvedPage } from '..';
import { defineTemplateData, defineCollection } from '../../template/data';
import type { TemplateDocument, TemplateMedia, TemplateNode, TextNode } from '../../template';
import {
  TEST_ORDER_DATA,
  TEST_ORDER_SAMPLE,
  type TestOrder,
  type TestOrderItem,
  type TestTopping,
} from '../../testing';
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
  return resolver.resolve(documentWith(root), data, { catalog: TEST_ORDER_DATA, assets });
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
    const catalog = defineTemplateData({
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

  it('repeat phân trang cạnh 1 repeat không phân trang: mọi trang đều có đủ danh sách không phân trang', () => {
    const root: TemplateNode = {
      type: 'container',
      id: 'root',
      children: [
        itemLabel(),
        {
          type: 'repeat',
          id: 'names',
          collection: 'items',
          template: { type: 'text', id: 'name', content: [{ var: 'itemName' }] },
        },
      ],
    };
    const pages = resolvePages(root);

    expect(pages).toHaveLength(5);
    pages.forEach((page) => expect(pageTexts(page).slice(-2)).toEqual(['Trà sữa', 'Cà phê']));
  });

  it('2 repeat phân trang cạnh nhau: số trang = max của cả 2', () => {
    const root: TemplateNode = {
      type: 'container',
      id: 'root',
      children: [
        { ...itemLabel(), maxItemsPerPage: 2 } as TemplateNode,
        {
          type: 'repeat',
          id: 'names',
          collection: 'items',
          maxItemsPerPage: 1,
          template: { type: 'text', id: 'name', content: [{ var: 'itemName' }] },
        },
      ],
    };

    expect(resolvePages(root)).toHaveLength(3);
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

function toppingsOf(count: number): readonly TestTopping[] {
  return Array.from({ length: count }, (_, index) => ({ name: `T${index + 1}`, price: 5000 }));
}

function drink(
  name: string,
  quantity: number,
  toppingCount: number,
): TestOrderItem {
  return { name, quantity, price: 45000, toppings: toppingsOf(toppingCount) };
}

function orderWith(items: readonly TestOrderItem[]): TestOrder {
  return { ...TEST_ORDER_SAMPLE, items };
}

function toppingRepeat(id: string, toppingsPerPart: number): TemplateNode {
  return {
    type: 'repeat',
    id,
    collection: 'toppings',
    maxItemsPerPage: toppingsPerPart,
    template: {
      type: 'text',
      id: `${id}-name`,
      content: [{ var: 'toppingName' }, { text: ' ' }, { var: '$position' }, { text: '/' }, { var: '$total' }],
    },
  };
}

/** Tem món: mỗi ly 1 tem, topping tách theo `toppingsPerPart`, dòng cuối là phần tem. */
function toppingLabel(partRepeats: readonly TemplateNode[] = [toppingRepeat('toppings', 4)]): TemplateNode {
  return {
    type: 'repeat',
    id: 'items',
    collection: 'items',
    expand: 'quantity',
    maxItemsPerPage: 1,
    template: {
      type: 'container',
      id: 'item',
      children: [
        {
          type: 'text',
          id: 'name',
          content: [{ var: 'itemName' }, { text: ' ' }, { var: '$unit' }, { text: '/' }, { var: '$unitCount' }],
        },
        ...partRepeats,
        {
          type: 'text',
          id: 'part',
          content: [{ text: 'phần ' }, { var: '$part' }, { text: '/' }, { var: '$partCount' }],
        },
      ],
    },
  };
}

describe('DocumentResolver — tách repeat lồng sang nhiều tem', () => {
  it('9 topping, mỗi tem 4 → 3 tem nhóm 4/4/1, $position tuyệt đối, $part/$partCount theo phần', () => {
    const pages = resolvePages(toppingLabel(), orderWith([drink('Trà sữa', 1, 9)]));

    expect(pages.map(pageTexts)).toEqual([
      ['Trà sữa 1/1', 'T1 1/9', 'T2 2/9', 'T3 3/9', 'T4 4/9', 'phần 1/3'],
      ['Trà sữa 1/1', 'T5 5/9', 'T6 6/9', 'T7 7/9', 'T8 8/9', 'phần 2/3'],
      ['Trà sữa 1/1', 'T9 9/9', 'phần 3/3'],
    ]);
  });

  it('số topping chia hết cho N thì không sinh tem rỗng', () => {
    const pages = resolvePages(toppingLabel(), orderWith([drink('Trà sữa', 1, 8)]));

    expect(pages.map((page) => pageTexts(page).at(-1))).toEqual(['phần 1/2', 'phần 2/2']);
  });

  it('món số lượng 2 lặp đủ các phần cho từng ly; $page đánh số liên tục', () => {
    const root: TemplateNode = {
      type: 'container',
      id: 'root',
      children: [
        { type: 'text', id: 'page', content: [{ var: '$page' }, { text: '/' }, { var: '$pageCount' }] },
        toppingLabel(),
      ],
    };

    const pages = resolvePages(root, orderWith([drink('Trà sữa', 2, 5)]));

    expect(pages.map(pageTexts)).toEqual([
      ['1/4', 'Trà sữa 1/2', 'T1 1/5', 'T2 2/5', 'T3 3/5', 'T4 4/5', 'phần 1/2'],
      ['2/4', 'Trà sữa 1/2', 'T5 5/5', 'phần 2/2'],
      ['3/4', 'Trà sữa 2/2', 'T1 1/5', 'T2 2/5', 'T3 3/5', 'T4 4/5', 'phần 1/2'],
      ['4/4', 'Trà sữa 2/2', 'T5 5/5', 'phần 2/2'],
    ]);
  });

  it('món không có topping vẫn in 1 tem, $part/$partCount là 1/1', () => {
    const pages = resolvePages(toppingLabel(), orderWith([drink('Cà phê', 1, 0)]));

    expect(pages.map(pageTexts)).toEqual([['Cà phê 1/1', 'phần 1/1']]);
  });

  it('nhiều món có số phần khác nhau xếp theo thứ tự món rồi tới phần', () => {
    const pages = resolvePages(toppingLabel(), orderWith([drink('Trà sữa', 1, 5), drink('Cà phê', 1, 1)]));

    expect(pages.map((page) => [pageTexts(page)[0], pageTexts(page).at(-1)])).toEqual([
      ['Trà sữa 1/1', 'phần 1/2'],
      ['Trà sữa 1/1', 'phần 2/2'],
      ['Cà phê 1/1', 'phần 1/1'],
    ]);
  });

  it('2 repeat lồng trong cùng món: số phần theo repeat dài nhất, repeat ngắn rỗng ở phần dư', () => {
    const root = toppingLabel([toppingRepeat('by-two', 2), toppingRepeat('by-four', 4)]);

    const pages = resolvePages(root, orderWith([drink('Trà sữa', 1, 5)]));

    expect(pages.map(pageTexts)).toEqual([
      ['Trà sữa 1/1', 'T1 1/5', 'T2 2/5', 'T1 1/5', 'T2 2/5', 'T3 3/5', 'T4 4/5', 'phần 1/3'],
      ['Trà sữa 1/1', 'T3 3/5', 'T4 4/5', 'T5 5/5', 'phần 2/3'],
      ['Trà sữa 1/1', 'T5 5/5', 'phần 3/3'],
    ]);
  });

  it('món expand lỗi chỉ làm lỗi đúng 1 trang của nó, món khác vẫn tách tem', () => {
    const pages = resolvePages(toppingLabel(), orderWith([drink('Trà sữa', 0, 5), drink('Cà phê', 1, 5)]));

    expect(pages.map((page) => page.status)).toEqual(['error', 'ok', 'ok']);
    expect(pages.slice(1).map((page) => pageTexts(page).at(-1))).toEqual(['phần 1/2', 'phần 2/2']);
  });

  it('repeat lồng nằm trong node đang bị ẩn vẫn được đếm phần, chỉ không in topping', () => {
    const hiddenToppings: TemplateNode = {
      type: 'container',
      id: 'hidden',
      visibleWhen: { op: 'eq', var: 'itemName', value: 'không có món này' },
      children: [toppingRepeat('toppings', 4)],
    };

    const pages = resolvePages(toppingLabel([hiddenToppings]), orderWith([drink('Trà sữa', 1, 5)]));

    expect(pages.map(pageTexts)).toEqual([
      ['Trà sữa 1/1', 'phần 1/2'],
      ['Trà sữa 1/1', 'phần 2/2'],
    ]);
  });

  it('repeat ngoài cùng khác dài hơn thì các trang dư không in món tách tem, $part về 1/1', () => {
    const root: TemplateNode = {
      type: 'container',
      id: 'root',
      children: [
        { type: 'text', id: 'root-part', content: [{ var: '$part' }, { text: '/' }, { var: '$partCount' }] },
        {
          type: 'repeat',
          id: 'items',
          collection: 'items',
          maxItemsPerPage: 1,
          template: {
            type: 'container',
            id: 'item',
            children: [{ type: 'text', id: 'name', content: [{ var: 'itemName' }] }, toppingRepeat('toppings', 2)],
          },
        },
        {
          type: 'repeat',
          id: 'units',
          collection: 'items',
          expand: 'quantity',
          maxItemsPerPage: 1,
          template: { type: 'text', id: 'unit', content: [{ text: 'ly ' }, { var: '$unit' }] },
        },
      ],
    };

    const pages = resolvePages(root, orderWith([drink('Trà sữa', 3, 3)]));

    expect(pages.map(pageTexts)).toEqual([
      ['1/2', 'Trà sữa', 'T1 1/3', 'T2 2/3', 'ly 1'],
      ['2/2', 'Trà sữa', 'T3 3/3', 'ly 2'],
      ['1/1', 'ly 3'],
    ]);
  });

  it('repeat ngoài không phân trang thì repeat lồng in đủ topping (template chưa qua validate)', () => {
    const root: TemplateNode = {
      type: 'repeat',
      id: 'items',
      collection: 'items',
      template: toppingRepeat('toppings', 2),
    };

    const pages = resolvePages(root, orderWith([drink('Trà sữa', 1, 3)]));

    expect(pages.map(pageTexts)).toEqual([['T1 1/3', 'T2 2/3', 'T3 3/3']]);
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

  it('$part/$partCount dùng được ở mọi chỗ, là 1/1 khi không tách tem', () => {
    const partContent: TextNode['content'] = [{ var: '$part' }, { text: '/' }, { var: '$partCount' }];
    const root: TemplateNode = {
      type: 'container',
      id: 'root',
      children: [
        { type: 'text', id: 'part', content: partContent },
        {
          type: 'repeat',
          id: 'items',
          collection: 'items',
          expand: 'quantity',
          maxItemsPerPage: 1,
          template: { type: 'text', id: 'item-part', content: partContent },
        },
      ],
    };

    expect(resolvePages(root).map(pageTexts)).toEqual(Array.from({ length: 5 }, () => ['1/1', '1/1']));
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

  it('biến ảnh optional chuỗi rỗng cũng bỏ qua ảnh', () => {
    const root: TemplateNode = {
      type: 'container',
      id: 'root',
      children: [{ type: 'image', id: 'logo', source: { var: 'storeLogo' } }],
    };
    const emptyLogo: TestOrder = { ...TEST_ORDER_SAMPLE, storeLogo: '' };
    const [page] = resolvePages(root, emptyLogo, LOGO_ASSETS);

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

    const options = { catalog: TEST_ORDER_DATA, assets: NO_ASSETS };

    expect(() => resolver.resolve(template, TEST_ORDER_SAMPLE, options)).toThrow(
      'Template dùng catalog "kitchen", không phải "test-order"',
    );
  });
});
