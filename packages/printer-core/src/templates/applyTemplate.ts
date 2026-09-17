import type { PrintDocument } from '../document';
import { LabelBuilder, ReceiptBuilder } from '../builder';
import type { LabelTemplate, ReceiptTemplate } from './PrintTemplate';

/** Builds a `LabelBuilder` from a template's config + starting elements, with optional config overrides applied on top. */
export function applyLabelTemplate(template: LabelTemplate, overrides?: Partial<PrintDocument>): LabelBuilder {
  return new LabelBuilder({ ...template.config, ...overrides }).append(template.elements);
}

/** Builds a `ReceiptBuilder` from a template's config + starting elements, with optional config overrides applied on top. */
export function applyReceiptTemplate(template: ReceiptTemplate, overrides?: Partial<Omit<PrintDocument, 'height'>>): ReceiptBuilder {
  return new ReceiptBuilder({ ...template.config, ...overrides }).append(template.elements);
}
