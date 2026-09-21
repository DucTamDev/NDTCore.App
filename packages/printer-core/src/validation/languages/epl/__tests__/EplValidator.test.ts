import { EplValidator } from '../EplValidator';

describe('EplValidator', () => {
  it('accepts a well-formed N/q/S/D/A/P sequence as valid', () => {
    const source = ['N', 'q320', 'Q240,24', 'S4', 'D8', 'A10,10,0,2,1,1,N,"Hi"', 'P1'].join('\n');
    const result = new EplValidator().validate(source);

    expect(result.valid).toBe(true);
    expect(result.errors).toBe(0);
  });

  it('flags an empty source as an error', () => {
    const result = new EplValidator().validate('   ');

    expect(result.valid).toBe(false);
    expect(result.errors).toBe(1);
    expect(result.issues).toEqual([{ level: 'error', message: 'Empty input' }]);
  });

  it('warns when N is not the first command', () => {
    const source = ['q320', 'N', 'P1'].join('\n');
    const result = new EplValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'N', message: 'N (clear image buffer) should be the first command' });
  });

  it('warns when q (label width) is missing', () => {
    const source = ['N', 'S4', 'D8', 'P1'].join('\n');
    const result = new EplValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'q', message: 'q (label width) not found — label width undefined' });
  });

  it('warns when P is missing', () => {
    const source = ['N', 'q320', 'S4', 'D8'].join('\n');
    const result = new EplValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'P', message: 'No P command found — label will not print' });
  });

  it('errors when D is above the 0-15 range', () => {
    const source = ['N', 'q320', 'D20', 'P1'].join('\n');
    const result = new EplValidator().validate(source);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ level: 'error', command: 'D', message: 'D value 20 out of range (0-15)' });
  });

  it('errors when D is below the 0-15 range', () => {
    const source = ['N', 'q320', 'D-1', 'P1'].join('\n');
    const result = new EplValidator().validate(source);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ level: 'error', command: 'D', message: 'D value -1 out of range (0-15)' });
  });

  it('accepts D at the range boundaries (0 and 15)', () => {
    const low = new EplValidator().validate(['N', 'q320', 'D0', 'P1'].join('\n'));
    const high = new EplValidator().validate(['N', 'q320', 'D15', 'P1'].join('\n'));

    expect(low.issues.some((issue) => issue.command === 'D')).toBe(false);
    expect(high.issues.some((issue) => issue.command === 'D')).toBe(false);
  });

  it('warns (but does not error) when S is above the 1-12 range', () => {
    const source = ['N', 'q320', 'S20', 'P1'].join('\n');
    const result = new EplValidator().validate(source);

    expect(result.valid).toBe(true); // a warning alone doesn't make the stream invalid
    expect(result.issues).toContainEqual({ level: 'warning', command: 'S', message: 'S value 20 may be out of range (1-12, model-dependent)' });
  });

  it('warns about an unrecognized command', () => {
    const source = ['N', 'q320', 'Ynotreal', 'P1'].join('\n');
    const result = new EplValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'Y', message: 'Unrecognized command: Y' });
  });
});
