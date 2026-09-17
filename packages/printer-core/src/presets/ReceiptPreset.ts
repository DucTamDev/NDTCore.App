import type { PrintDocument } from '../document';
import type { PrintElement } from '../builder';

/**
 * A print-ready starting point for a `ReceiptBuilder` document — same shape
 * as `LabelPreset`, but `config` omits `height` since continuous receipt
 * paper has no fixed length, matching `ReceiptBuilder`'s own constructor.
 *
 * `kind` is a discriminant defined locally here, the same as
 * `LabelPreset`'s — see that file's doc comment for why it isn't the app's
 * own `PrintType`.
 */
export interface ReceiptPreset {
  kind: 'receipt';
  config: Omit<PrintDocument, 'height'>;
  elements: PrintElement[];
}
