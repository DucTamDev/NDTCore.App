import type { LayoutStyle } from '../template/style/LayoutStyle';
import type { BoxStyle } from '../template/style/BoxStyle';
import type { TextStyle } from '../template/style/TextStyle';
import type { BarcodeSymbology } from '../barcode';
import type { QrErrorCorrectionLevel } from '../qrcode';
import type { Bitmap } from '../types';

export type ResolvedNode = ResolvedContainer | ResolvedText | ResolvedLine | ResolvedBarcode | ResolvedQrCode | ResolvedImage;

export interface ResolvedContainer {
  readonly type: 'container';
  readonly id: string;
  readonly style?: LayoutStyle;
  readonly children: readonly ResolvedNode[];
}

export interface ResolvedText {
  readonly type: 'text';
  readonly id: string;
  readonly value: string;
  readonly style?: BoxStyle & TextStyle;
}

export interface ResolvedLine {
  readonly type: 'line';
  readonly id: string;
  readonly thickness?: number;
  readonly style?: BoxStyle;
}

export interface ResolvedBarcode {
  readonly type: 'barcode';
  readonly id: string;
  readonly value: string;
  readonly symbology: BarcodeSymbology;
  readonly readable?: boolean;
  readonly style?: BoxStyle;
}

export interface ResolvedQrCode {
  readonly type: 'qrcode';
  readonly id: string;
  readonly value: string;
  readonly errorCorrection?: QrErrorCorrectionLevel;
  readonly style?: BoxStyle;
}

export interface ResolvedImage {
  readonly type: 'image';
  readonly id: string;
  readonly bitmap: Bitmap;
  readonly style?: BoxStyle;
}
