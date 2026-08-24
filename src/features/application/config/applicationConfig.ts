import type { ApplicationMenuKey } from '../store/applicationSlice';

export interface ApplicationMenuItem {
  key: ApplicationMenuKey;
  icon: string;
  label: string;
  group: 'device' | 'app';
  disabled?: boolean;
}

export const DEFAULT_TABLET_MENU_KEY: ApplicationMenuKey = 'printer';

export const applicationMenuItems: ApplicationMenuItem[] = [
  { key: 'printer', icon: 'printer', label: 'Quản lý máy in', group: 'device' },
  { key: 'scanner', icon: 'barcode-scan', label: 'Máy quét mã vạch', group: 'device', disabled: true },
  { key: 'orderHistory', icon: 'receipt-text-clock-outline', label: 'Đơn hàng hôm nay', group: 'app' },
  { key: 'account', icon: 'account', label: 'Tài khoản', group: 'app', disabled: true },
  { key: 'language', icon: 'translate', label: 'Ngôn ngữ', group: 'app', disabled: true },
  { key: 'sync', icon: 'cloud-outline', label: 'Đồng bộ dữ liệu', group: 'app', disabled: true },
  { key: 'info', icon: 'information-outline', label: 'Về ứng dụng', group: 'app', disabled: true },
];
