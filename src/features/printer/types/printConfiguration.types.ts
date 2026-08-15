export type PrintType = 'Receipt' | 'Label';

export const PRINT_TYPE_LABELS: Record<PrintType, string> = {
  Receipt: 'Hoá đơn',
  Label: 'Tem',
};

export interface PrintConfiguration {
  id: string;
  printType: PrintType;
  printerId: string;
  isDefault: boolean;
  isEnabled: boolean;
}
