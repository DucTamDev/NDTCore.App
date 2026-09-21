/**
 * Command-letter constants for SATO's SBPL printer language, all
 * `<ESC>`(0x1B)-prefixed — emitted by `SbplCompiler`'s `compileElement()`
 * switch and the session-setup commands `compileToSBPL()` writes ahead of
 * every element. Extracted from the literal strings portakal's
 * `languages/sbpl.ts` builds inline, same extraction-not-new-logic pattern
 * as `CpclCommand.ts`/`DplCommand.ts`.
 */
export const SBPL_COMMAND = {
  ESC: '\x1b',
  /** `A` — Start of Format, opens a label session. */
  START: 'A',
  /** `CS` — Clear image buffer. */
  CLEAR: 'CS',
  /** `H` — Set horizontal (X) position, a 4-digit field. */
  POSITION_X: 'H',
  /** `V` — Set vertical (Y) position, a 4-digit field. */
  POSITION_Y: 'V',
  /** `L` — Set character magnification (horizontal then vertical, 2 digits each). */
  MAGNIFICATION: 'L',
  /** `K9B` — Text field, font 9B (mixed ASCII/Kanji). */
  TEXT: 'K9B',
  /** `FW` — Line/box draw field. */
  DRAW: 'FW',
  /** `GM` — Graphics (bitmap) field. */
  IMAGE: 'GM',
  /** `Q` — Quantity (copies) to print, omitted entirely for a single copy. */
  QUANTITY: 'Q',
  /** `Z` — End of Format, prints the label. */
  END: 'Z',
} as const;

export type SbplCommandName = (typeof SBPL_COMMAND)[keyof typeof SBPL_COMMAND];
