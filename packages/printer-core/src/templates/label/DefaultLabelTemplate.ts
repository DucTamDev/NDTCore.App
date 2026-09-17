import type { LabelTemplate } from '../LabelTemplate';

/**
 * Blank 40x30mm label at 203dpi — the bare starting point for a new label,
 * nothing prefilled. `id` is a fixed sentinel, not real record identity —
 * this is a compile-time constant, not an actual saved template; a
 * consumer cloning it into a real saved record replaces it.
 */
export const DefaultLabelTemplate: LabelTemplate = {
  id: 'default-label',
  name: 'Nhãn trắng',
  type: 'label',
  config: { width: 40, height: 30, unit: 'mm', dpi: 203 },
  elements: [],
};
