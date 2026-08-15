export type PrintType = 'Receipt' | 'Label';

export interface PrintConfiguration {
  id: string;
  printType: PrintType;
  printerId: string;
  isDefault: boolean;
  isEnabled: boolean;
}
