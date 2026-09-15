/**
 * CPCL command-verb constants emitted by `CpclCompiler`'s `compileElement()`
 * switch, plus the session-setup commands `compileToCPCL()` writes ahead of
 * every element. Kept as one named-constant map (mirroring `ZPL_COMMAND` and
 * `EPL_COMMAND`) so every command verb is spelled once — ported from the
 * literal strings portakal's `languages/cpcl.ts` builds inline.
 *
 * `TEXT` is listed as its base verb only — CPCL varies it with a rotation
 * suffix (`TEXT`/`TEXT90`/`TEXT180`/`TEXT270`), so `CpclCompiler` builds the
 * full verb at the call site, same as `ZplCompiler`'s `^A<letter>` handling.
 */
export const CPCL_COMMAND = {
  SESSION_START: '!',
  TONE: 'TONE',
  SPEED: 'SPEED',
  PAGE_WIDTH: 'PAGE-WIDTH',
  TEXT: 'TEXT',
  IMAGE: 'EG',
  BOX: 'BOX',
  LINE: 'LINE',
  PRINT: 'PRINT',
  /** `BARCODE` — 1D Bar Code command, per the CPCL Programmer's Manual. Net new — portakal never compiles a barcode element for CPCL. */
  BARCODE: 'BARCODE',
  /** `B QR` — 2D QR Code block opener, per the CPCL Programmer's Manual. Net new, same gap as `BARCODE`. */
  QRCODE_START: 'B QR',
  /** `ENDQR` — terminates the `B QR` block. */
  QRCODE_END: 'ENDQR',
} as const;

export type CpclCommandName = (typeof CPCL_COMMAND)[keyof typeof CPCL_COMMAND];
