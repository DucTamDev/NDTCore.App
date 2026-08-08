import { useWindowDimensions } from 'react-native';

export type SalesLayoutMode = 'tablet-landscape' | 'tablet-portrait' | 'phone';

// useWindowDimensions() trả vùng nội dung sau khi Android đã trừ status bar +
// nav bar, không phải kích thước màn hình vật lý — một tablet vật lý đúng
// 600dp có thể còn dưới 600dp ở đây. Hạ ngưỡng để tablet nhỏ sát biên (7-8
// inch) không bị tính nhầm thành phone.
export const TABLET_MIN_DP = 560;

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
