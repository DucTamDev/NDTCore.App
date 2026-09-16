import type { PrinterProfile } from '../PrinterProfile';

export const CITIZEN_PROFILES: Record<string, PrinterProfile> = {
  'citizen-ct-s310ii': {
    name: 'Citizen CT-S310II',
    vendor: 'Citizen',
    language: 'escpos',
    paperWidth: 80,
    dotsPerLine: 576,
    dpi: 203,
    charsPerLine: 48,
    usbVendorId: 0x1d90,
    features: {
      cutter: 'partial',
      cashDrawer: true,
      imageMode: ['raster', 'column'],
      cjk: false,
      nativeUtf8: false,
      codePages: [0, 16, 17],
    },
  },
};
