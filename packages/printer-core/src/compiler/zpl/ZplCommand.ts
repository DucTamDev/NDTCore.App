/**
 * ZPL II command-prefix constants emitted by `ZplCompiler`'s `compileElement()`
 * switch, plus the format-setup commands `compileToZPL()` writes ahead of
 * every element. Kept as one named-constant map (mirroring `TSC_COMMAND` and
 * `ESC_POS`) so every command prefix is spelled once — ported from the
 * literal strings portakal's `languages/zpl.ts` builds inline.
 *
 * Font (`^A<letter>`) and barcode (`^B<letter>`) commands are not listed
 * here — their second character varies per call (font id / symbology), so
 * `ZplCompiler` builds those literally at the call site, same as
 * `TscCompiler`'s `TSC_BARCODE_TYPE` handles TSPL's per-symbology type string.
 */
export const ZPL_COMMAND = {
  START_FORMAT: '^XA',
  END_FORMAT: '^XZ',
  PRINT_WIDTH: '^PW',
  LABEL_LENGTH: '^LL',
  PRINT_RATE: '^PR',
  DARKNESS: '~SD',
  CHANGE_INTL_FONT_ENCODING: '^CI',
  FIELD_ORIGIN: '^FO',
  FIELD_TYPESET: '^FT',
  FIELD_DATA: '^FD',
  FIELD_SEPARATOR: '^FS',
  FIELD_BLOCK: '^FB',
  FIELD_REVERSE: '^FR',
  GRAPHIC_BOX: '^GB',
  GRAPHIC_CIRCLE: '^GC',
  GRAPHIC_DIAGONAL: '^GD',
  GRAPHIC_FIELD_ASCII: '^GFA',
  BARCODE_FIELD_DEFAULT: '^BY',
  PRINT_QUANTITY: '^PQ',
  /**
   * `^MM` — Print Mode. `^MMC` selects Cutter mode (persistent — the printer
   * keeps cutting after every label until the mode is changed again, same
   * persistence model as TSC's `SET CUTTER`), `^MMT` reverts to Tear-off
   * (ZPL's default, no-cutter state). Net new — portakal never compiles a
   * `cut` element for ZPL — derived from the Zebra ZPL II Programming
   * Guide's `^MM` command, the real cutter-mode command for printers with
   * cutter hardware.
   */
  PRINT_MODE: '^MM',
} as const;

export type ZplCommandName = (typeof ZPL_COMMAND)[keyof typeof ZPL_COMMAND];
