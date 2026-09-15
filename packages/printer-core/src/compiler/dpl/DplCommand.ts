/**
 * Command-prefix constants for Honeywell/Datamax's DPL printer language,
 * emitted by `DplCompiler`'s `compileElement()` switch, plus the
 * label-setup commands `compileToDPL()` writes ahead of every element —
 * extracted from the literal strings portakal's `languages/dpl.ts` builds
 * inline, same extraction-not-new-logic pattern as
 * `EplCommand.ts`/`ZplCommand.ts`.
 *
 * DPL's element records are fixed-width digit fields rather than
 * letter-prefixed commands (unlike EPL2's `A`/`X`/`LO` or ZPL's
 * `^A`/`^GB`/`^GD`), so only the document-level setup/teardown commands and
 * the record-type marker letters get named constants here — the numeric
 * field layout itself stays inline in `DplCompiler.ts`, next to the padding
 * logic it belongs with.
 */
export const DPL_COMMAND = {
  /** `<STX>L` — Enter Label Format Mode, the header every DPL label starts with. */
  ENTER_LABEL_FORMAT: '\x02L',
  /** `D` — Set Darkness/Density. */
  DENSITY: 'D',
  /** `S` — Set Print Speed. */
  SPEED: 'S',
  /** `A` — Set Label (Form) Width, in dots. */
  WIDTH: 'A',
  /** `Q` — Set Quantity (copies) to print. */
  QUANTITY: 'Q',
  /** `E` — End Label Format Mode, prints the label. */
  END: 'E',
  /** Trailing record-type marker shared by the Line/Box Draw command's fixed-field record (portakal's `2l`/`0002l` suffixes both end in this letter). */
  LINE_BOX_MARKER: 'l',
  /** Bar Code Field record-type marker. Net new — portakal never compiles a barcode/QR element for DPL, so there's no literal to extract this from; it follows the same single-letter-marker shape `LINE_BOX_MARKER` documents. */
  BARCODE_MARKER: 'B',
} as const;

export type DplCommandName = (typeof DPL_COMMAND)[keyof typeof DPL_COMMAND];
