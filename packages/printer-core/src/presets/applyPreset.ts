import type { PrintDocument } from '../document';
import { LabelBuilder, ReceiptBuilder } from '../builder';
import type { LabelPreset } from './LabelPreset';
import type { ReceiptPreset } from './ReceiptPreset';

/** Builds a `LabelBuilder` from a preset's config + built elements, with optional config overrides applied on top. */
export function applyLabelPreset<TVars>(
  preset: LabelPreset<TVars>,
  vars: TVars,
  overrides?: Partial<PrintDocument>,
): LabelBuilder {
  return new LabelBuilder({ ...preset.config, ...overrides }).append(preset.build(vars));
}

/** Builds a `ReceiptBuilder` from a preset's config + built elements, with optional config overrides applied on top. */
export function applyReceiptPreset<TVars>(
  preset: ReceiptPreset<TVars>,
  vars: TVars,
  overrides?: Partial<Omit<PrintDocument, 'height'>>,
): ReceiptBuilder {
  return new ReceiptBuilder({ ...preset.config, ...overrides }).append(preset.build(vars));
}
