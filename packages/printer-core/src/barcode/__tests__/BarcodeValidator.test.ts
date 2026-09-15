import { validateBarcodeConfig } from '../BarcodeValidator';

describe('validateBarcodeConfig', () => {
  it('flags empty content as an error', () => {
    const issues = validateBarcodeConfig({ symbology: 'code128', content: '' });
    expect(issues.some((i) => i.level === 'error')).toBe(true);
  });

  it('flags a wrong-length EAN-13 payload', () => {
    const issues = validateBarcodeConfig({ symbology: 'ean13', content: '123' });
    expect(issues.some((i) => i.level === 'error')).toBe(true);
  });

  it('accepts a valid code128 config', () => {
    expect(validateBarcodeConfig({ symbology: 'code128', content: 'ABC123' })).toEqual([]);
  });
});
