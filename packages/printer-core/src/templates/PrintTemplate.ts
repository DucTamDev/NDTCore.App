import type { PrintDocument } from '../document';
import type { PrintElement } from '../builder';
import type { PrintTemplateType } from './PrintTemplateType';

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
