import { EscPosCompiler } from '../EscPosCompiler';
import { EscPosParser } from '../EscPosParser';
import type { EscPosParsedCommand } from '../EscPosParser';
import type { PrintElement } from '../../../document/elements/PrintElement';

/** Whether `needle` occurs as a contiguous run inside `haystack` — avoids relying on Node's `Buffer` global. */
function containsSubsequence(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.length === 0) return true;
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    let matches = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

describe('EscPosCompiler', () => {
  it('encodes non-ASCII text via the declared code page, not raw UTF-8', () => {
    const compiler = new EscPosCompiler();
    const bytes = compiler.compile(
      {
        widthDots: 384,
        heightDots: 0,
        dpi: 203,
        gapDots: 0,
        speed: 4,
        density: 8,
        direction: 'forward',
        copies: 1,
        elements: [{ type: 'text', content: 'café', options: {} }],
      },
      undefined, // falls back to DEFAULT_ENCODING (nativeUtf8: false)
    ).output;
    const naiveUtf8 = new TextEncoder().encode('café');
    // The café substring should NOT appear as raw UTF-8 bytes when a non-native-UTF8 encoding is used.
    expect(containsSubsequence(bytes, naiveUtf8)).toBe(false);
  });

  it('encodes non-ASCII text as raw UTF-8 when the encoding declares nativeUtf8', () => {
    const compiler = new EscPosCompiler();
    const nativeUtf8Encoding = { nativeUtf8: true, codePages: [] };
    const bytes = compiler.compile(
      {
        widthDots: 384,
        heightDots: 0,
        dpi: 203,
        gapDots: 0,
        speed: 4,
        density: 8,
        direction: 'forward',
        copies: 1,
        elements: [{ type: 'text', content: 'café', options: {} }],
      },
      nativeUtf8Encoding,
    ).output;
    const naiveUtf8 = new TextEncoder().encode('café');
    expect(containsSubsequence(bytes, naiveUtf8)).toBe(true);
  });

  it('round-trips a barcode element through parse', () => {
    const compiler = new EscPosCompiler();
    const bytes = compiler.compile({
      widthDots: 384,
      heightDots: 0,
      dpi: 203,
      gapDots: 0,
      speed: 4,
      density: 8,
      direction: 'forward',
      copies: 1,
      elements: [{ type: 'barcode', options: { symbology: 'code128', content: 'ABC123' } }],
    }).output;
    const parsed = new EscPosParser().parse(bytes);
    expect(parsed.commands.length).toBeGreaterThan(0);
  });

  it('round-trips a barcode element with the correct symbology code and content recovered by an independent parse', () => {
    const compiler = new EscPosCompiler();
    const bytes = compiler.compile({
      widthDots: 384,
      heightDots: 0,
      dpi: 203,
      gapDots: 0,
      speed: 4,
      density: 8,
      direction: 'forward',
      copies: 1,
      elements: [{ type: 'barcode', options: { symbology: 'code128', content: 'ABC123' } }],
    }).output;
    const parsed = new EscPosParser().parse(bytes) as { commands: EscPosParsedCommand[]; warnings: string[] };
    const barcodeCommand = parsed.commands.find((c) => c.name === 'GS k');

    expect(barcodeCommand).toBeDefined();
    expect(barcodeCommand?.params.type).toBe(73); // format-B CODE128 selector
    expect(barcodeCommand?.params.data).toBe('ABC123');
  });

  it('round-trips a QR code element: 5 "GS ( k" commands, and the stored data matches the content', () => {
    const compiler = new EscPosCompiler();
    const bytes = compiler.compile({
      widthDots: 384,
      heightDots: 0,
      dpi: 203,
      gapDots: 0,
      speed: 4,
      density: 8,
      direction: 'forward',
      copies: 1,
      elements: [{ type: 'qrcode', options: { content: 'hello-qr' } }],
    }).output;
    const parsed = new EscPosParser().parse(bytes) as { commands: EscPosParsedCommand[]; warnings: string[] };
    const twoDCommands = parsed.commands.filter((c) => c.name === 'GS ( k');

    expect(twoDCommands.length).toBe(5);

    // Fifth byte onward (after GS,(,k,pL,pH) is cn,fn,m,...data — fn 0x50 marks the store-data sub-command.
    const storeCommand = twoDCommands.find((c) => c.bytes[6] === 0x50);
    expect(storeCommand).toBeDefined();
    const dataBytes = storeCommand!.bytes.slice(8);
    expect(new TextDecoder().decode(new Uint8Array(dataBytes))).toBe('hello-qr');
  });

  it('emits a full-cut GS V command for a cut element', () => {
    const bytes = new EscPosCompiler().compile({
      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [{ type: 'cut', options: { mode: 'full' } }],
    }).output;
    expect(Array.from(bytes)).toEqual(expect.arrayContaining([0x1d, 0x56, 0x00]));
  });

  it('emits the 4-byte GS V m n form (function B) when cut options.rows is provided', () => {
    const bytes = new EscPosCompiler().compile({
      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [{ type: 'cut', options: { mode: 'full', rows: 3 } }],
    }).output;
    // GS V m n (function B): m=0x41 selects full cut, n=3 feeds 3 lines before cutting.
    expect(Array.from(bytes)).toEqual(expect.arrayContaining([0x1d, 0x56, 0x41, 0x03]));
  });

  it('emits the 4-byte GS V m n form with m=0x42 for a partial cut with rows provided', () => {
    const bytes = new EscPosCompiler().compile({
      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [{ type: 'cut', options: { mode: 'partial', rows: 5 } }],
    }).output;
    expect(Array.from(bytes)).toEqual(expect.arrayContaining([0x1d, 0x56, 0x42, 0x05]));
  });

  it('emits nothing for cut mode off', () => {
    const withCut = new EscPosCompiler().compile({
      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [{ type: 'cut', options: { mode: 'off' } }],
    }).output;
    const withoutCut = new EscPosCompiler().compile({
      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [],
    }).output;
    expect(withCut).toEqual(withoutCut);
  });

  it('emits table rows as text lines', () => {
    const bytes = new EscPosCompiler().compile({
      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [{ type: 'table', options: { columns: [{ width: 10 }], rows: [['hello']] } }],
    }).output;
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('hello');
  });

  it('throws a clear error when a table column has a non-positive width instead of silently dropping its content', () => {
    expect(() =>
      new EscPosCompiler().compile({
        widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
        elements: [{ type: 'table', options: { columns: [{ width: 10 }, { width: 0 }], rows: [['hello', 'world']] } }],
      }).output,
    ).toThrow(/positive width/);
  });

  it('no-ops for pageBreak/spacer/row/column/diagonal', () => {
    const noOpElements: PrintElement[] = [
      { type: 'pageBreak' },
      { type: 'spacer', options: { size: 5 } },
      { type: 'row', options: {} },
      { type: 'column', options: {} },
      { type: 'diagonal', options: { x1: 0, y1: 0, x2: 5, y2: 5 } },
    ];
    for (const el of noOpElements) {
      const withEl = new EscPosCompiler().compile({
        widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
        elements: [el],
      }).output;
      const without = new EscPosCompiler().compile({
        widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
        elements: [],
      }).output;
      expect(withEl).toEqual(without);
    }
  });

  it('fontSize 48 → GS ! 0x11 (phóng đại 2 lần mỗi chiều) trước chữ và reset GS ! 0 sau chữ', () => {
    const bytes = new EscPosCompiler().compile({
      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [{ type: 'text', content: 'Hi', options: { fontSize: 48 } }],
    }).output;

    expect(containsSubsequence(bytes, new Uint8Array([0x1d, 0x21, 0x11, 0x48, 0x69, 0x0a]))).toBe(true);
    expect(containsSubsequence(bytes, new Uint8Array([0x1d, 0x21, 0x00]))).toBe(true);
  });

  it('fontSize 24 là cỡ gốc của font A nên không phát GS !', () => {
    const bytes = new EscPosCompiler().compile({
      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [{ type: 'text', content: 'Hi', options: { fontSize: 24 } }],
    }).output;

    expect(containsSubsequence(bytes, new Uint8Array([0x1d, 0x21]))).toBe(false);
  });

  it('cảnh báo từng loại element ESC/POS không có lệnh vẽ, mỗi loại 1 lần', () => {
    const { warnings } = new EscPosCompiler().compile({
      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [
        { type: 'box', options: { x: 0, y: 0, width: 10, height: 10 } },
        { type: 'line', options: { x1: 0, y1: 0, x2: 10, y2: 0 } },
        { type: 'diagonal', options: { x1: 0, y1: 0, x2: 10, y2: 10 } },
        { type: 'circle', options: { x: 0, y: 0, diameter: 20 } },
        { type: 'circle', options: { x: 5, y: 5, diameter: 20 } },
        { type: 'ellipse', options: { x: 0, y: 0, width: 20, height: 10 } },
        { type: 'reverse', options: { x: 0, y: 0, width: 20, height: 10 } },
        { type: 'erase', options: { x: 0, y: 0, width: 20, height: 10 } },
      ],
    });

    expect(warnings).toEqual(
      ['box', 'line', 'diagonal', 'circle', 'ellipse', 'reverse', 'erase'].map(
        (type) => `Element "${type}" bị bỏ qua — ESC/POS không có lệnh tương ứng.`,
      ),
    );
  });

  it('element được hỗ trợ thì không có cảnh báo', () => {
    const { warnings } = new EscPosCompiler().compile({
      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [
        { type: 'text', content: 'Hi', options: { fontSize: 48 } },
        { type: 'qrcode', options: { x: 0, y: 0, content: 'hi' } },
        { type: 'cut', options: { mode: 'partial', rows: 3 } },
      ],
    });

    expect(warnings).toEqual([]);
  });

  it('cỡ chữ mặc định của template (12px ≈ 25.4 dots ở 203 dpi) in cỡ thường, không phát GS !', () => {
    const bytes = new EscPosCompiler().compile({
      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [{ type: 'text', content: 'Hi', options: { fontSize: 25.375 } }],
    }).output;

    expect(containsSubsequence(bytes, new Uint8Array([0x1d, 0x21]))).toBe(false);
  });
});
