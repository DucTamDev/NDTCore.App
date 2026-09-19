import type { LayoutConfig } from '../layout/LayoutConfig';
import type { TemplateNode } from './nodes/TemplateNode';
import { PrintTemplateType } from './PrintTemplateType';

export interface BasePrintTemplate {
  readonly id: string;
  readonly version: number;
  readonly type: PrintTemplateType;
  readonly root: TemplateNode;
}

export interface LabelTemplate extends BasePrintTemplate {
  readonly type: typeof PrintTemplateType.Label;
  readonly config: LayoutConfig;
}

export interface ReceiptTemplate extends BasePrintTemplate {
  readonly type: typeof PrintTemplateType.Receipt;
  readonly config: Omit<LayoutConfig, 'heightDots'>;
}

export type PrintTemplate = LabelTemplate | ReceiptTemplate;
