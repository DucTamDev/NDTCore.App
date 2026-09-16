import type { PrintDocument } from '../document';
import type { PrintElement } from '../builder';

/**
 * A print-ready starting point for a `ReceiptBuilder` document — same shape
 * as `LabelPreset`, but `config` omits `height` since continuous receipt
 * paper has no fixed length, matching `ReceiptBuilder`'s own constructor.
 */
export interface ReceiptPreset<TVars> {
  config: Omit<PrintDocument, 'height'>;
  build(vars: TVars): PrintElement[];
}
