/**
 * Framing bytes and field-type letters for Intermec/Honeywell's IPL printer
 * language, extracted from the literal characters `IplCompiler`'s
 * `compileElement()`/`compileToIPL()` build inline — same
 * extraction-not-new-logic pattern as `DplCommand.ts`/`EplCommand.ts`.
 *
 * IPL frames every command between `STX`/`ETX` and separates a field
 * command's clauses with `;`, each clause led by a single lowercase letter
 * (`o` = origin, `f` = format/rotation, `l` = length, `h`/`w` = a pair of
 * size dimensions whose exact meaning is field-type-specific — `H`'s
 * `h`/`w` are font height/width, `W`'s `h`/`w` are box height/stroke
 * weight, `L`'s `w` is stroke weight). `ESC`-prefixed commands (`C`reate
 * format, `P`rogram mode, `E`nd format, `M` copies) carry no clause syntax
 * of their own.
 */
export const IPL_COMMAND = {
  /** `\x02` — Start of frame, opens every IPL command. */
  STX: '\x02',
  /** `\x03` — End of frame, closes every IPL command. */
  ETX: '\x03',
  /** `\x1b` — Prefixes the format-lifecycle commands (`C`/`P`/`E`/`M`). */
  ESC: '\x1b',
  /** `<ESC>C1` — Create format 1, the header every compiled label opens with. */
  CREATE_FORMAT: 'C1',
  /** `<ESC>P` — Enter program mode. */
  PROGRAM_MODE: 'P',
  /** `<ESC>E1` — End format 1, the trailer every compiled label closes with. */
  END_FORMAT: 'E1',
  /** `<ESC>M{n}` — Set the number of copies to print. */
  COPIES: 'M',
  /** `R` — Print the assembled format. */
  PRINT: 'R',
  /** `H` — Human-readable text field. */
  FIELD_TEXT: 'H',
  /** `W` — Box (rectangle outline) field. */
  FIELD_BOX: 'W',
  /** `L` — Line field. */
  FIELD_LINE: 'L',
  /** `G` — Graphic (image) field. */
  FIELD_GRAPHIC: 'G',
  /** `<SI>L{n}` — Set label length (height), in dots. */
  CONFIG_LENGTH: 'L',
  /** `<SI>W{n}` — Set label width, in dots. */
  CONFIG_WIDTH: 'W',
  /** `<SI>S{n}` — Set print speed. */
  CONFIG_SPEED: 'S',
  /** `<SI>d{n}` — Set print darkness/density. */
  CONFIG_DENSITY: 'd',
} as const;

export type IplCommandName = (typeof IPL_COMMAND)[keyof typeof IPL_COMMAND];
