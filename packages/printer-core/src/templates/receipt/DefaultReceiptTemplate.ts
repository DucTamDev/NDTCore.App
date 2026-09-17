import type { ReceiptTemplate } from '../ReceiptTemplate';

/** Blank 58mm continuous receipt at 203dpi — the bare starting point for a new receipt, nothing prefilled. */
export const DefaultReceiptTemplate: ReceiptTemplate = {
  kind: 'receipt',
  config: { width: 58, unit: 'mm', dpi: 203 },
  elements: [],
};
