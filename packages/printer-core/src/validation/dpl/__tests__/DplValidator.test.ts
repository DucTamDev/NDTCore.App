import { DplValidator } from '../DplValidator';

describe('DplValidator', () => {
  it('accepts a well-formed STX-L/D/S/A/Q/E sequence as valid', () => {
    const source = ['\x02L', 'D08', 'S04', 'A0320', 'Q0001', 'E'].join('\r\n');
    const result = new DplValidator().validate(source);

    expect(result.valid).toBe(true);
    expect(result.errors).toBe(0);
  });

  it('flags an empty source as an error', () => {
    const result = new DplValidator().validate('   ');

    expect(result.valid).toBe(false);
    expect(result.errors).toBe(1);
    expect(result.issues).toEqual([{ level: 'error', message: 'Empty input' }]);
  });

  it('warns when <STX>L is not the first command', () => {
    const source = ['A0320', '\x02L', 'E'].join('\r\n');
    const result = new DplValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'STX_L', message: '<STX>L (enter label format) should be the first command' });
  });

  it('warns when A (label width) is missing', () => {
    const source = ['\x02L', 'D08', 'S04', 'E'].join('\r\n');
    const result = new DplValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'A', message: 'A (label width) not found — label width undefined' });
  });

  it('warns when E is missing', () => {
    const source = ['\x02L', 'D08', 'A0320'].join('\r\n');
    const result = new DplValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'E', message: 'No E command found — label will not print' });
  });

  it('errors when D is above the 0-30 range', () => {
    // "D99" is the largest value DplParser's own `/^D\d{1,2}$/` gate can ever
    // classify as a DENSITY command (it's a 2-digit field) — using it here
    // proves this check fires on a value the parser genuinely accepts as
    // DENSITY, not one it would reject outright as unrecognized.
    const source = ['\x02L', 'A0320', 'D99', 'E'].join('\r\n');
    const result = new DplValidator().validate(source);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ level: 'error', command: 'D', message: 'D value 99 out of range (0-30)' });
  });

  it('accepts D at the range boundaries (0 and 30)', () => {
    const low = new DplValidator().validate(['\x02L', 'A0320', 'D0', 'E'].join('\r\n'));
    const high = new DplValidator().validate(['\x02L', 'A0320', 'D30', 'E'].join('\r\n'));

    expect(low.issues.some((issue) => issue.command === 'D')).toBe(false);
    expect(high.issues.some((issue) => issue.command === 'D')).toBe(false);
  });

  it('warns (but does not error) when S is above the 1-12 range', () => {
    const source = ['\x02L', 'A0320', 'S20', 'E'].join('\r\n');
    const result = new DplValidator().validate(source);

    expect(result.valid).toBe(true); // a warning alone doesn't make the stream invalid
    expect(result.issues).toContainEqual({ level: 'warning', command: 'S', message: 'S value 20 may be out of range (1-12, model-dependent)' });
  });

  it('warns about an unrecognized command line', () => {
    const source = ['\x02L', 'A0320', 'ZZZ', 'E'].join('\r\n');
    const result = new DplValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'ZZZ', message: 'Unrecognized command: ZZZ' });
  });
});
