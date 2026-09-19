import { image } from '../ImageBuilder';
import { BuildContext } from '../BuildContext';
import { TemplateNodeIdGenerator } from '../BuildContext';
import type { Bitmap } from '../../../types';

describe('ImageBuilder', () => {
  const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
  const bitmap: Bitmap = { width: 1, height: 1, data: new Uint8Array([0]), bytesPerRow: 1 };

  it('image.bitmap(source) sets `bitmap`', () => {
    const node = image.bitmap(bitmap).build(context);
    expect(node.bitmap).toBe(bitmap);
    expect(node.binding).toBeUndefined();
  });

  it('image.binding(path) sets `binding`', () => {
    const node = image.binding('product.logo').build(context);
    expect(node.binding).toBe('product.logo');
    expect(node.bitmap).toBeUndefined();
  });
});
