import { fixed, image, mm } from '..';
import { TemplateNodeIdGenerator, type BuildContext } from '../BuildContext';

function newContext(): BuildContext {
  return { idGenerator: new TemplateNodeIdGenerator() };
}

describe('image', () => {
  it('nguồn biến chỉ giữ tên biến (bỏ format của segment)', () => {
    const node = image({ var: 'storeLogo', format: { type: 'text' } }).build(newContext());

    expect(node).toEqual({ type: 'image', id: 'image-1', source: { var: 'storeLogo' } });
  });

  it('nguồn asset tĩnh giữ mã asset', () => {
    const node = image({ asset: 'icon-cup@v2' }).width(fixed(mm(10))).build(newContext());

    expect(node).toEqual({
      type: 'image',
      id: 'image-1',
      source: { asset: 'icon-cup@v2' },
      style: { width: fixed(mm(10)) },
    });
  });
});
