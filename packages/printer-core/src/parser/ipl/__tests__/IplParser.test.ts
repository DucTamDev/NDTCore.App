import { IplParser, parseIPL } from '../IplParser';

const STX = '\x02';
const ETX = '\x03';
const ESC = '\x1b';

describe('IplParser', () => {
  it('parses a full label into commands, with no warnings', () => {
    const source = [
      `${STX}${ESC}C1${ETX}`,
      `${STX}${ESC}P${ETX}`,
      `${STX}<SI>L400${ETX}`,
      `${STX}<SI>W320${ETX}`,
      `${STX}R${ETX}`,
      `${STX}${ESC}E1${ETX}`,
    ].join('');
    const result = new IplParser().parse(source);

    expect(result.commands.length).toBeGreaterThan(0);
    expect(result.warnings).toEqual([]);
  });

  it('recognizes ESC C as CREATE_FORMAT and ESC E as END_FORMAT', () => {
    const source = [`${STX}${ESC}C1${ETX}`, `${STX}${ESC}E1${ETX}`].join('');
    const result = parseIPL(source);

    expect(result.commands[0]).toEqual({ type: 'CREATE_FORMAT', params: '1' });
    expect(result.commands[result.commands.length - 1]).toEqual({ type: 'END_FORMAT', params: '1' });
  });

  it('recognizes R as PRINT', () => {
    const result = parseIPL(`${STX}R${ETX}`);
    expect(result.commands).toContainEqual({ type: 'PRINT', params: '' });
  });

  it('extracts label width and height from <SI>W and <SI>L', () => {
    const source = [`${STX}<SI>L240${ETX}`, `${STX}<SI>W320${ETX}`].join('');
    const result = parseIPL(source);

    expect(result.heightDots).toBe(240);
    expect(result.widthDots).toBe(320);
  });

  it('records speed and darkness config commands', () => {
    const source = [`${STX}<SI>S60${ETX}`, `${STX}<SI>d10${ETX}`].join('');
    const result = parseIPL(source);

    const types = result.commands.map((c) => c.type);
    expect(types).toContain('SPEED');
    expect(types).toContain('DARKNESS');
  });

  it('recovers a text element from an H field', () => {
    const result = parseIPL(`${STX}H1;o50,30;f0;h12;w12;c26;d3,Hello IPL${ETX}`);

    expect(result.elements).toContainEqual({ type: 'text', content: 'Hello IPL', options: { x: 50, y: 30 } });
  });

  it('recovers a box element from a W field', () => {
    const result = parseIPL(`${STX}W1;o10,20;f0;l200;h100;w2${ETX}`);

    expect(result.elements).toContainEqual({
      type: 'box',
      options: { x: 10, y: 20, width: 200, height: 100, thickness: 2 },
    });
  });

  it('recovers a horizontal line element from an L field with format 0', () => {
    const result = parseIPL(`${STX}L1;o10,50;f0;l290;w2${ETX}`);

    expect(result.elements).toContainEqual({
      type: 'line',
      options: { x1: 10, y1: 50, x2: 300, y2: 50, thickness: 2 },
    });
  });

  it('recovers a vertical line element from an L field with format 1', () => {
    const result = parseIPL(`${STX}L1;o50,10;f1;l190;w1${ETX}`);

    expect(result.elements).toContainEqual({
      type: 'line',
      options: { x1: 50, y1: 10, x2: 50, y2: 200, thickness: 1 },
    });
  });

  it('records unrecognized frames as UNKNOWN', () => {
    const result = parseIPL(`${STX}ZZZ${ETX}`);
    expect(result.commands).toContainEqual({ type: 'UNKNOWN', params: 'ZZZ' });
  });

  it('falls back to the default width/height when no <SI> commands are present', () => {
    const result = parseIPL(`${STX}${ESC}C1${ETX}`);
    expect(result.widthDots).toBe(832);
    expect(result.heightDots).toBe(400);
  });
});
