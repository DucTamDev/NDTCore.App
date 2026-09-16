import type { ResolvedPrintDocument } from '../document';
import type { PrinterProfile } from '../profile';

/**
 * `profile` is part of the contract so every language compiler can be invoked
 * through one uniform call shape. Only `EscPosCompiler` acts on it today (code
 * page / text-encoding selection); the rest accept and ignore it until their
 * protocol has a grounded encoding-selection command to drive from it.
 */
export interface PrintCompiler<TOutput = string | Uint8Array> {
  compile(document: ResolvedPrintDocument, profile?: PrinterProfile): TOutput;
}
