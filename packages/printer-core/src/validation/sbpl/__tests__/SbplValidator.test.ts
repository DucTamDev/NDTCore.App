import { SbplValidator } from '../SbplValidator';

describe('SbplValidator', () => {
  it('accepts a well-formed ESC A/CS/.../Z sequence as valid', () => {
    const source = ['\x1bA', '\x1bCS', '\x1bH0010', '\x1bV0020', '\x1bL0101', '\x1bK9BHello', '\x1bZ'].join('');
    const result = new SbplValidator().validate(source);

    expect(result.valid).toBe(true);
    expect(result.errors).toBe(0);
  });

  it('flags an empty source as an error', () => {
    const result = new SbplValidator().validate('   ');

    expect(result.valid).toBe(false);
    expect(result.errors).toBe(1);
    expect(result.issues).toEqual([{ level: 'error', message: 'Empty input' }]);
  });

  it('warns when ESC A (start of format) is not the first command', () => {
    const source = ['\x1bCS', '\x1bA', '\x1bZ'].join('');
    const result = new SbplValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'A', message: '<ESC>A (start of format) should be the first command' });
  });

  it('warns when ESC CS (clear buffer) is missing', () => {
    const source = ['\x1bA', '\x1bZ'].join('');
    const result = new SbplValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'CS', message: '<ESC>CS (clear buffer) not found' });
  });

  it('warns when ESC Z (end of format) is missing', () => {
    const source = ['\x1bA', '\x1bCS'].join('');
    const result = new SbplValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'Z', message: '<ESC>Z (end of format) not found — label will not print' });
  });

  it('errors when the quantity command carries a non-positive value', () => {
    const source = ['\x1bA', '\x1bCS', '\x1bQ0', '\x1bZ'].join('');
    const result = new SbplValidator().validate(source);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ level: 'error', command: 'Q', message: 'Q value 0 is not a positive copy count' });
  });

  it('accepts a positive quantity value', () => {
    const source = ['\x1bA', '\x1bCS', '\x1bQ3', '\x1bZ'].join('');
    const result = new SbplValidator().validate(source);

    expect(result.issues.some((issue) => issue.command === 'Q')).toBe(false);
  });

  it('warns about an unrecognized command letter', () => {
    const source = ['\x1bA', '\x1bCS', '\x1bX123', '\x1bZ'].join('');
    const result = new SbplValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'X', message: 'Unrecognized command: X' });
  });
});
