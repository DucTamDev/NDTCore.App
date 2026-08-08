import { getSalesLayoutMode } from './useSalesLayoutMode';

describe('getSalesLayoutMode', () => {
  it('returns tablet-landscape for a wide tablet-sized viewport', () => {
    expect(getSalesLayoutMode(1280, 800)).toBe('tablet-landscape');
  });

  it('returns tablet-portrait for a tall tablet-sized viewport', () => {
    expect(getSalesLayoutMode(800, 1280)).toBe('tablet-portrait');
  });

  it('returns phone for a portrait viewport below the tablet threshold', () => {
    expect(getSalesLayoutMode(360, 800)).toBe('phone');
  });

  it('returns phone for a landscape viewport below the tablet threshold', () => {
    expect(getSalesLayoutMode(800, 360)).toBe('phone');
  });

  it('returns tablet-portrait for a square tablet-sized viewport (ties resolve to portrait)', () => {
    expect(getSalesLayoutMode(600, 600)).toBe('tablet-portrait');
  });

  it('returns tablet-landscape for a small physical tablet whose usable window drops below 600dp after system bars', () => {
    // Ví dụ thật: AVD "Small Tablet" 960x600dp vật lý, sau khi Android trừ
    // status bar + nav bar, useWindowDimensions() thực nhận 960x568dp.
    expect(getSalesLayoutMode(960, 568)).toBe('tablet-landscape');
  });
});
