import { ZplParser, parseZPL, tokenize } from '../ZplParser';

describe('ZplParser', () => {
  it('tokenizes ^XA...^XZ into commands, keeping ^FD field data intact through embedded characters', () => {
    const commands = tokenize('^XA^FO10,20^A0N,30,30^FDHello, world^FS^XZ');
    const codes = commands.map((c) => c.code);
    expect(codes).toEqual(['^XA', '^FO', '^A0', '^FD', '^FS', '^XZ']);
    const fd = commands.find((c) => c.code === '^FD');
    expect(fd?.rawParams).toBe('Hello, world');
  });

  it('parses a full label into commands and a text PrintElement', () => {
    const source = '^XA^PW320^LL240^FO10,20^A0N,30,30^FDHello^FS^PQ1^XZ';
    const result = new ZplParser().parse(source);
    expect(result.warnings).toEqual([]);
    expect(result.commands.length).toBeGreaterThan(0);
  });

  it('extracts label dimensions from ^PW/^LL and a text element from ^FO/^FD', () => {
    const source = '^XA^PW320^LL240^FO10,20^A0N,30,30^FDHello^FS^XZ';
    const result = parseZPL(source);
    expect(result.widthDots).toBe(320);
    expect(result.heightDots).toBe(240);
    expect(result.elements).toEqual([
      { type: 'text', content: 'Hello', options: { x: 10, y: 20, font: '0', size: 1, xScale: 30, yScale: 30, reverse: undefined, maxWidth: undefined, align: undefined } },
    ]);
  });

  it('adjusts ^FT baseline positioning back to a top-left y for the emitted text element', () => {
    const source = '^XA^FT10,50^A0N,20,20^FDBase^FS^XZ';
    const result = parseZPL(source);
    expect(result.elements).toEqual([
      { type: 'text', content: 'Base', options: { x: 10, y: 30, font: '0', size: 1, xScale: 20, yScale: 20, reverse: undefined, maxWidth: undefined, align: undefined } },
    ]);
  });

  it('parses ^GD into a diagonal PrintElement, not a box or line', () => {
    const source = '^XA^FO0,0^GD100,50,2,B,R^FS^XZ';
    const result = parseZPL(source);
    expect(result.elements).toEqual([{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }]);
  });

  it('parses a white filled ^GB as an erase element instead of a box', () => {
    const source = '^XA^FO10,10^GB50,50,50,W^FS^XZ';
    const result = parseZPL(source);
    expect(result.elements).toEqual([{ type: 'erase', options: { x: 10, y: 10, width: 50, height: 50 } }]);
  });

  it('parses a normal (non-filled, non-white) ^GB as a box element', () => {
    const source = '^XA^FO0,0^GB100,50,2^FS^XZ';
    const result = parseZPL(source);
    expect(result.elements).toEqual([{ type: 'box', options: { x: 0, y: 0, width: 100, height: 50, thickness: 2, radius: 0 } }]);
  });

  it('round-trips BARCODE/QRCODE-style ^B fields emitted by ZplCompiler back into commands with no warnings', () => {
    const source = ['^XA', '^PW320', '^LL240', '^BY2,3,50', '^FO0,0^BCN,50,Y', '^FD123456789^FS', '^PQ1', '^XZ'].join('');
    const result = parseZPL(source);
    expect(result.warnings).toEqual([]);
    const codes = result.commands.map((c) => c.code);
    expect(codes).toContain('^BC');
    expect(codes).toContain('^BY');
  });

  it('flags a genuinely unrecognized command as a warning (parser-level; range/order checks are the validator\'s job)', () => {
    const result = parseZPL('^ZQnotreal');
    expect(result.warnings).toEqual(['Unknown command: ^ZQ']);
  });

  it('does not warn about ^FS itself even though it has no dedicated data to report', () => {
    const result = parseZPL('^XA^FS^XZ');
    expect(result.warnings).toEqual([]);
  });
});
