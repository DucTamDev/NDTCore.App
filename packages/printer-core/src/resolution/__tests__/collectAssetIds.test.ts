import { collectAssetIds } from '..';
import type { TemplateDocument } from '../../template';
import { TEST_ORDER_DATA, TEST_ORDER_SAMPLE } from '../../testing';

const TEMPLATE: TemplateDocument = {
  schemaVersion: 1,
  id: 'template',
  name: 'Template',
  dataId: 'test-order',
  media: 'receipt',
  locale: 'vi-VN',
  paper: { widthMm: 72 },
  root: {
    type: 'container',
    id: 'root',
    children: [
      { type: 'image', id: 'logo', source: { var: 'storeLogo' } },
      {
        type: 'image',
        id: 'hidden-icon',
        source: { asset: 'icon@v1' },
        visibleWhen: { op: 'eq', var: 'orderCode', value: 'X' },
      },
      {
        type: 'repeat',
        id: 'items',
        collection: 'items',
        template: { type: 'image', id: 'cup', source: { asset: 'cup@v2' } },
      },
      { type: 'image', id: 'logo-again', source: { var: 'storeLogo' } },
    ],
  },
};

describe('collectAssetIds', () => {
  it('thu asset tĩnh + giá trị biến asset, bỏ qua điều kiện ẩn/hiện, không trùng lặp', () => {
    expect(collectAssetIds(TEMPLATE, TEST_ORDER_DATA, TEST_ORDER_SAMPLE)).toEqual([
      'store-logo@v1',
      'icon@v1',
      'cup@v2',
    ]);
  });

  it('bỏ qua biến asset rỗng', () => {
    const noLogo = { ...TEST_ORDER_SAMPLE, storeLogo: undefined };

    expect(collectAssetIds(TEMPLATE, TEST_ORDER_DATA, noLogo)).toEqual(['icon@v1', 'cup@v2']);
  });
});
