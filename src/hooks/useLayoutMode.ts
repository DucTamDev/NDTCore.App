import { useWindowDimensions } from 'react-native';

export type LayoutMode =
  | 'tablet-landscape'
  | 'tablet-portrait'
  | 'phone';

/** Minimum shortest-side size in dp to classify the device as a tablet. */
export const TABLET_MIN_DP = 500;

/**
 * Determines the layout mode from the current window dimensions.
 * The shortest side is recalculated whenever the window size changes.
 */
export function getLayoutMode(
  width: number,
  height: number,
): LayoutMode {
  const shortestSide = Math.min(width, height);

  if (shortestSide < TABLET_MIN_DP) {
    return 'phone';
  }

  return width > height
    ? 'tablet-landscape'
    : 'tablet-portrait';
}

/**
 * Returns the current layout mode based on the window dimensions.
 * Recalculates when the window size changes.
 */
export function useLayoutMode(): LayoutMode {
  const { width, height } = useWindowDimensions();

  return getLayoutMode(width, height);
}
