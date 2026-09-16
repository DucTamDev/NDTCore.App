/**
 * Options for a paper-cut command. A conceptual description only — no
 * byte-emission logic lives here (that's the per-language compiler's job,
 * e.g. `compiler/escpos/EscPosCompiler.ts`).
 */
export interface CutOptions {
  rows?: number;
  mode?: 'off' | 'partial' | 'full';
}

/** A paper-cut command. */
export interface CutElement {
  type: 'cut';
  options?: CutOptions;
}
