import { CpclValidator } from '../CpclValidator';

describe('CpclValidator', () => {
  it('accepts a well-formed !/TONE/SPEED/PAGE-WIDTH/TEXT/PRINT sequence as valid', () => {
    const source = ['! 0 203 203 240 1', 'TONE 107', 'SPEED 4', 'PAGE-WIDTH 320', 'TEXT 2 0 10 10', 'Hi', 'PRINT'].join('\r\n');
    const result = new CpclValidator().validate(source);

    expect(result.valid).toBe(true);
    expect(result.errors).toBe(0);
  });

  it('flags an empty source as an error', () => {
    const result = new CpclValidator().validate('   ');

    expect(result.valid).toBe(false);
    expect(result.errors).toBe(1);
    expect(result.issues).toEqual([{ level: 'error', message: 'Empty input' }]);
  });

  it('warns when ! (session header) is not the first command', () => {
    const source = ['PAGE-WIDTH 320', '! 0 203 203 240 1', 'PRINT'].join('\r\n');
    const result = new CpclValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: '!', message: '! (session header) should be the first command' });
  });

  it('warns when PAGE-WIDTH is missing', () => {
    const source = ['! 0 203 203 240 1', 'SPEED 4', 'PRINT'].join('\r\n');
    const result = new CpclValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'PAGE-WIDTH', message: 'PAGE-WIDTH not found — label width undefined' });
  });

  it('warns when PRINT is missing', () => {
    const source = ['! 0 203 203 240 1', 'PAGE-WIDTH 320'].join('\r\n');
    const result = new CpclValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'PRINT', message: 'No PRINT command found — label will not print' });
  });

  it('errors when TONE is above the 0-200 range', () => {
    const source = ['! 0 203 203 240 1', 'TONE 250', 'PAGE-WIDTH 320', 'PRINT'].join('\r\n');
    const result = new CpclValidator().validate(source);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ level: 'error', command: 'TONE', message: 'TONE value 250 out of range (0-200)' });
  });

  it('errors when TONE is below the 0-200 range', () => {
    const source = ['! 0 203 203 240 1', 'TONE -1', 'PAGE-WIDTH 320', 'PRINT'].join('\r\n');
    const result = new CpclValidator().validate(source);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ level: 'error', command: 'TONE', message: 'TONE value -1 out of range (0-200)' });
  });

  it('accepts TONE at the range boundaries (0 and 200)', () => {
    const low = new CpclValidator().validate(['! 0 203 203 240 1', 'TONE 0', 'PAGE-WIDTH 320', 'PRINT'].join('\r\n'));
    const high = new CpclValidator().validate(['! 0 203 203 240 1', 'TONE 200', 'PAGE-WIDTH 320', 'PRINT'].join('\r\n'));

    expect(low.issues.some((issue) => issue.command === 'TONE')).toBe(false);
    expect(high.issues.some((issue) => issue.command === 'TONE')).toBe(false);
  });

  it('warns (but does not error) when SPEED is above the 1-6 range', () => {
    const source = ['! 0 203 203 240 1', 'SPEED 20', 'PAGE-WIDTH 320', 'PRINT'].join('\r\n');
    const result = new CpclValidator().validate(source);

    expect(result.valid).toBe(true); // a warning alone doesn't make the stream invalid
    expect(result.issues).toContainEqual({ level: 'warning', command: 'SPEED', message: 'SPEED value 20 may be out of range (1-6, model-dependent)' });
  });

  it('warns about an unrecognized command', () => {
    const source = ['! 0 203 203 240 1', 'PAGE-WIDTH 320', 'NOTACOMMAND foo', 'PRINT'].join('\r\n');
    const result = new CpclValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'NOTACOMMAND', message: 'Unrecognized command: NOTACOMMAND' });
  });
});
