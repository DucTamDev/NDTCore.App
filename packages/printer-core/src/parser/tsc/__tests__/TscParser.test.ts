import { TscParser, parseTSPL } from '../TscParser';
import { TscCompiler } from '../../../compiler/tsc/TscCompiler';
import type { ResolvedPrintDocument } from '../../../document';

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

  it('normalizes an out-of-range TEXT rotation to 0 instead of asserting it into Rotation', () => {
    const source = 'SIZE 40 mm,30 mm\nCLS\nTEXT 0,0,"3",45,1,1,"x"\n';
    const result = parseTSPL(source);
    expect(result.elements).toEqual([{ type: 'text', content: 'x', options: { x: 0, y: 0, font: '3', rotation: 0, size: 1 } }]);
  });

  it('normalizes an out-of-range BLOCK rotation to 0 instead of asserting it into Rotation', () => {
    const source = 'SIZE 40 mm,30 mm\nCLS\nBLOCK 0,0,100,50,"3",45,1,1,"x"\n';
    const result = parseTSPL(source);
    expect(result.elements).toEqual([{ type: 'text', content: 'x', options: { x: 0, y: 0, font: '3', rotation: 0, size: 1, maxWidth: 100 } }]);
  });

  it('parses a DIAGONAL command into a diagonal PrintElement, not a line element', () => {
    const source = 'SIZE 40 mm,30 mm\nCLS\nDIAGONAL 0,0,100,50,2\n';
    const result = parseTSPL(source);
    expect(result.commands).toContainEqual({ cmd: 'DIAGONAL', x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 });
    expect(result.elements).toEqual([{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }]);
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

  describe('known limitation: BITMAP payload bytes containing 0x0A fracture re-parsing', () => {
    /**
     * `TscCompiler`/`encodeTscBitmapPayload` embed the bitmap's raw bytes
     * directly into the `\r\n`-joined TSPL document string (see
     * TscEncoder.ts). `TscParser` tokenizes the whole document with
     * `code.split(/\r?\n/)` *before* any command-specific parsing runs, and
     * the BITMAP branch only reads its 5 header parameters — it has no
     * byte-count-aware logic to consume/skip the payload that follows. A
     * payload byte of 0x0A (line feed) is real bitmap data a printer will
     * happily accept over the wire, but it also matches `\r?\n` and
     * therefore splits the document mid-payload on re-parse: everything
     * after the split point (the rest of the payload, and every line after
     * it) is re-tokenized as if it started a new command. Depending on the
     * exact byte values, this can corrupt the BITMAP command's own numeric
     * fields and/or spawn spurious extra commands (most falling into
     * `UNKNOWN`) from leftover payload bytes that don't match any real
     * command grammar.
     *
     * This is a known, accepted limitation of the line-based parser port
     * (preserving portakal's exact grammar/tokenization, not fixed here) —
     * it does NOT affect what a real printer receives, since the transport
     * sends the compiled string's bytes as-is. It DOES mean `TscParser`
     * cannot faithfully round-trip a `TscCompiler`-produced document that
     * contains an image element whose payload happens to contain 0x0A.
     * This test pins the CURRENT (broken) parse behavior — traced by hand
     * against the compiled string below and confirmed by running it — so
     * the gap stays visible instead of silently unverified.
     */
    it('spawns a spurious UNKNOWN command from a BITMAP payload byte after a 0x0A split', () => {
      const doc: ResolvedPrintDocument = {
        widthDots: 320,
        heightDots: 240,
        dpi: 203,
        gapDots: 24,
        speed: 4,
        density: 8,
        direction: 'forward',
        copies: 1,
        elements: [{ type: 'image', bitmap: { data: new Uint8Array([0x41, 0x0a, 0x42]), width: 24, height: 1, bytesPerRow: 3 }, options: {} }],
      };

      const compiled = new TscCompiler().compile(doc);
      // Compiled BITMAP line: `BITMAP 0,0,3,1,0,A\nB` — the payload's own
      // 0x0A byte (between "A" and "B") is indistinguishable from a real
      // line break once the document is tokenized.
      expect(compiled).toContain('BITMAP 0,0,3,1,0,A\nB');

      const result = parseTSPL(compiled);
      const cmdNames = result.commands.map((c) => c.cmd);

      // A clean round-trip would produce exactly 8 commands (SIZE, GAP,
      // SPEED, DENSITY, DIRECTION, CLS, BITMAP, PRINT). The leaked "B" byte
      // (0x42) lands on its own fractured "line", matches no known command,
      // and is recorded as an extra UNKNOWN — corrupting the command count
      // and stream instead of being consumed as bitmap data.
      expect(cmdNames).toEqual(['SIZE', 'GAP', 'SPEED', 'DENSITY', 'DIRECTION', 'CLS', 'BITMAP', 'UNKNOWN', 'PRINT']);
      expect(result.commands.find((c) => c.cmd === 'UNKNOWN')).toEqual({ cmd: 'UNKNOWN', raw: 'B' });
    });
  });
});
