import { PRINT_TYPE_LABELS, PrintType } from '../printConfiguration.types';

describe('PRINT_TYPE_LABELS', () => {
  it('has a Vietnamese label for every PrintType', () => {
    const types: PrintType[] = [PrintType.Receipt, PrintType.Label];
    for (const type of types) {
      expect(PRINT_TYPE_LABELS[type]).toEqual(expect.any(String));
    }
  });

  it('labels Receipt as "Hoá đơn" and Label as "Tem"', () => {
    expect(PRINT_TYPE_LABELS.Receipt).toBe('Hoá đơn');
    expect(PRINT_TYPE_LABELS.Label).toBe('Tem');
  });
});
