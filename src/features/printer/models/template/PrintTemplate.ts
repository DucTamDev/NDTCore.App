import type { PrintDocument, PrintElement } from 'printer-core';

export const PrintTemplateType = {
  Label: 'label',
  Receipt: 'receipt',
} as const;

export type PrintTemplateType = (typeof PrintTemplateType)[keyof typeof PrintTemplateType];

interface PrintTemplateBase {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabelPrintTemplate extends PrintTemplateBase {
  type: typeof PrintTemplateType.Label;
  config: PrintDocument;
  elements: PrintElement[];
}

export interface ReceiptPrintTemplate extends PrintTemplateBase {
  type: typeof PrintTemplateType.Receipt;
  config: Omit<PrintDocument, 'height'>;
  elements: PrintElement[];
}

/**
 * A real union, not a base interface `LabelPrintTemplate`/`ReceiptPrintTemplate`
 * extend — narrowing on `type` (e.g. `if (t.type === PrintTemplateType.Receipt)`)
 * only works when the two variants are alternatives of a union, not
 * subtypes of a shared parent interface.
 */
export type PrintTemplate = LabelPrintTemplate | ReceiptPrintTemplate;
