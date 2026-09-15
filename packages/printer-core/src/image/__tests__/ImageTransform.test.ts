import { imageToMonochrome } from '../ImageTransform';

describe('imageToMonochrome', () => {
  it('packs a 8x1 white image into 1 all-1-bits byte per row', () => {
    const rgba = new Uint8Array(8 * 4).fill(255); // 8 white pixels, RGBA
    const bitmap = imageToMonochrome(rgba, 8, 1, { dither: 'threshold', threshold: 128 });
    expect(bitmap.width).toBe(8);
    expect(bitmap.bytesPerRow).toBe(1);
  });
});
