export const PrintType = {
  Receipt: 'Receipt',
  Label: 'Label',
} as const;

export type PrintType = (typeof PrintType)[keyof typeof PrintType];

export const PRINT_TYPE_LABELS: Record<PrintType, string> = {
  Receipt: 'Hoá đơn',
  Label: 'Tem',
};
