import { EscPosValidator } from '../EscPosValidator';

function bytesToBinaryString(bytes: number[]): string {
  return String.fromCharCode(...bytes);
}

describe('EscPosValidator', () => {
  it('accepts a well-formed init + text + LF stream as valid', () => {
    const bytes = [0x1b, 0x40, 0x1b, 0x61, 0x01, ...Array.from(new TextEncoder().encode('Hi')), 0x0a];
    const result = new EscPosValidator().validate(bytesToBinaryString(bytes));

    expect(result.valid).toBe(true);
    expect(result.errors).toBe(0);
  });

  it('flags a raster image whose declared byte count overflows the buffer', () => {
    // GS v 0, mode 0, bytesPerRow=10 (xL=10,xH=0), rows=10 (yL=10,yH=0) => declares 100 bytes, but supplies none.
    const bytes = [0x1d, 0x76, 0x30, 0x00, 0x0a, 0x00, 0x0a, 0x00];
    const result = new EscPosValidator().validate(bytesToBinaryString(bytes));

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.level === 'error' && issue.message.includes('Raster image'))).toBe(true);
  });

  it('accepts a raster image whose declared byte count fits the buffer', () => {
    // bytesPerRow=1, rows=1 => declares 1 byte, and 1 byte of image data follows.
    const bytes = [0x1d, 0x76, 0x30, 0x00, 0x01, 0x00, 0x01, 0x00, 0xff];
    const result = new EscPosValidator().validate(bytesToBinaryString(bytes));

    expect(result.errors).toBe(0);
  });

  it('warns about stray bytes outside the printable/extended ranges and outside any recognized command', () => {
    const bytes = [0x01, 0x02, 0x03]; // control bytes with no ESC/GS/DLE/FS/LF prefix
    const result = new EscPosValidator().validate(bytesToBinaryString(bytes));

    expect(result.warnings).toBeGreaterThan(0);
    expect(result.valid).toBe(true); // a warning alone doesn't make the stream invalid
  });

  it('does not warn about command parameter bytes that happen to be in the control range', () => {
    const bytes = [0x1b, 0x45, 0x00]; // ESC E 0 — bold off; the 0x00 parameter is not a stray byte
    const result = new EscPosValidator().validate(bytesToBinaryString(bytes));

    expect(result.warnings).toBe(0);
  });
});
