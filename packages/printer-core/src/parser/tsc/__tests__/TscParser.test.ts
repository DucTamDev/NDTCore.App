import { TscParser, parseTSPL } from '../TscParser';

describe('TscParser', () => {
  it('parses a SIZE + CLS + TEXT + PRINT sequence', () => {
    const source = 'SIZE 40 mm,30 mm\nGAP 3 mm,0\nCLS\nTEXT 10,10,"3",0,1,1,"Hello"\nPRINT 1\n';
    const result = new TscParser().parse(source);
    expect(result.warnings).toEqual([]);
    expect(result.commands.length).toBeGreaterThan(0);
  });

  it('extracts label dimensions from SIZE and a text element from TEXT', () => {
    const source = 'SIZE 40 mm,30 mm\nGAP 3 mm,0 mm\nCLS\nTEXT 10,10,"3",0,1,1,"Hello"\nPRINT 1\n';
    const result = parseTSPL(source);
    expect(result.widthDots).toBe(320); // 40mm @ 203dpi
    expect(result.heightDots).toBe(240); // 30mm @ 203dpi
    expect(result.elements).toEqual([{ type: 'text', content: 'Hello', options: { x: 10, y: 10, font: '3', rotation: 0, size: 1 } }]);
  });

  it('round-trips BOX/BARCODE/QRCODE commands emitted by TscCompiler back into structured commands', () => {
    const source = [
      'SIZE 40 mm,30 mm',
      'GAP 3 mm,0 mm',
      'SPEED 4',
      'DENSITY 8',
      'DIRECTION 0',
      'CLS',
      'BOX 0,0,100,50,2',
      'BARCODE 0,0,"128",50,1,0,2,2,"123456789"',
      'QRCODE 0,0,M,4,A,0,"hello"',
      'PRINT 1',
    ].join('\r\n');

    const result = parseTSPL(source);
    expect(result.warnings).toEqual([]);
    const cmdNames = result.commands.map((c) => c.cmd);
    expect(cmdNames).toEqual(['SIZE', 'GAP', 'SPEED', 'DENSITY', 'DIRECTION', 'CLS', 'BOX', 'BARCODE', 'QRCODE', 'PRINT']);
  });

  it('flags a genuinely unrecognized command as UNKNOWN (parser-level; range/order checks are the validator\'s job)', () => {
    const result = parseTSPL('NOTAREALCOMMAND 1,2,3\n');
    expect(result.commands).toEqual([{ cmd: 'UNKNOWN', raw: 'NOTAREALCOMMAND 1,2,3' }]);
  });
});
