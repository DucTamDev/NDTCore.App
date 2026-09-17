import type { PrintDocument } from '../document';
import type { PrintElement } from '../builder';
import { PrintTemplateType } from './PrintTemplateType';

/**
 * Common shape both template kinds share: identity (`id`/`name`) plus the
 * discriminant, config, and elements every persisted, user-editable
 * print document needs. Not exported as `PrintTemplate` itself — that name
 * is reserved for the real union below, since narrowing on `type` (e.g.
 * `if (t.type === PrintTemplateType.Receipt)`) only works when the two
 * variants are alternatives of a union, not subtypes of a shared parent
 * interface.
 */
export interface BasePrintTemplate {
  id: string;
  name: string;
  type: PrintTemplateType;
  config: PrintDocument;
  elements: PrintElement[];
}

export interface LabelTemplate extends BasePrintTemplate {
  type: typeof PrintTemplateType.Label;
  config: PrintDocument;
}

/** `config` omits `height` since continuous receipt paper has no fixed length, matching `ReceiptBuilder`'s own constructor. */
export interface ReceiptTemplate extends BasePrintTemplate {
  type: typeof PrintTemplateType.Receipt;
  config: Omit<PrintDocument, 'height'>;
}

export type PrintTemplate = LabelTemplate | ReceiptTemplate;
