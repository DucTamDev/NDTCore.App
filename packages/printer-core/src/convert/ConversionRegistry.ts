import type { PrinterLanguage } from '../core/PrinterLanguage';
import type { ResolvedPrintDocument } from '../document';
import type { PrinterProfile } from '../profile';
import type { PrintElement } from '../builder';
import { parseTSPL } from '../parser/tsc/TscParser';
import { TscCompiler } from '../compiler/tsc/TscCompiler';
import { parseZPL } from '../parser/zpl/ZplParser';
import { ZplCompiler } from '../compiler/zpl/ZplCompiler';
import { parseEPL } from '../parser/epl/EplParser';
import { EplCompiler } from '../compiler/epl/EplCompiler';
import { parseCPCL } from '../parser/cpcl/CpclParser';
import { CpclCompiler } from '../compiler/cpcl/CpclCompiler';
import { parseDPL } from '../parser/dpl/DplParser';
import { DplCompiler } from '../compiler/dpl/DplCompiler';
import { parseSBPL } from '../parser/sbpl/SbplParser';
import { SbplCompiler } from '../compiler/sbpl/SbplCompiler';
import { decodeEscPos } from '../parser/escpos/EscPosParser';
import { EscPosCompiler } from '../compiler/escpos/EscPosCompiler';
import { decodeStarPrnt } from '../parser/starprnt/StarPrntParser';
import { StarPrntCompiler } from '../compiler/starprnt/StarPrntCompiler';
import { parseIPL } from '../parser/ipl/IplParser';
import { IplCompiler } from '../compiler/ipl/IplCompiler';

/** Elements plus whatever dimension/warning data a language's parser is able to recover from source code. Width/height are omitted (not `0`) when a language's parser has no notion of them, so `PrinterConverter` can tell "not provided" apart from a real `0`. */
export interface ParsedSource {
  elements: PrintElement[];
  widthDots?: number;
  heightDots?: number;
  warnings: string[];
}

/** One `PrinterLanguage`'s parse/compile pair, looked up by `PrinterConverter`. */
export interface ConversionRegistryEntry {
  parse: (source: string | Uint8Array) => ParsedSource;
  compile: (document: ResolvedPrintDocument, profile?: PrinterProfile) => string | Uint8Array;
}

function toText(source: string | Uint8Array): string {
  return typeof source === 'string' ? source : new TextDecoder().decode(source);
}

/**
 * Byte-oriented languages (escpos, starprnt) treat a `string` source as a
 * binary string — one character per byte (0-255) — the same convention
 * `EscPosValidator`/`StarPrntValidator` already use, so a value produced by
 * `PrinterConverter`'s own byte-target encoding round-trips back into bytes
 * without going through a lossy text codec (e.g. UTF-8) that would corrupt
 * any byte >= 0x80.
 */
function toBytes(source: string | Uint8Array): Uint8Array {
  if (source instanceof Uint8Array) return source;
  const bytes = new Uint8Array(source.length);
  // eslint-disable-next-line no-bitwise -- clamping each char code to a single byte
  for (let i = 0; i < source.length; i++) bytes[i] = source.charCodeAt(i) & 0xff;
  return bytes;
}

/**
 * Looks up a `PrinterLanguage`'s parser and compiler for cross-compilation.
 * Replaces portakal's two hardcoded switch statements (`parseSource()`/
 * `compileTarget()` in `convert.ts`) with a genuine lookup table.
 *
 * Unlike portakal's `SourceLanguage`, every language here is a valid
 * conversion source, including escpos and starprnt: their parsers
 * (`decodeEscPos`, `decodeStarPrnt`) already recover real `PrintElement[]`
 * from byte input, the same as any text-protocol language's parser — there
 * was no technical reason to keep them target-only.
 */
export const ConversionRegistry: Record<PrinterLanguage, ConversionRegistryEntry> = {
  tsc: {
    parse: (source) => {
      const result = parseTSPL(toText(source));
      return { elements: result.elements, widthDots: result.widthDots, heightDots: result.heightDots, warnings: result.warnings };
    },
    compile: (document, profile) => new TscCompiler().compile(document, profile),
  },
  zpl: {
    parse: (source) => {
      const result = parseZPL(toText(source));
      return { elements: result.elements, widthDots: result.widthDots, heightDots: result.heightDots, warnings: result.warnings };
    },
    compile: (document, profile) => new ZplCompiler().compile(document, profile),
  },
  epl: {
    parse: (source) => {
      const result = parseEPL(toText(source));
      // EPL's own parser initializes heightDots to 0 when no `Q` (label
      // length) command appears — falsy, not a real dimension, so it's
      // dropped here and left for PrinterConverter's default to fill in.
      return { elements: result.elements, widthDots: result.widthDots, heightDots: result.heightDots || undefined, warnings: result.warnings };
    },
    compile: (document, profile) => new EplCompiler().compile(document, profile),
  },
  cpcl: {
    parse: (source) => {
      const result = parseCPCL(toText(source));
      return { elements: result.elements, widthDots: result.widthDots, heightDots: result.heightDots, warnings: result.warnings };
    },
    compile: (document, profile) => new CpclCompiler().compile(document, profile),
  },
  dpl: {
    parse: (source) => {
      const result = parseDPL(toText(source));
      return { elements: result.elements, widthDots: result.widthDots, warnings: result.warnings };
    },
    compile: (document, profile) => new DplCompiler().compile(document, profile),
  },
  sbpl: {
    parse: (source) => {
      const result = parseSBPL(toText(source));
      return { elements: result.elements, warnings: result.warnings };
    },
    compile: (document, profile) => new SbplCompiler().compile(document, profile),
  },
  escpos: {
    parse: (source) => {
      const result = decodeEscPos(toBytes(source));
      return { elements: result.elements, warnings: result.warnings };
    },
    compile: (document, profile) => new EscPosCompiler().compile(document, profile),
  },
  starprnt: {
    parse: (source) => {
      const result = decodeStarPrnt(toBytes(source));
      return { elements: result.elements, warnings: result.warnings };
    },
    compile: (document, profile) => new StarPrntCompiler().compile(document, profile),
  },
  ipl: {
    parse: (source) => {
      const result = parseIPL(toText(source));
      return { elements: result.elements, widthDots: result.widthDots, heightDots: result.heightDots, warnings: result.warnings };
    },
    compile: (document, profile) => new IplCompiler().compile(document, profile),
  },
};
