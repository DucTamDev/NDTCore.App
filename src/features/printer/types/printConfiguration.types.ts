export type PrintType = 'Receipt' | 'Label';

export const PRINT_TYPE_LABELS: Record<PrintType, string> = {
  Receipt: 'Hoá đơn',
  Label: 'Tem',
};
