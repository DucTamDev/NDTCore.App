import { StarPrntCompiler } from '../StarPrntCompiler';
import type { PrintElement } from '../../../builder';
import { STAR_PROFILES, type PrinterProfile } from '../../../profile';

const BASE = { widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward' as const, copies: 1 };

describe('StarPrntCompiler', () => {
  it('starts with ESC @ (initialize)', () => {
    const bytes = new StarPrntCompiler().compile({ ...BASE, elements: [] });
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x1b, 0x40]);
  });

  it('returns a Uint8Array', () => {
    const bytes = new StarPrntCompiler().compile({ ...BASE, elements: [] });
    expect(bytes).toBeInstanceOf(Uint8Array);
  });

  it('generates text content followed by a line feed', () => {
    const bytes = new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'text', content: 'Hello Star' }] });
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('Hello Star');
  });

  it('generates Star alignment: ESC GS a n for a centered text element', () => {
    const bytes = Array.from(
      new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'text', content: 'Center', options: { align: 'center' } }] }),
    );
    const idx = bytes.findIndex((b, i) => b === 0x1b && bytes[i + 1] === 0x1d && bytes[i + 2] === 0x61);
    expect(idx).toBeGreaterThan(-1);
    expect(bytes[idx + 3]).toBe(1);
  });

  it('generates Star bold: ESC E (on) then ESC F (off)', () => {
    const bytes = Array.from(
      new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'text', content: 'Bold', options: { bold: true } }] }),
    );
    const onIdx = bytes.findIndex((b, i) => b === 0x1b && bytes[i + 1] === 0x45);
    const offIdx = bytes.findIndex((b, i) => b === 0x1b && bytes[i + 1] === 0x46);
    expect(onIdx).toBeGreaterThan(-1);
    expect(offIdx).toBeGreaterThan(onIdx);
  });

  it('generates Star size magnification: ESC i h w', () => {
    const bytes = Array.from(
      new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'text', content: 'Big', options: { size: 3 } }] }),
    );
    const idx = bytes.findIndex((b, i) => b === 0x1b && bytes[i + 1] === 0x69);
    expect(idx).toBeGreaterThan(-1);
    expect(bytes[idx + 2]).toBe(3);
    expect(bytes[idx + 3]).toBe(3);
  });

  it('generates Star raster mode for an image element, one raster row per bitmap row', () => {
    const bitmap = { data: new Uint8Array([0xff, 0x00, 0xaa, 0x55]), width: 8, height: 4, bytesPerRow: 1 };
    const bytes = Array.from(new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'image', bitmap, options: {} }] }));

    const enterIdx = bytes.findIndex((b, i) => b === 0x1b && bytes[i + 1] === 0x2a && bytes[i + 2] === 0x72 && bytes[i + 3] === 0x41);
    const exitIdx = bytes.findIndex((b, i) => b === 0x1b && bytes[i + 1] === 0x2a && bytes[i + 2] === 0x72 && bytes[i + 3] === 0x42);
    expect(enterIdx).toBeGreaterThan(-1);
    expect(exitIdx).toBeGreaterThan(enterIdx);

    let rasterLineCount = 0;
    for (let i = enterIdx + 4; i < exitIdx; i++) {
      if (bytes[i] === 0x62) rasterLineCount++;
    }
    expect(rasterLineCount).toBe(4);
  });

  it('passes raw bytes straight through', () => {
    const bytes = Array.from(new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'raw', content: new Uint8Array([0x07]) }] }));
    expect(bytes).toContain(0x07);
  });

  it('emits ESC d 1 for a cut element with mode "partial"', () => {
    const bytes = Array.from(new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'cut', options: { mode: 'partial' } }] }));
    expect(bytes.slice(-3)).toEqual([0x1b, 0x64, 1]);
  });

  it('emits the same ESC d 1 command for a cut element with mode "full" (no distinct full-cut byte is grounded in the source protocol)', () => {
    const bytes = Array.from(new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'cut', options: { mode: 'full' } }] }));
    expect(bytes.slice(-3)).toEqual([0x1b, 0x64, 1]);
  });

  it('emits nothing for a cut element with mode "off"', () => {
    const withCut = new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'cut', options: { mode: 'off' } }] });
    const without = new StarPrntCompiler().compile({ ...BASE, elements: [] });
    expect(withCut).toEqual(without);
  });

  it('does not append a trailing cut when no cut element is present', () => {
    const bytes = Array.from(new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'text', content: 'no cut here' }] }));
    expect(bytes.slice(-3)).not.toEqual([0x1b, 0x64, 1]);
  });

  it('emits table rows as text lines', () => {
    const bytes = new StarPrntCompiler().compile({
      ...BASE,
      elements: [{ type: 'table', options: { columns: [{ width: 10 }], rows: [['hello']] } }],
    });
    expect(new TextDecoder().decode(bytes)).toContain('hello');
  });

  it('throws a clear error when a table column has a non-positive width', () => {
    expect(() =>
      new StarPrntCompiler().compile({
        ...BASE,
        elements: [{ type: 'table', options: { columns: [{ width: 10 }, { width: 0 }], rows: [['hello', 'world']] } }],
      }),
    ).toThrow(/positive width/);
  });

  it('accepts a PrinterProfile argument without changing its output (Star PRNT text is not yet profile-driven)', () => {
    const profile: PrinterProfile = STAR_PROFILES['star-tsp143']!;
    const elements: PrintElement[] = [{ type: 'text', content: 'Profile', options: { bold: true, size: 2 } }];

    const withProfile = new StarPrntCompiler().compile({ ...BASE, elements }, profile);
    const withoutProfile = new StarPrntCompiler().compile({ ...BASE, elements });

    expect(withProfile).toEqual(withoutProfile);
    expect(new TextDecoder().decode(withProfile)).toContain('Profile');
  });

  it('no-ops for box/line/diagonal/circle/ellipse/reverse/erase/pageBreak/spacer/row/column/barcode/qrcode', () => {
    const noOpElements: PrintElement[] = [
      { type: 'box', options: { x: 0, y: 0, width: 10, height: 10 } },
      { type: 'line', options: { x1: 0, y1: 0, x2: 10, y2: 0 } },
      { type: 'diagonal', options: { x1: 0, y1: 0, x2: 5, y2: 5 } },
      { type: 'circle', options: { x: 0, y: 0, diameter: 10 } },
      { type: 'ellipse', options: { x: 0, y: 0, width: 10, height: 5 } },
      { type: 'reverse', options: { x: 0, y: 0, width: 10, height: 10 } },
      { type: 'erase', options: { x: 0, y: 0, width: 10, height: 10 } },
      { type: 'pageBreak' },
      { type: 'spacer', options: { size: 5 } },
      { type: 'row', options: {} },
      { type: 'column', options: {} },
      { type: 'barcode', options: { symbology: 'code128', content: 'ABC123' } },
      { type: 'qrcode', options: { content: 'hello-qr' } },
    ];
    const without = new StarPrntCompiler().compile({ ...BASE, elements: [] });
    for (const el of noOpElements) {
      const withEl = new StarPrntCompiler().compile({ ...BASE, elements: [el] });
      expect(withEl).toEqual(without);
    }
  });
});
