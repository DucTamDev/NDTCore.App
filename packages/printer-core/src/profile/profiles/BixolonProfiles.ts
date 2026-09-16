import type { PrinterProfile } from '../PrinterProfile';

export const BIXOLON_PROFILES: Record<string, PrinterProfile> = {
  'bixolon-srp-350': {
    name: 'Bixolon SRP-350',
    vendor: 'Bixolon',
    language: 'escpos',
    paperWidth: 80,
    dotsPerLine: 576,
    dpi: 203,
    charsPerLine: 48,
    usbVendorId: 0x1504,
    features: {
      cutter: 'partial',
      cashDrawer: true,
      imageMode: ['raster'],
      cjk: false,
      nativeUtf8: false,
      codePages: [0, 16, 17],
    },
  },
};
