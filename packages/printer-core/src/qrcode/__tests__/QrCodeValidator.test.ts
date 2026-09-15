import { validateQrCodeConfig } from '../QrCodeValidator';

describe('validateQrCodeConfig', () => {
  it('flags empty content as an error', () => {
    expect(validateQrCodeConfig({ content: '' }).some((i) => i.level === 'error')).toBe(true);
  });

  it('accepts a normal URL payload', () => {
    expect(validateQrCodeConfig({ content: 'https://example.com' })).toEqual([]);
  });
});
