import type { PrinterProfile } from '../PrinterProfile';

export const GENERIC_PROFILES: Record<string, PrinterProfile> = {
  'generic-58mm': {
    name: 'Generic 58mm',
    vendor: 'Generic',
    language: 'escpos',
    paperWidth: 58,
    dotsPerLine: 384,
    dpi: 203,
    charsPerLine: 32,
    features: {
      cutter: 'none',
      cashDrawer: false,
      imageMode: ['raster'],
      cjk: false,
      nativeUtf8: false,
      codePages: [0],
    },
  },
  'generic-80mm': {
    name: 'Generic 80mm',
    vendor: 'Generic',
    language: 'escpos',
    paperWidth: 80,
    dotsPerLine: 576,
    dpi: 203,
    charsPerLine: 48,
    features: {
      cutter: 'partial',
      cashDrawer: true,
      imageMode: ['raster'],
      cjk: false,
      nativeUtf8: false,
      codePages: [0, 16],
    },
  },
};
