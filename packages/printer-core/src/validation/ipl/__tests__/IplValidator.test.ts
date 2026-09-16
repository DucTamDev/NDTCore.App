import { IplValidator } from '../IplValidator';

const STX = '\x02';
const ETX = '\x03';
const ESC = '\x1b';

function frame(body: string): string {
  return `${STX}${body}${ETX}`;
}

describe('IplValidator', () => {
  it('accepts a well-formed CREATE_FORMAT/SI-W/PRINT/END_FORMAT sequence as valid', () => {
    const source = [frame(`${ESC}C1`), frame('<SI>W320'), frame('R'), frame(`${ESC}E1`)].join('');
    const result = new IplValidator().validate(source);

    expect(result.valid).toBe(true);
    expect(result.errors).toBe(0);
  });

  it('flags an empty source as an error', () => {
    const result = new IplValidator().validate('   ');

    expect(result.valid).toBe(false);
    expect(result.errors).toBe(1);
    expect(result.issues).toEqual([{ level: 'error', message: 'Empty input' }]);
  });

  it('warns when ESC C is not the first command', () => {
    const source = [frame('<SI>W320'), frame(`${ESC}C1`), frame('R'), frame(`${ESC}E1`)].join('');
    const result = new IplValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'C', message: 'ESC C (create format) should be the first command' });
  });

  it('warns when <SI>W (label width) is missing', () => {
    const source = [frame(`${ESC}C1`), frame('R'), frame(`${ESC}E1`)].join('');
    const result = new IplValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'W', message: '<SI>W (label width) not found — label width undefined' });
  });

  it('warns when R (print) is missing', () => {
    const source = [frame(`${ESC}C1`), frame('<SI>W320'), frame(`${ESC}E1`)].join('');
    const result = new IplValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'R', message: 'No R (print) command found — label will not print' });
  });

  it('warns when ESC E (end format) is missing', () => {
    const source = [frame(`${ESC}C1`), frame('<SI>W320'), frame('R')].join('');
    const result = new IplValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'E', message: 'No ESC E (end format) command found — format is never closed' });
  });

  it('errors when d (density) is above the 0-30 range', () => {
    const source = [frame(`${ESC}C1`), frame('<SI>W320'), frame('<SI>d99'), frame('R'), frame(`${ESC}E1`)].join('');
    const result = new IplValidator().validate(source);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ level: 'error', command: 'd', message: 'd value 99 out of range (0-30)' });
  });

  it('accepts d at the range boundaries (0 and 30)', () => {
    const low = new IplValidator().validate([frame(`${ESC}C1`), frame('<SI>W320'), frame('<SI>d0'), frame('R'), frame(`${ESC}E1`)].join(''));
    const high = new IplValidator().validate([frame(`${ESC}C1`), frame('<SI>W320'), frame('<SI>d30'), frame('R'), frame(`${ESC}E1`)].join(''));

    expect(low.issues.some((issue) => issue.command === 'd')).toBe(false);
    expect(high.issues.some((issue) => issue.command === 'd')).toBe(false);
  });

  it('warns (but does not error) when S is above the 0-99 range', () => {
    // Not reachable via `<SI>S` parsing today (params is always numeric text),
    // but a malformed/non-numeric params guards the same branch — this
    // documents the fallback rather than the numeric-range branch alone.
    const source = [frame(`${ESC}C1`), frame('<SI>W320'), frame('<SI>S150'), frame('R'), frame(`${ESC}E1`)].join('');
    const result = new IplValidator().validate(source);

    expect(result.valid).toBe(true); // a warning alone doesn't make the stream invalid
    expect(result.issues).toContainEqual({ level: 'warning', command: 'S', message: 'S value 150 may be out of range (0-99)' });
  });

  it('warns about an unrecognized frame', () => {
    const source = [frame(`${ESC}C1`), frame('<SI>W320'), frame('ZZZ'), frame('R'), frame(`${ESC}E1`)].join('');
    const result = new IplValidator().validate(source);

    expect(result.issues).toContainEqual({ level: 'warning', command: 'ZZZ', message: 'Unrecognized command: ZZZ' });
  });
});
