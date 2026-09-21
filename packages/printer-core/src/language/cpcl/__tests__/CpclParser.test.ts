import { CpclParser, parseCPCL } from '../CpclParser';

describe('CpclParser', () => {
  it('parses a full label into commands and a text PrintElement', () => {
    const source = ['! 0 203 203 240 1', 'TONE 107', 'SPEED 4', 'PAGE-WIDTH 320', 'TEXT 2 0 10 20', 'Hello', 'PRINT'].join('\r\n');
    const result = new CpclParser().parse(source);

    expect(result.commands.length).toBeGreaterThan(0);
    expect(result.warnings).toEqual([]);
  });

  it('extracts label dimensions and dpi from the session header, and a text element from TEXT', () => {
    const source = ['! 0 203 203 240 1', 'PAGE-WIDTH 320', 'TEXT 2 0 10 20', 'Hello'].join('\r\n');
    const result = parseCPCL(source);

    expect(result.dpi).toBe(203);
    expect(result.heightDots).toBe(240);
    expect(result.widthDots).toBe(320);
    expect(result.elements).toEqual([{ type: 'text', content: 'Hello', options: { x: 10, y: 20, font: '2', size: 0 } }]);
  });

  it('parses a rotated text field (TEXT90) into the right element, consuming the data line that follows', () => {
    const source = 'TEXT90 5 1 5 5\r\nRot';
    const result = parseCPCL(source);

    expect(result.elements).toEqual([{ type: 'text', content: 'Rot', options: { x: 5, y: 5, font: '5', size: 1 } }]);
  });

  it('parses a BOX command into a box PrintElement', () => {
    const source = 'BOX 0 0 100 50 2';
    const result = parseCPCL(source);

    expect(result.elements).toEqual([{ type: 'box', options: { x: 0, y: 0, width: 100, height: 50, thickness: 2 } }]);
  });

  it('parses a LINE command into a line PrintElement', () => {
    const source = 'LINE 10 50 300 50 2';
    const result = parseCPCL(source);

    expect(result.elements).toEqual([{ type: 'line', options: { x1: 10, y1: 50, x2: 300, y2: 50, thickness: 2 } }]);
  });

  it('records BARCODE/EG/PRINT commands it recognizes but does not turn into elements, matching portakal exactly', () => {
    const source = ['! 0 203 203 240 1', 'PAGE-WIDTH 320', 'BARCODE 128 2 2 50 5 5 12345', 'EG 3 1 10 10 FF00A5', 'PRINT'].join('\r\n');
    const result = parseCPCL(source);

    const cmds = result.commands.map((c) => c.cmd);
    expect(cmds).toEqual(['!', 'PAGE-WIDTH', 'BARCODE', 'EG', 'PRINT']);
    expect(result.elements).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('ignores blank lines', () => {
    const source = ['! 0 203 203 240 1', '', '   ', 'PAGE-WIDTH 320'].join('\r\n');
    const result = parseCPCL(source);

    expect(result.commands.map((c) => c.cmd)).toEqual(['!', 'PAGE-WIDTH']);
  });
});
