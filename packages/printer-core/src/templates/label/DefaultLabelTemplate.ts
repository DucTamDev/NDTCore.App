import type { LabelTemplate } from '../LabelTemplate';

/** Blank 40x30mm label at 203dpi — the bare starting point for a new label, nothing prefilled. */
export const DefaultLabelTemplate: LabelTemplate = {
  kind: 'label',
  config: { width: 40, height: 30, unit: 'mm', dpi: 203 },
  elements: [],
};
