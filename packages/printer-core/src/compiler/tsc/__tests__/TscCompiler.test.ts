import { TscCompiler } from '../TscCompiler';

describe('TscCompiler', () => {
  it('emits a BITMAP command with an actual payload, not a bare trailing comma', () => {
    const compiler = new TscCompiler();
    const output = compiler.compile({
      widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 0, copies: 1,
      elements: [{ type: 'image', bitmap: { data: new Uint8Array([0xff, 0x00]), width: 16, height: 1, bytesPerRow: 2 }, options: {} }],
    });
    expect(output).toContain('BITMAP');
    expect(output.trim().endsWith('BITMAP 0,0,2,1,0,')).toBe(false); // must not end with a bare trailing comma
  });

  it('appends the actual bitmap bytes after the BITMAP header, not just a longer string', () => {
    const compiler = new TscCompiler();
    const bitmap = { data: new Uint8Array([0xff, 0x00]), width: 16, height: 1, bytesPerRow: 2 };
    const output = compiler.compile({
      widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 0, copies: 1,
      elements: [{ type: 'image', bitmap, options: {} }],
    });

    const headerIndex = output.indexOf('BITMAP 0,0,2,1,0,');
    expect(headerIndex).toBeGreaterThanOrEqual(0);
    const afterHeader = output.slice(headerIndex + 'BITMAP 0,0,2,1,0,'.length);
    expect(afterHeader.charCodeAt(0)).toBe(0xff);
    expect(afterHeader.charCodeAt(1)).toBe(0x00);
  });

  it('compiles a full label header followed by text, box, and PRINT commands', () => {
    const compiler = new TscCompiler();
    const output = compiler.compile({
      widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 0, copies: 1,
      elements: [
        { type: 'text', content: 'Hello', options: { x: 10, y: 10 } },
        { type: 'box', options: { x: 0, y: 0, width: 100, height: 50, thickness: 2 } },
      ],
    });

    const lines = output.trim().split('\r\n');
    expect(lines[0]).toBe('SIZE 40 mm,30 mm');
    expect(lines).toContain('CLS');
    expect(lines).toContain('TEXT 10,10,"2",0,1,1,"Hello"');
    expect(lines).toContain('BOX 0,0,100,50,2');
    expect(lines[lines.length - 1]).toBe('PRINT 1');
  });
});
