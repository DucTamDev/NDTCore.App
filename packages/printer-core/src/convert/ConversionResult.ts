import type { PrintElement } from '../builder';

/**
 * Result of converting printer source code from one `PrinterLanguage` to
 * another (see `convert()` in `PrinterConverter.ts`).
 */
export interface ConversionResult {
  /**
   * Compiled output in the target language. A string-producing target
   * (tsc, zpl, epl, cpcl, dpl, sbpl, ipl) returns its native text as-is. A
   * byte-producing target (escpos, starprnt) is returned as a binary
   * string — one character per output byte (0-255) — matching this
   * package's existing escpos/starprnt convention (see `EscPosValidator`'s
   * `bytesFromSource()`). Recover the raw bytes with
   * `Uint8Array.from(output, (c) => c.charCodeAt(0))`.
   */
  output: string;
  /** Elements recovered from parsing the source, before target compilation. */
  elements: PrintElement[];
  /** Warnings raised while parsing the source (e.g. unrecognized commands). */
  warnings: string[];
}
