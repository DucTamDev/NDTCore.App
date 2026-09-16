import type { PrinterProfile } from '../PrinterProfile';

export const STAR_PROFILES: Record<string, PrinterProfile> = {
  'star-tsp143': {
    name: 'Star TSP143',
    vendor: 'Star Micronics',
    language: 'starprnt',
    paperWidth: 80,
    dotsPerLine: 576,
    dpi: 203,
    charsPerLine: 48,
    usbVendorId: 0x0519,
    features: {
      cutter: 'partial',
      cashDrawer: true,
      imageMode: ['raster'],
      cjk: false,
      nativeUtf8: false,
      codePages: [],
    },
  },
  'star-tsp100': {
    name: 'Star TSP100',
    vendor: 'Star Micronics',
    language: 'starprnt',
    paperWidth: 80,
    dotsPerLine: 576,
    dpi: 203,
    charsPerLine: 48,
    usbVendorId: 0x0519,
    features: {
      cutter: 'partial',
      cashDrawer: true,
      imageMode: ['raster'],
      cjk: false,
      nativeUtf8: false,
      codePages: [],
    },
  },
};
