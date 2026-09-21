import { SbplParser, parseSBPL } from '../SbplParser';

describe('SbplParser', () => {
  it('parses a full label into commands and a text PrintElement', () => {
    const source = '\x1bA\x1bCS\x1bH0010\x1bV0020\x1bL0101\x1bK9BHello\x1bZ';
    const result = new SbplParser().parse(source);

    expect(result.commands.length).toBeGreaterThan(0);
    expect(result.warnings).toEqual([]);
  });

  it('tracks the last H/V position and attaches it to the following K9B text field', () => {
    const source = '\x1bH0100\x1bV0050\x1bL0202\x1bK9BHello SATO';
    const result = parseSBPL(source);

    expect(result.elements).toEqual([{ type: 'text', content: 'Hello SATO', options: { x: 100, y: 50 } }]);
  });

  it('resets to x=0,y=0 when no H/V position was set before the text field', () => {
    const source = '\x1bK9BNoPosition';
    const result = parseSBPL(source);

    expect(result.elements).toEqual([{ type: 'text', content: 'NoPosition', options: { x: 0, y: 0 } }]);
  });

  it('records START/CLEAR/END session commands', () => {
    const source = '\x1bA\x1bCS\x1bZ';
    const result = parseSBPL(source);

    expect(result.commands).toEqual([
      { cmd: 'START', params: '' },
      { cmd: 'CLEAR', params: 'S' },
      { cmd: 'END', params: '' },
    ]);
  });

  it('records a BOX/line draw field (FW) and a GRAPHIC field (GM) as commands without turning them into elements, matching portakal exactly', () => {
    const source = '\x1bH0010\x1bV0020\x1bFW02V0100H0200\x1bGM00002,FF00';
    const result = parseSBPL(source);

    const cmds = result.commands.map((c) => c.cmd);
    expect(cmds).toEqual(['H', 'V', 'DRAW', 'GRAPHIC']);
    expect(result.elements).toEqual([]);
  });

  it('records recognized-but-opaque barcode/2D-barcode commands, matching portakal exactly', () => {
    const source = '\x1bB123\x1bD456\x1b2D789';
    const result = parseSBPL(source);

    expect(result.commands).toEqual([
      { cmd: 'BARCODE_B', params: '123' },
      { cmd: 'BARCODE_D', params: '456' },
      { cmd: '2D_BARCODE', params: 'D789' },
    ]);
  });

  it('records an unrecognized ESC-prefixed letter under its own raw character', () => {
    const source = '\x1bX123';
    const result = parseSBPL(source);

    expect(result.commands).toEqual([{ cmd: 'X', params: '123' }]);
  });

  it('parses the quantity command', () => {
    const source = '\x1bQ3';
    const result = parseSBPL(source);

    expect(result.commands).toEqual([{ cmd: 'QUANTITY', params: '3' }]);
  });
});
