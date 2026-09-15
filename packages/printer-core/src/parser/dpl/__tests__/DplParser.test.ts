import { DplParser, parseDPL } from '../DplParser';

describe('DplParser', () => {
  it('parses a full label into commands, with no warnings', () => {
    const source = ['\x02L', 'D08', 'S04', 'A0320', 'Q0001', 'E'].join('\r\n');
    const result = new DplParser().parse(source);

    expect(result.commands.length).toBeGreaterThan(0);
    expect(result.warnings).toEqual([]);
  });

  it('recognizes STX L as entering label mode and E (while in label mode) as ending it', () => {
    const source = ['\x02L', 'D08', 'E'].join('\r\n');
    const result = parseDPL(source);

    expect(result.commands[0]).toEqual({ type: 'STX_L', params: '' });
    expect(result.commands[result.commands.length - 1]).toEqual({ type: 'E', params: '' });
  });

  it('extracts the label width from an A command', () => {
    const source = ['\x02L', 'A0320', 'E'].join('\r\n');
    const result = parseDPL(source);

    expect(result.widthDots).toBe(320);
  });

  it('records density/speed/quantity commands', () => {
    const source = ['\x02L', 'D08', 'S04', 'Q0005', 'E'].join('\r\n');
    const result = parseDPL(source);

    const types = result.commands.map((c) => c.type);
    expect(types).toContain('DENSITY');
    expect(types).toContain('SPEED');
    expect(types).toContain('QUANTITY');
  });

  it('best-effort recovers x/y and an offset-guessed content from a long fixed-field label record', () => {
    // A real `DplCompiler` text record (rotation(1) + col(4) + row(4) +
    // h(4) + w(4) + "000" + font(1) + content) is 21 fixed chars before its
    // content starts, not 20 — so the parser's hardcoded `slice(20)` guess
    // is off by one for this (very common) single-digit-font case: it
    // recovers "9Hello", not "Hello", the trailing "9" being the font
    // digit's own last character. This is the exact "best-effort, fragile"
    // behavior the spec flags, ported faithfully rather than corrected.
    const record = '1' + '0010' + '0020' + '0001' + '0001' + '0009' + 'Hello';
    const source = ['\x02L', record, 'E'].join('\r\n');
    const result = parseDPL(source);

    expect(result.elements).toEqual([{ type: 'text', content: '9Hello', options: { x: 10, y: 20 } }]);
  });

  it('does not produce a text element for a digit-led record no longer than 20 chars', () => {
    const record = '123456789012345'; // 15 digit chars — long enough to be a RECORD, too short for the content-offset guess
    const source = ['\x02L', record, 'E'].join('\r\n');
    const result = parseDPL(source);

    expect(result.elements).toEqual([]);
  });

  it('records every digit-led line inside label mode as a RECORD command', () => {
    const record = '1' + '0005' + '0005' + '0080' + '0100' + '0002l'; // a real DplCompiler box record
    const source = ['\x02L', record, 'E'].join('\r\n');
    const result = parseDPL(source);

    expect(result.commands.some((c) => c.type === 'RECORD' && c.params === record)).toBe(true);
  });

  it('ignores blank lines', () => {
    const source = ['\x02L', '', '   ', 'D08'].join('\r\n');
    const result = parseDPL(source);

    expect(result.commands.map((c) => c.type)).toEqual(['STX_L', 'DENSITY']);
  });

  it('falls back to the default width when no A command is present', () => {
    const result = parseDPL('\x02L');
    expect(result.widthDots).toBe(832);
  });
});
