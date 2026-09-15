import type { Bitmap } from '../types';
import type { BarcodeConfig } from '../barcode';
import type { QrCodeConfig } from '../qrcode';

export type PrintElement =
  | { type: "text"; content: string; options: Record<string, unknown> }
  | { type: "image"; bitmap: Bitmap; options: Record<string, unknown> }
  | { type: "box"; options: Record<string, unknown> }
  | { type: "line"; options: Record<string, unknown> }
  | { type: "circle"; options: Record<string, unknown> }
  | { type: "ellipse"; options: Record<string, unknown> }
  | { type: "reverse"; options: Record<string, unknown> }
  | { type: "erase"; options: Record<string, unknown> }
  | { type: "raw"; content: string | Uint8Array }
  | { type: "barcode"; options: BarcodeConfig }
  | { type: "qrcode"; options: QrCodeConfig };
