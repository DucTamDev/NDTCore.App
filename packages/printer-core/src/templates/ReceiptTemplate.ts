import type { PrintDocument } from '../document';
import type { PrintElement } from '../builder';

/**
 * A persisted, user-editable receipt document — same shape as
 * `LabelTemplate`, but `config` omits `height` since continuous receipt
 * paper has no fixed length, matching `ReceiptBuilder`'s own constructor.
 *
 * `type` is a discriminant defined locally here, the same as
 * `LabelTemplate`'s — see that file's doc comment for why it isn't an
 * app-specific type.
 */
export interface ReceiptTemplate {
  id: string;
  name: string;
  type: 'receipt';
  config: Omit<PrintDocument, 'height'>;
  elements: PrintElement[];
}
