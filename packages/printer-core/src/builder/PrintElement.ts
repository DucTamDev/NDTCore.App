import type { Bitmap } from '../types';
import type { BarcodeConfig } from '../barcode';
import type { QrCodeConfig } from '../qrcode';
import type { TextOptions } from './content/TextElement';
import type { ImageOptions } from './content/ImageElement';
import type { BoxOptions } from './drawing/BoxElement';
import type { LineOptions } from './drawing/LineElement';
import type { CircleOptions } from './drawing/CircleElement';
import type { EllipseOptions } from './drawing/EllipseElement';
import type { ReverseOptions } from './drawing/ReverseElement';
import type { EraseOptions } from './drawing/EraseElement';
import type { CutOptions } from './printer/CutElement';
import type { TableOptions } from './layout/TableElement';
import type { SpacerOptions } from './layout/SpacerElement';
import type { RowOptions } from './layout/RowElement';
import type { ColumnOptions } from './layout/ColumnElement';

/** A text run, positioned and styled per `TextOptions`. */
export interface TextElement {
  type: 'text';
  content: string;
  options?: TextOptions;
}

/** A raster image, rendered from a pre-decoded `Bitmap`. */
export interface ImageElement {
  type: 'image';
  bitmap: Bitmap;
  options?: ImageOptions;
}

/** A 1D barcode, rendered via the printer's native barcode command. */
export interface BarcodeElement {
  type: 'barcode';
  options: BarcodeConfig;
}

/** A 2D QR code, rendered via the printer's native command. */
export interface QrCodeElement {
  type: 'qrcode';
  options: QrCodeConfig;
}

/** A rectangle (box) outline. */
export interface BoxElement {
  type: 'box';
  options: BoxOptions;
}

/** An axis-aligned straight line — see `DiagonalElement` for the non-axis-aligned case. */
export interface LineElement {
  type: 'line';
  options: LineOptions;
}

/**
 * A diagonal line — reuses `LineOptions` verbatim, since a diagonal is a
 * line whose endpoints differ on both axes, not a different parameter
 * shape. `PrintBuilder.line()` selects this variant vs. `LineElement` via
 * `isDiagonal()` (see `./drawing/DiagonalElement`).
 */
export interface DiagonalElement {
  type: 'diagonal';
  options: LineOptions;
}

/** A circle outline. */
export interface CircleElement {
  type: 'circle';
  options: CircleOptions;
}

/** An ellipse outline. */
export interface EllipseElement {
  type: 'ellipse';
  options: EllipseOptions;
}

/** A reverse-print region (inverts black/white within the box). */
export interface ReverseElement {
  type: 'reverse';
  options: ReverseOptions;
}

/** An erase region (clears the box to white). */
export interface EraseElement {
  type: 'erase';
  options: EraseOptions;
}

/** A printer-language string or byte sequence passed straight through to the compiled output. */
export interface RawElement {
  type: 'raw';
  content: string | Uint8Array;
}

/** A paper-cut command. */
export interface CutElement {
  type: 'cut';
  options?: CutOptions;
}

/** A table placed as a positioned document element. */
export interface TableElement {
  type: 'table';
  options: TableOptions;
}

/** A page-break marker — carries no configuration, only a position in the element list. */
export interface PageBreakElement {
  type: 'pageBreak';
}

/** A fixed-size spacer. */
export interface SpacerElement {
  type: 'spacer';
  options: SpacerOptions;
}

/** A horizontal row layout container. */
export interface RowElement {
  type: 'row';
  options: RowOptions;
}

/** A vertical column layout container. */
export interface ColumnElement {
  type: 'column';
  options: ColumnOptions;
}

/**
 * Discriminated union of every element a `PrintBuilder` can produce.
 * Each variant owns its exact shape (no `Record<string, unknown>` bridge),
 * so compilers and parsers narrow on `type` and get the real options
 * interface for free.
 */
export type PrintElement =
  | TextElement
  | ImageElement
  | BarcodeElement
  | QrCodeElement
  | BoxElement
  | LineElement
  | DiagonalElement
  | CircleElement
  | EllipseElement
  | ReverseElement
  | EraseElement
  | RawElement
  | CutElement
  | TableElement
  | PageBreakElement
  | SpacerElement
  | RowElement
  | ColumnElement;
