import {
  getLayoutMode,
  TABLET_MIN_DP,
} from './useLayoutMode';

describe('getLayoutMode', () => {
  describe('tablet layout', () => {
    it('returns tablet-landscape for a wide tablet viewport', () => {
      expect(getLayoutMode(1280, 800)).toBe('tablet-landscape');
    });

    it('returns tablet-portrait for a tall tablet viewport', () => {
      expect(getLayoutMode(800, 1280)).toBe('tablet-portrait');
    });

    it('returns tablet-portrait for a square tablet viewport', () => {
      expect(getLayoutMode(600, 600)).toBe('tablet-portrait');
    });

    it('returns tablet-landscape when the shortest side equals the tablet threshold', () => {
      expect(getLayoutMode(800, TABLET_MIN_DP)).toBe(
        'tablet-landscape',
      );
    });

    it('returns tablet-landscape when the shortest side is above the tablet threshold', () => {
      expect(getLayoutMode(960, TABLET_MIN_DP + 1)).toBe(
        'tablet-landscape',
      );
    });
  });

  describe('phone layout', () => {
    it('returns phone when the shortest side is below the tablet threshold', () => {
      expect(getLayoutMode(TABLET_MIN_DP - 1, 800)).toBe('phone');
    });

    it('returns phone for a portrait phone viewport', () => {
      expect(getLayoutMode(360, 800)).toBe('phone');
    });

    it('returns phone for a landscape phone viewport', () => {
      expect(getLayoutMode(800, 360)).toBe('phone');
    });
  });

  describe('tablet boundary', () => {
    it('treats the exact tablet threshold as a tablet', () => {
      expect(
        getLayoutMode(TABLET_MIN_DP, TABLET_MIN_DP),
      ).toBe('tablet-portrait');
    });

    it('treats one dp below the threshold as a phone', () => {
      expect(
        getLayoutMode(TABLET_MIN_DP - 1, TABLET_MIN_DP),
      ).toBe('phone');
    });
  });
});
