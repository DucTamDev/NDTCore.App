import { EplParser, parseEPL } from '../EplParser';

describe('EplParser', () => {
  it('parses a full label into commands and a text PrintElement', () => {
    const source = ['N', 'q320', 'Q240,24', 'S4', 'D8', 'A10,20,0,2,1,1,N,"Hello"', 'P1'].join('\n');
    const result = new EplParser().parse(source);

    expect(result.commands.length).toBeGreaterThan(0);
    expect(result.warnings).toEqual([]);
  });

  it('extracts label dimensions from q/Q and a text element from A', () => {
    const source = ['N', 'q320', 'Q240,24', 'A10,20,0,2,1,1,N,"Hello"'].join('\n');
    const result = parseEPL(source);

    expect(result.widthDots).toBe(320);
    expect(result.heightDots).toBe(240);
    expect(result.elements).toEqual([
      { type: 'text', content: 'Hello', options: { x: 10, y: 20, rotation: 0, font: '2', size: 1, reverse: undefined } },
    ]);
  });

  it('parses a rotated, reversed text field back into the right Rotation and reverse flag', () => {
    const source = 'A5,5,1,3,2,2,R,"Rot"';
    const result = parseEPL(source);

    expect(result.elements).toEqual([{ type: 'text', content: 'Rot', options: { x: 5, y: 5, rotation: 90, font: '3', size: 2, reverse: true } }]);
  });

  it('parses an X command into a box PrintElement', () => {
    const source = 'X0,0,100,50,2';
    const result = parseEPL(source);

    expect(result.elements).toEqual([{ type: 'box', options: { x: 0, y: 0, width: 100, height: 50, thickness: 2 } }]);
  });

  it('parses an LO command into a line PrintElement', () => {
    // LO x,y,width,thickness (the shape EplCompiler emits for a horizontal
    // line) — ported straight from portakal's own (width-vs-thickness-only)
    // y2 derivation: since thickness (2) isn't greater than width (290), y2
    // stays at y1.
    const source = 'LO10,50,290,2';
    const result = parseEPL(source);

    expect(result.elements).toEqual([{ type: 'line', options: { x1: 10, y1: 50, x2: 300, y2: 50, thickness: 2 } }]);
  });

  it('records every recognized command line, including ones it does not turn into an element', () => {
    const source = ['N', 'q320', 'S4', 'D8', 'GW0,0,1,1,', 'P1'].join('\n');
    const result = parseEPL(source);

    const cmds = result.commands.map((c) => c.cmd);
    expect(cmds).toEqual(['N', 'q', 'S', 'D', 'G', 'P']);
  });

  it('silently skips an unrecognized command char, matching portakal exactly (no warning)', () => {
    // 'Y' is not one of the letters EplParser's switch recognizes (unlike
    // 'Z', which is a real EPL2 command char it reads-and-discards).
    const result = parseEPL('Ynotreal');
    expect(result.warnings).toEqual([]);
    expect(result.commands).toEqual([{ cmd: 'Y', raw: 'notreal' }]);
    expect(result.elements).toEqual([]);
  });

  it('ignores blank lines', () => {
    const source = ['N', '', '   ', 'q320'].join('\n');
    const result = parseEPL(source);

    expect(result.commands.map((c) => c.cmd)).toEqual(['N', 'q']);
  });
});
