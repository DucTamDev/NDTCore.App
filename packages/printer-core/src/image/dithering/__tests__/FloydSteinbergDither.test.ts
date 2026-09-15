import { ditherFloydSteinberg } from '../FloydSteinbergDither';

describe('ditherFloydSteinberg', () => {
  it('produces only 0 or 255 per pixel', () => {
    const gray = new Uint8Array([10, 200, 128, 60]);
    const result = ditherFloydSteinberg(gray, 2, 2);
    result.forEach((v) => expect([0, 255]).toContain(v));
  });

  it('preserves pixel count', () => {
    const gray = new Uint8Array(16).fill(128);
    expect(ditherFloydSteinberg(gray, 4, 4)).toHaveLength(16);
  });
});
