import { PrinterKind } from '@ndtcore/printer';
import { PRINT_KIND_LABELS } from '../printKindLabels';

describe('PRINT_KIND_LABELS', () => {
  it('nhãn tiếng Việt cho hoá đơn và tem', () => {
    expect(PRINT_KIND_LABELS[PrinterKind.Receipt]).toBe('Hoá đơn');
    expect(PRINT_KIND_LABELS[PrinterKind.Label]).toBe('Tem');
  });
});
