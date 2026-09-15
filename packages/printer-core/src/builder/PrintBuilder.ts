import type { Bitmap } from '../types';
import type { PrintElement } from '../document';
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
    this.elements.push({ type: 'text', content, options: toRecord(options) });
    return this;
  }

  image(bitmap: Bitmap, options: ImageOptions = {}): this {
    this.elements.push({ type: 'image', bitmap, options: toRecord(options) });
    return this;
  }

  box(options: BoxOptions): this {
    this.elements.push({ type: 'box', options: toRecord(options) });
    return this;
  }

  line(options: LineOptions): this {
    this.elements.push({ type: 'line', options: toRecord(options) });
    return this;
  }

  circle(options: CircleOptions): this {
    this.elements.push({ type: 'circle', options: toRecord(options) });
    return this;
  }

  ellipse(options: EllipseOptions): this {
    this.elements.push({ type: 'ellipse', options: toRecord(options) });
    return this;
  }

  reverse(options: ReverseOptions): this {
    this.elements.push({ type: 'reverse', options: toRecord(options) });
    return this;
  }

  erase(options: EraseOptions): this {
    this.elements.push({ type: 'erase', options: toRecord(options) });
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
}

/**
 * `PrintElement`'s `options` field is typed `Record<string, unknown>` (a
 * deliberately loose element-model shape), while each chain method above
 * takes a precise `*Options` interface. This widens one to the other
 * without resorting to `any` — every `*Options` field is optional and
 * assignable to `unknown`, so nothing is actually lost.
 */
function toRecord(options: object): Record<string, unknown> {
  return options as Record<string, unknown>;
}
