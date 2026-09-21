/**
 * EPL2 command-prefix constants emitted by `EplCompiler`'s `compileElement()`
 * switch, plus the label-setup commands `compileToEPL()` writes ahead of
 * every element. Kept as one named-constant map (mirroring `ZPL_COMMAND` and
 * `TSC_COMMAND`) so every command prefix is spelled once — ported from the
 * literal strings portakal's `languages/epl.ts` builds inline.
 *
 * Text (`A`) and box (`X`)/line (`LO`) are single, fixed prefixes (unlike
 * ZPL's `^A<letter>`/`^B<letter>`, EPL2 doesn't vary these by a second
 * character), so they're listed here directly rather than built at the call
 * site.
 */
export const EPL_COMMAND = {
  CLEAR_IMAGE_BUFFER: 'N',
  LABEL_WIDTH: 'q',
  LABEL_HEIGHT_GAP: 'Q',
  SPEED: 'S',
  DENSITY: 'D',
  TEXT: 'A',
  IMAGE: 'GW',
  BOX: 'X',
  LINE: 'LO',
  PRINT: 'P',
  /** `B` — 1D Bar Code Field, per the EPL2 Programmer's Guide. Net new — portakal never compiles a barcode element for EPL. */
  BARCODE: 'B',
  /** `b` — 2D Bar Code Field (lowercase, distinct from `B`'s 1D command). Net new — same gap as `BARCODE`. */
  TWO_D_BARCODE: 'b',
} as const;

export type EplCommandName = (typeof EPL_COMMAND)[keyof typeof EPL_COMMAND];
