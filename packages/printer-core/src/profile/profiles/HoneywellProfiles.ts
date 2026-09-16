import type { PrinterProfile } from '../PrinterProfile';

export const HONEYWELL_PROFILES: Record<string, PrinterProfile> = {
  'honeywell-pc42t': {
    name: 'Honeywell PC42t',
    vendor: 'Honeywell',
    language: 'dpl',
    paperWidth: 108,
    dotsPerLine: 832,
    dpi: 203,
    charsPerLine: 0,
    features: {
      cutter: 'none',
      cashDrawer: false,
      imageMode: ['raster'],
      cjk: false,
      nativeUtf8: false,
      codePages: [],
    },
  },
};
