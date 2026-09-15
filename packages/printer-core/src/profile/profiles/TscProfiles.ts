import type { PrinterProfile } from '../PrinterProfile';

export const TSC_PROFILES: Record<string, PrinterProfile> = {
  'tsc-te200': {
    name: 'TSC TE200',
    vendor: 'TSC',
    language: 'tsc',
    paperWidth: 108,
    dotsPerLine: 832,
    dpi: 203,
    charsPerLine: 0,
    usbVendorId: 0x1203,
    features: {
      cutter: 'none',
      cashDrawer: false,
      imageMode: ['raster'],
      cjk: true,
      nativeUtf8: false,
      codePages: [],
    },
  },
  'tsc-te310': {
    name: 'TSC TE310',
    vendor: 'TSC',
    language: 'tsc',
    paperWidth: 108,
    dotsPerLine: 1276,
    dpi: 300,
    charsPerLine: 0,
    usbVendorId: 0x1203,
    features: {
      cutter: 'none',
      cashDrawer: false,
      imageMode: ['raster'],
      cjk: true,
      nativeUtf8: false,
      codePages: [],
    },
  },
};
