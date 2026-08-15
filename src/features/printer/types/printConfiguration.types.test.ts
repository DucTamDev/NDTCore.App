import type { PrintConfiguration, PrintType } from './printConfiguration.types';

describe('print configuration types', () => {
  it('accepts a full PrintConfiguration for each PrintType', () => {
    const types: PrintType[] = ['Receipt', 'Label'];
    const configs: PrintConfiguration[] = types.map((printType) => ({
      id: `c-${printType}`,
      printType,
      printerId: 'p1',
      isDefault: true,
      isEnabled: true,
    }));
    expect(configs).toHaveLength(2);
  });
});
