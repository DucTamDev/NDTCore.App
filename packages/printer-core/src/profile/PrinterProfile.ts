import type { PrinterLanguage } from '../core/PrinterLanguage';
import type { PrinterVendor } from './PrinterVendor';

export type CutterType = 'none' | 'partial' | 'full';

export type ImageMode = 'raster' | 'column' | 'nvGraphics';

export interface PrinterProfile {
  name: string;
  vendor: PrinterVendor;
  language: PrinterLanguage;
  paperWidth: number;
  dotsPerLine: number;
  dpi: number;
  charsPerLine: number;
  usbVendorId?: number;
  usbProductId?: number;
  features: {
    cutter: CutterType;
    cashDrawer: boolean;
    imageMode: ImageMode[];
    cjk: boolean;
    nativeUtf8: boolean;
    codePages: number[];
  };
}
