import { PRINT_KIND_LABELS } from '../printKindLabels';
import { PrintKind } from '../../models/printer/PrintKind';

describe('PRINT_KIND_LABELS', () => {
  it('has a Vietnamese label for every PrintKind', () => {
    const types: PrintKind[] = [PrintKind.Receipt, PrintKind.Label];
    for (const type of types) {
      expect(PRINT_KIND_LABELS[type]).toEqual(expect.any(String));
    }
  });

  it('labels Receipt as "Hoá đơn" and Label as "Tem"', () => {
    expect(PRINT_KIND_LABELS.Receipt).toBe('Hoá đơn');
    expect(PRINT_KIND_LABELS.Label).toBe('Tem');
  });
});
