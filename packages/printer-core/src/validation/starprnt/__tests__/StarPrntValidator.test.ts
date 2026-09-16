import { StarPrntValidator } from '../StarPrntValidator';

function bytesToBinaryString(bytes: number[]): string {
  return String.fromCharCode(...bytes);
}

describe('StarPrntValidator', () => {
  it('accepts a well-formed init + align + text + LF stream as valid', () => {
    const bytes = [0x1b, 0x40, 0x1b, 0x1d, 0x61, 0x01, ...Array.from(new TextEncoder().encode('Hi')), 0x0a];
    const result = new StarPrntValidator().validate(bytesToBinaryString(bytes));

    expect(result.valid).toBe(true);
    expect(result.errors).toBe(0);
  });

  it('accepts a well-formed raster image block', () => {
    const bytes = [0x1b, 0x2a, 0x72, 0x41, 0x62, 0x01, 0x00, 0xff, 0x1b, 0x2a, 0x72, 0x42];
    const result = new StarPrntValidator().validate(bytesToBinaryString(bytes));

    expect(result.valid).toBe(true);
    expect(result.errors).toBe(0);
  });

  it('flags a raster row whose declared byte count overflows the buffer', () => {
    // b nL=10 nH=0 declares 10 data bytes, but none follow before the buffer ends.
    const bytes = [0x1b, 0x2a, 0x72, 0x41, 0x62, 0x0a, 0x00];
    const result = new StarPrntValidator().validate(bytesToBinaryString(bytes));

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.level === 'error' && issue.message.includes('Raster row'))).toBe(true);
  });

  it('warns about stray bytes outside the printable/extended ranges and outside any recognized command', () => {
    const bytes = [0x01, 0x02, 0x03];
    const result = new StarPrntValidator().validate(bytesToBinaryString(bytes));

    expect(result.warnings).toBeGreaterThan(0);
    expect(result.valid).toBe(true);
  });

  it('does not warn about command parameter bytes that happen to be in the control range', () => {
    const bytes = [0x1b, 0x2d, 0x00]; // ESC - 0 — underline off; the 0x00 parameter is not a stray byte
    const result = new StarPrntValidator().validate(bytesToBinaryString(bytes));

    expect(result.warnings).toBe(0);
  });

  it('does not flag a cash-drawer BEL byte as stray', () => {
    const result = new StarPrntValidator().validate(bytesToBinaryString([0x07]));
    expect(result.warnings).toBe(0);
  });
});
