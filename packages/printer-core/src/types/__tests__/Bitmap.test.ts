import type { Bitmap } from '../Bitmap';

describe('Bitmap', () => {
  it('describes a 1-bit packed row-major bitmap', () => {
    const bitmap: Bitmap = { data: new Uint8Array([0xff, 0x00]), width: 16, height: 1, bytesPerRow: 2 };
    expect(bitmap.bytesPerRow).toBe(Math.ceil(bitmap.width / 8));
  });
});
