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
});
