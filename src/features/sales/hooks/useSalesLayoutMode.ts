import { useWindowDimensions } from 'react-native';

export type SalesLayoutMode =
  | 'tablet-landscape'
  | 'tablet-portrait'
  | 'phone';

/**
 * Minimum shortest-side window size in dp to treat the device as a tablet.
 *
 * Android reports window dimensions in dp (logical pixels), not physical pixels.
 * For example, a 1280×800 physical screen with density 2 can be reported as
 * approximately 640×400 dp.
 *
 * 430dp allows smaller 7–8 inch POS/tablet devices to be recognized as tablets
 * while staying above the shortest-side dp of large phones (e.g. Pixel 6/7/8
 * report ~412dp), which would otherwise be misclassified as tablets.
 */
export const TABLET_MIN_DP = 430;

export function getSalesLayoutMode(
  width: number,
  height: number,
): SalesLayoutMode {
  const shortestSide = Math.min(width, height);
  const isTablet = shortestSide >= TABLET_MIN_DP;

  if (!isTablet) {
    return 'phone';
  }

  return width > height
    ? 'tablet-landscape'
    : 'tablet-portrait';
}

export function useSalesLayoutMode(): SalesLayoutMode {
  const { width, height } = useWindowDimensions();

  return getSalesLayoutMode(width, height);
}
