/**
 * TSPL2 command-name literals emitted by `TscCompiler`'s `compileElement()`
 * switch, plus the label-setup commands `compileToTSC()` writes ahead of
 * every element. Kept as one named-constant map (mirroring `EscPosCommand`'s
 * `ESC_POS` object) so every command name is spelled once — ported from the
 * literal strings portakal's `languages/tsc.ts` builds inline.
 */
export const TSC_COMMAND = {
  SIZE: 'SIZE',
  GAP: 'GAP',
  SPEED: 'SPEED',
  DENSITY: 'DENSITY',
  DIRECTION: 'DIRECTION',
  CLS: 'CLS',
  PRINT: 'PRINT',
  TEXT: 'TEXT',
  BLOCK: 'BLOCK',
  BITMAP: 'BITMAP',
  BOX: 'BOX',
  BAR: 'BAR',
  DIAGONAL: 'DIAGONAL',
  CIRCLE: 'CIRCLE',
  ELLIPSE: 'ELLIPSE',
  REVERSE: 'REVERSE',
  ERASE: 'ERASE',
  BARCODE: 'BARCODE',
  QRCODE: 'QRCODE',
  /**
   * `SET CUTTER` — per this repo's own `TsplEncoder.cut()`
   * (`src/features/printer/drivers/tspl/TsplEncoder.ts`, read-only
   * reference, validated on real TSPL hardware), the argument form is
   * `SET CUTTER OFF` or `SET CUTTER <n>` (no `BATCH` keyword) and the
   * setting is persistent — once a job sends `SET CUTTER n`, the printer
   * keeps cutting on later jobs until an explicit `SET CUTTER OFF`.
   */
  SET_CUTTER: 'SET CUTTER',
} as const;

export type TscCommandName = (typeof TSC_COMMAND)[keyof typeof TSC_COMMAND];
