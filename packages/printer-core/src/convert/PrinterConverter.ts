import type { PrinterLanguage } from '../core/PrinterLanguage';
import type { ResolvedPrintDocument } from '../document';
import { UnsupportedLanguageError } from '../core/PrinterCoreError';
import { ConversionRegistry, type ConversionRegistryEntry } from './ConversionRegistry';
import type { ConversionResult } from './ConversionResult';

/** Fallback label dimensions for a source language whose parser has no notion of them (e.g. sbpl) or didn't find a sizing command in this particular document (e.g. dpl) — matches portakal's own `convert()` fallback. */
const DEFAULT_WIDTH_DOTS = 320;
const DEFAULT_HEIGHT_DOTS = 240;

const DEFAULT_DPI = 203;
const DEFAULT_GAP_DOTS = 24;
const DEFAULT_SPEED = 4;
const DEFAULT_DENSITY = 8;
const DEFAULT_COPIES = 1;

/** Encodes compiled bytes as the same one-character-per-byte binary string `ConversionResult.output` documents. */
function bytesToBinaryString(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function lookup(language: PrinterLanguage, capability: 'conversion source' | 'conversion target'): ConversionRegistryEntry {
  const entry: ConversionRegistryEntry | undefined = ConversionRegistry[language];
  if (!entry) throw new UnsupportedLanguageError(language, capability);
  return entry;
}

/**
 * Converts printer source code from one `PrinterLanguage` to another: parses
 * `source` into this package's shared `PrintElement[]` representation via
 * `from`'s registered parser, wraps it in a minimal `ResolvedPrintDocument`,
 * then compiles it for `to` via its registered compiler. Ported from
 * portakal's `convert()`, now dispatching through `ConversionRegistry`
 * instead of two switch statements.
 */
export function convert(source: string, from: PrinterLanguage, to: PrinterLanguage): ConversionResult {
  const sourceEntry = lookup(from, 'conversion source');
  const targetEntry = lookup(to, 'conversion target');

  const parsed = sourceEntry.parse(source);

  const document: ResolvedPrintDocument = {
    widthDots: parsed.widthDots ?? DEFAULT_WIDTH_DOTS,
    heightDots: parsed.heightDots ?? DEFAULT_HEIGHT_DOTS,
    dpi: DEFAULT_DPI,
    gapDots: DEFAULT_GAP_DOTS,
    speed: DEFAULT_SPEED,
    density: DEFAULT_DENSITY,
    direction: 'forward',
    copies: DEFAULT_COPIES,
    elements: parsed.elements,
  };

  const compiled = targetEntry.compile(document);
  const output = typeof compiled === 'string' ? compiled : bytesToBinaryString(compiled);

  return { output, elements: parsed.elements, warnings: parsed.warnings };
}
