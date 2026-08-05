import { useWindowDimensions } from 'react-native';

export type SalesLayoutMode = 'tablet-landscape' | 'tablet-portrait' | 'phone';

export const TABLET_MIN_DP = 600;

export function getSalesLayoutMode(width: number, height: number): SalesLayoutMode {
  const isTablet = Math.min(width, height) >= TABLET_MIN_DP;
  if (!isTablet) {
    return 'phone';
  }
  return width > height ? 'tablet-landscape' : 'tablet-portrait';
}

export function useSalesLayoutMode(): SalesLayoutMode {
  const { width, height } = useWindowDimensions();
  return getSalesLayoutMode(width, height);
}
