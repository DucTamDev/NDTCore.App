/** Connection settings for a USB printer transport. */
export interface USBConfig {
  vendorId: number;
  productId?: number;
  interfaceNumber?: number;
  endpointNumber?: number;
}

/** Well-known USB vendor IDs for thermal printer manufacturers. */
export const USB_VENDOR_IDS: Record<string, number> = {
  epson: 0x04b8,
  star: 0x0519,
  citizen: 0x1d90,
  bixolon: 0x1504,
  zebra: 0x0a5f,
  tsc: 0x1203,
  hprt: 0x6868,
  snbc: 0x0dd4,
};
