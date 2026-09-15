import { TscValidator } from '../TscValidator';

describe('TscValidator', () => {
  it('accepts a well-formed SIZE + CLS + TEXT + PRINT sequence as valid', () => {
    const source = ['SIZE 40 mm,30 mm', 'GAP 3 mm,0 mm', 'SPEED 4', 'DENSITY 8', 'DIRECTION 0', 'CLS', 'TEXT 10,10,"2",0,1,1,"Hi"', 'PRINT 1'].join(
      '\r\n',
    );
    const result = new TscValidator().validate(source);

    expect(result.valid).toBe(true);
    expect(result.errors).toBe(0);
  });

  it('flags an empty source as an error', () => {
    const result = new TscValidator().validate('   ');

    expect(result.valid).toBe(false);
    expect(result.errors).toBe(1);
    expect(result.issues).toEqual([{ level: 'error', message: 'Empty input' }]);
  });

  it('warns when SIZE is not the first command', () => {
    const source = ['CLS', 'SIZE 40 mm,30 mm', 'PRINT 1'].join('\r\n');
    const result = new TscValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'SIZE', message: 'SIZE should be the first command' });
  });

  it('errors when CLS appears after a label element', () => {
    const source = ['SIZE 40 mm,30 mm', 'TEXT 10,10,"2",0,1,1,"Hi"', 'CLS', 'PRINT 1'].join('\r\n');
    const result = new TscValidator().validate(source);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      level: 'error',
      command: 'CLS',
      message: 'CLS must appear before label elements (TEXT, BOX, etc.)',
    });
  });

  it('errors when there is no CLS at all before a label element', () => {
    const source = ['SIZE 40 mm,30 mm', 'BOX 0,0,100,50,2', 'PRINT 1'].join('\r\n');
    const result = new TscValidator().validate(source);

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.level === 'error' && issue.command === 'CLS')).toBe(true);
  });

  it('warns when PRINT is missing', () => {
    const source = ['SIZE 40 mm,30 mm', 'CLS', 'TEXT 10,10,"2",0,1,1,"Hi"'].join('\r\n');
    const result = new TscValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'PRINT', message: 'No PRINT command found — label will not print' });
  });

  it('errors when DENSITY is above the 0-15 range', () => {
    const source = ['SIZE 40 mm,30 mm', 'CLS', 'DENSITY 20', 'PRINT 1'].join('\r\n');
    const result = new TscValidator().validate(source);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ level: 'error', command: 'DENSITY', message: 'DENSITY value 20 out of range (0-15)' });
  });

  it('errors when DENSITY is below the 0-15 range', () => {
    const source = ['SIZE 40 mm,30 mm', 'CLS', 'DENSITY -1', 'PRINT 1'].join('\r\n');
    const result = new TscValidator().validate(source);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ level: 'error', command: 'DENSITY', message: 'DENSITY value -1 out of range (0-15)' });
  });

  it('accepts DENSITY at the range boundaries (0 and 15)', () => {
    const low = new TscValidator().validate(['SIZE 40 mm,30 mm', 'CLS', 'DENSITY 0', 'PRINT 1'].join('\r\n'));
    const high = new TscValidator().validate(['SIZE 40 mm,30 mm', 'CLS', 'DENSITY 15', 'PRINT 1'].join('\r\n'));

    expect(low.issues.some((issue) => issue.command === 'DENSITY')).toBe(false);
    expect(high.issues.some((issue) => issue.command === 'DENSITY')).toBe(false);
  });

  it('warns (but does not error) when SPEED is above the 1-18 range', () => {
    const source = ['SIZE 40 mm,30 mm', 'CLS', 'SPEED 25', 'PRINT 1'].join('\r\n');
    const result = new TscValidator().validate(source);

    expect(result.valid).toBe(true); // a warning alone doesn't make the stream invalid
    expect(result.issues).toContainEqual({
      level: 'warning',
      command: 'SPEED',
      message: 'SPEED value 25 may be out of range (1-18, model-dependent)',
    });
  });

  it('warns when SPEED is below the 1-18 range', () => {
    const source = ['SIZE 40 mm,30 mm', 'CLS', 'SPEED 0', 'PRINT 1'].join('\r\n');
    const result = new TscValidator().validate(source);

    expect(result.issues).toContainEqual({
      level: 'warning',
      command: 'SPEED',
      message: 'SPEED value 0 may be out of range (1-18, model-dependent)',
    });
  });

  it('warns about an unrecognized command', () => {
    const source = ['SIZE 40 mm,30 mm', 'CLS', 'NOTAREALCOMMAND 1,2,3', 'PRINT 1'].join('\r\n');
    const result = new TscValidator().validate(source);

    // `command` is the raw text truncated to 20 chars; `message` to 40 — the
    // raw command here is short enough that only `command` gets truncated.
    expect(result.issues).toContainEqual({
      level: 'warning',
      command: 'NOTAREALCOMMAND 1,2,',
      message: 'Unrecognized command: NOTAREALCOMMAND 1,2,3',
    });
  });
});
