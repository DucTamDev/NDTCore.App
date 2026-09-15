import type { PrintDocument, ResolvedPrintDocument } from '../document';
import { PrintBuilder } from './PrintBuilder';
import { LabelBuilder } from './LabelBuilder';

/**
 * Fluent builder for continuous-paper (receipt) documents — same chain
 * methods as `LabelBuilder` via `PrintBuilder`, but the config never has a
 * fixed `height`. Delegates all unit/dpi/profile resolution to an internal
 * `LabelBuilder` instead of re-implementing it, so `resolve()` here has no
 * duplicated math: the delegate naturally reports `heightDots: 0` since its
 * config was never given a `height`.
 */
export class ReceiptBuilder extends PrintBuilder {
  private readonly delegate: LabelBuilder;

  constructor(config: Omit<PrintDocument, 'height'>) {
    super();
    this.delegate = new LabelBuilder(config);
  }

  resolve(): ResolvedPrintDocument {
    return { ...this.delegate.resolve(), elements: this.elements };
  }
}

export function receipt(config: Omit<PrintDocument, 'height'>): ReceiptBuilder {
  return new ReceiptBuilder(config);
}
