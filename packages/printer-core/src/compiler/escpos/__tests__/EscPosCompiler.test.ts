import { EscPosCompiler } from '../EscPosCompiler';
import { EscPosParser } from '../../../parser/escpos/EscPosParser';
import type { EscPosParsedCommand } from '../../../parser/escpos/EscPosParser';

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
  it('encodes non-ASCII text via the profile code page, not raw UTF-8', () => {
    const compiler = new EscPosCompiler();
    const bytes = compiler.compile(
      {
        widthDots: 384,
        heightDots: 0,
        dpi: 203,
        gapDots: 0,
        speed: 4,
        density: 8,
        direction: 0,
        copies: 1,
        elements: [{ type: 'text', content: 'café', options: {} }],
      },
      undefined, // falls back to DEFAULT_PROFILE (nativeUtf8: false)
    );
    const naiveUtf8 = new TextEncoder().encode('café');
    // The café substring should NOT appear as raw UTF-8 bytes when a non-native-UTF8 profile is used.
    expect(containsSubsequence(bytes, naiveUtf8)).toBe(false);
  });

  it('encodes non-ASCII text as raw UTF-8 when the profile declares nativeUtf8', () => {
    const compiler = new EscPosCompiler();
    const nativeUtf8Profile = {
      name: 'Test',
      vendor: 'Generic' as const,
      language: 'escpos' as const,
      paperWidth: 80,
      dotsPerLine: 384,
      dpi: 203,
      charsPerLine: 48,
      features: { cutter: 'none' as const, cashDrawer: false, imageMode: [], cjk: false, nativeUtf8: true, codePages: [] },
    };
    const bytes = compiler.compile(
      {
        widthDots: 384,
        heightDots: 0,
        dpi: 203,
        gapDots: 0,
        speed: 4,
        density: 8,
        direction: 0,
        copies: 1,
        elements: [{ type: 'text', content: 'café', options: {} }],
      },
      nativeUtf8Profile,
    );
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
      direction: 0,
      copies: 1,
      elements: [{ type: 'barcode', options: { symbology: 'code128', content: 'ABC123' } }],
    });
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
      direction: 0,
      copies: 1,
      elements: [{ type: 'barcode', options: { symbology: 'code128', content: 'ABC123' } }],
    });
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
      direction: 0,
      copies: 1,
      elements: [{ type: 'qrcode', options: { content: 'hello-qr' } }],
    });
    const parsed = new EscPosParser().parse(bytes) as { commands: EscPosParsedCommand[]; warnings: string[] };
    const twoDCommands = parsed.commands.filter((c) => c.name === 'GS ( k');

    expect(twoDCommands.length).toBe(5);

    // Fifth byte onward (after GS,(,k,pL,pH) is cn,fn,m,...data — fn 0x50 marks the store-data sub-command.
    const storeCommand = twoDCommands.find((c) => c.bytes[6] === 0x50);
    expect(storeCommand).toBeDefined();
    const dataBytes = storeCommand!.bytes.slice(8);
    expect(new TextDecoder().decode(new Uint8Array(dataBytes))).toBe('hello-qr');
  });
});
