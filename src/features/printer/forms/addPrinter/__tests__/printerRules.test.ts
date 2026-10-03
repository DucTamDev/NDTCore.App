import { canPrintKind } from '../printerRules';
import { PrintKind } from '../../../models/printer/PrintKind';
import { PrintLanguage } from '../../../models/printer/PrinterLanguage';

describe('canPrintKind', () => {
  it('ESC/POS chỉ in hoá đơn', () => {
    expect(canPrintKind(PrintLanguage.EscPos, PrintKind.Receipt)).toBe(true);
    expect(canPrintKind(PrintLanguage.EscPos, PrintKind.Label)).toBe(false);
  });

  it('TSPL in được hoá đơn và tem', () => {
    expect(canPrintKind(PrintLanguage.Tspl, PrintKind.Receipt)).toBe(true);
    expect(canPrintKind(PrintLanguage.Tspl, PrintKind.Label)).toBe(true);
  });
});
