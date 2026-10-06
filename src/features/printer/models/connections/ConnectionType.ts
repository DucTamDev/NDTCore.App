/** Đường truyền tới máy in. */
export const ConnectionType = {
  Usb: 'Usb',
  Bluetooth: 'Bluetooth',
  Lan: 'Lan',
} as const;

export type ConnectionType = (typeof ConnectionType)[keyof typeof ConnectionType];
