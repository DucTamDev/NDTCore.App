export const PrintTemplateType = {
  Label: 'label',
  Receipt: 'receipt',
} as const;
export type PrintTemplateType = (typeof PrintTemplateType)[keyof typeof PrintTemplateType];
