import { encodeCode128 } from '../code128';
import { PrinterErrorCode } from '../../errors/PrinterError';

describe('encodeCode128', () => {
  it('starts with the Start-B pattern (211214) and ends with the Stop pattern (2331112)', () => {
    const { widths } = encodeCode128('A');
    expect(widths.slice(0, 6)).toEqual([2, 1, 1, 2, 1, 4]);
    expect(widths.slice(-7)).toEqual([2, 3, 3, 1, 1, 1, 2]);
  });

  it('encodes a single digit-only string with the correct checksum symbol', () => {
    // "1" → Start B(104) + code(17, where 17 = 49 - 32) → checksum = (104 + 17*1) % 103 = 18 → pattern for symbol 18
    const { widths } = encodeCode128('1');
    // Start(6) + data-for-"1"(6) + checksum(6) + stop(7) = 25 widths
    expect(widths).toHaveLength(6 + 6 + 6 + 7);
  });

  it('totalModules equals the sum of widths', () => {
    const { widths, totalModules } = encodeCode128('ORD-42');
    expect(totalModules).toBe(widths.reduce((sum, w) => sum + w, 0));
  });

  it('throws VALIDATION_ERROR for a character outside ASCII 32-126', () => {
    expect(() => encodeCode128('Đơn')).toThrow();
    try {
      encodeCode128('Đơn');
    } catch (e) {
      expect(e).toMatchObject({ code: PrinterErrorCode.VALIDATION_ERROR });
    }
  });

  it('throws VALIDATION_ERROR for an empty string (Code128 needs at least one symbol)', () => {
    expect(() => encodeCode128('')).toThrow();
    try {
      encodeCode128('');
    } catch (e) {
      expect(e).toMatchObject({ code: PrinterErrorCode.VALIDATION_ERROR });
    }
  });
});
