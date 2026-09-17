import type { PrintDocument } from '../document';
import { LabelBuilder, ReceiptBuilder } from '../builder';
import type { LabelPreset } from './LabelPreset';
import type { ReceiptPreset } from './ReceiptPreset';

/** Builds a `LabelBuilder` from a preset's config + starting elements, with optional config overrides applied on top. */
export function applyLabelPreset(preset: LabelPreset, overrides?: Partial<PrintDocument>): LabelBuilder {
  return new LabelBuilder({ ...preset.config, ...overrides }).append(preset.elements);
}

/** Builds a `ReceiptBuilder` from a preset's config + starting elements, with optional config overrides applied on top. */
export function applyReceiptPreset(preset: ReceiptPreset, overrides?: Partial<Omit<PrintDocument, 'height'>>): ReceiptBuilder {
  return new ReceiptBuilder({ ...preset.config, ...overrides }).append(preset.elements);
}
