import { ZplValidator } from '../ZplValidator';

describe('ZplValidator', () => {
  it('accepts a well-formed ^XA...^FO/^FD...^XZ sequence as valid', () => {
    const source = '^XA^PW320^LL240^FO10,10^A0N,30,30^FDHi^FS^PQ1^XZ';
    const result = new ZplValidator().validate(source);

    expect(result.valid).toBe(true);
    expect(result.errors).toBe(0);
  });

  it('flags an empty source as an error', () => {
    const result = new ZplValidator().validate('   ');

    expect(result.valid).toBe(false);
    expect(result.errors).toBe(1);
    expect(result.issues).toEqual([{ level: 'error', message: 'Empty input' }]);
  });

  it('errors when the label does not start with ^XA', () => {
    const source = '^PW320^FO10,10^FDHi^FS^XZ';
    const result = new ZplValidator().validate(source);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ level: 'error', command: '^XA', message: 'Label must start with ^XA' });
  });

  it('errors when the label does not end with ^XZ', () => {
    const source = '^XA^PW320^FO10,10^FDHi^FS';
    const result = new ZplValidator().validate(source);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ level: 'error', command: '^XZ', message: 'Label must end with ^XZ' });
  });

  it('warns about ^FD with no preceding ^FO/^FT in the same field', () => {
    const source = '^XA^FDorphan^FS^XZ';
    const result = new ZplValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: '^FD', message: '^FD without preceding ^FO — field position undefined' });
  });

  it('does not warn about ^FD when it follows ^FT (baseline origin), not just ^FO', () => {
    const source = '^XA^FT10,10^FDHi^FS^XZ';
    const result = new ZplValidator().validate(source);

    expect(result.issues.some((issue) => issue.command === '^FD')).toBe(false);
  });

  it('errors when ^PW is above the 2-65535 range', () => {
    const source = '^XA^PW99999^FO0,0^FDHi^FS^XZ';
    const result = new ZplValidator().validate(source);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ level: 'error', command: '^PW', message: '^PW value 99999 out of range (2-65535)' });
  });

  it('errors when ^PW is below the 2-65535 range', () => {
    const source = '^XA^PW1^FO0,0^FDHi^FS^XZ';
    const result = new ZplValidator().validate(source);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ level: 'error', command: '^PW', message: '^PW value 1 out of range (2-65535)' });
  });

  it('accepts ^PW at the range boundaries (2 and 65535)', () => {
    const low = new ZplValidator().validate('^XA^PW2^XZ');
    const high = new ZplValidator().validate('^XA^PW65535^XZ');

    expect(low.issues.some((issue) => issue.command === '^PW')).toBe(false);
    expect(high.issues.some((issue) => issue.command === '^PW')).toBe(false);
  });

  it('forwards an unrecognized command as a parser-sourced warning', () => {
    const source = '^XA^ZQbogus^XZ';
    const result = new ZplValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', message: 'Unknown command: ^ZQ' });
  });
});
