import type { PrinterProfile } from '../PrinterProfile';

export const SATO_PROFILES: Record<string, PrinterProfile> = {
  'sato-cl4nx': {
    name: 'SATO CL4NX',
    vendor: 'SATO',
    language: 'sbpl',
    paperWidth: 104,
    dotsPerLine: 832,
    dpi: 203,
    charsPerLine: 0,
    features: {
      cutter: 'full',
      cashDrawer: false,
      imageMode: ['raster'],
      cjk: true,
      nativeUtf8: false,
      codePages: [],
    },
  },
};
