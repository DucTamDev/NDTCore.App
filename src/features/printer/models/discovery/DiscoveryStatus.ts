/** Trạng thái của một lần tìm thiết bị. */
export const DiscoveryStatus = {
  /** Đang quét. */
  Loading: 'Loading',

  /** Tìm thấy ít nhất một thiết bị. */
  Found: 'Found',

  /** Quét xong nhưng không có thiết bị nào. */
  Empty: 'Empty',

  /** Không quét được (thiếu quyền, Bluetooth tắt...). */
  Error: 'Error',
} as const;

export type DiscoveryStatus = (typeof DiscoveryStatus)[keyof typeof DiscoveryStatus];
