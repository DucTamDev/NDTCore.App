import type { ReceiptTemplate } from '../ReceiptTemplate';

/**
 * Blank 58mm continuous receipt at 203dpi — the bare starting point for a
 * new receipt, nothing prefilled. `id` is a fixed sentinel, not real
 * record identity — this is a compile-time constant, not an actual saved
 * template; a consumer cloning it into a real saved record replaces it.
 */
export const DefaultReceiptTemplate: ReceiptTemplate = {
  id: 'default-receipt',
  name: 'Hóa đơn trắng',
  type: 'receipt',
  config: { width: 58, unit: 'mm', dpi: 203 },
  elements: [],
};
