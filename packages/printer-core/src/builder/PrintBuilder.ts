import type { Bitmap } from '../types';
import type { PrintElement } from './PrintElement';
import type { BarcodeConfig } from '../barcode';
import type { QrCodeConfig } from '../qrcode';
import type { TextOptions } from './content/TextElement';
import type { ImageOptions } from './content/ImageElement';
import type { BoxOptions } from './drawing/BoxElement';
import type { LineOptions } from './drawing/LineElement';
import { isDiagonal } from './drawing/DiagonalElement';
import type { CircleOptions } from './drawing/CircleElement';
import type { EllipseOptions } from './drawing/EllipseElement';
import type { ReverseOptions } from './drawing/ReverseElement';
import type { EraseOptions } from './drawing/EraseElement';
import type { CutOptions } from './printer/CutElement';
import type { TableOptions } from './layout/TableElement';
import type { SpacerOptions } from './layout/SpacerElement';
import type { RowOptions } from './layout/RowElement';
import type { ColumnOptions } from './layout/ColumnElement';

/**
 * Base class shared by `LabelBuilder` and `ReceiptBuilder` — holds the
 * fluent chain methods common to both. Each method just appends one
 * element and returns `this` so calls can be chained; layout resolution
 * and byte compilation happen elsewhere (subclass `resolve()`, and the
 * per-language compilers).
 */
export abstract class PrintBuilder {
  protected readonly elements: PrintElement[] = [];

  text(content: string, options: TextOptions = {}): this {
    this.elements.push({ type: 'text', content, options });
    return this;
  }

  image(bitmap: Bitmap, options: ImageOptions = {}): this {
    this.elements.push({ type: 'image', bitmap, options });
    return this;
  }

  box(options: BoxOptions): this {
    this.elements.push({ type: 'box', options });
    return this;
  }

  /**
   * A line whose endpoints differ on both axes is a diagonal — dispatched
   * to `DiagonalElement` instead of `LineElement` via `isDiagonal()`. There
   * is no separate `.diagonal()` method: both share `LineOptions`.
   */
  line(options: LineOptions): this {
    this.elements.push(isDiagonal(options) ? { type: 'diagonal', options } : { type: 'line', options });
    return this;
  }

  circle(options: CircleOptions): this {
    this.elements.push({ type: 'circle', options });
    return this;
  }

  ellipse(options: EllipseOptions): this {
    this.elements.push({ type: 'ellipse', options });
    return this;
  }

  reverse(options: ReverseOptions): this {
    this.elements.push({ type: 'reverse', options });
    return this;
  }

  erase(options: EraseOptions): this {
    this.elements.push({ type: 'erase', options });
    return this;
  }

  raw(content: string | Uint8Array): this {
    this.elements.push({ type: 'raw', content });
    return this;
  }

  barcode(config: BarcodeConfig): this {
    this.elements.push({ type: 'barcode', options: config });
    return this;
  }

  qrcode(config: QrCodeConfig): this {
    this.elements.push({ type: 'qrcode', options: config });
    return this;
  }

  cut(options: CutOptions = {}): this {
    this.elements.push({ type: 'cut', options });
    return this;
  }

  table(options: TableOptions): this {
    this.elements.push({ type: 'table', options });
    return this;
  }

  pageBreak(): this {
    this.elements.push({ type: 'pageBreak' });
    return this;
  }

  spacer(options: SpacerOptions): this {
    this.elements.push({ type: 'spacer', options });
    return this;
  }

  row(options: RowOptions = {}): this {
    this.elements.push({ type: 'row', options });
    return this;
  }

  column(options: ColumnOptions = {}): this {
    this.elements.push({ type: 'column', options });
    return this;
  }
}
