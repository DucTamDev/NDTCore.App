import type { ResolvedPrintDocument } from '../document';

/** The subset of `PrinterProfile.features` a compiler needs to choose how to encode text — never the full printer profile. */
export interface TextEncodingOptions {
  nativeUtf8?: boolean;
  codePages?: number[];
}

/**
 * `encoding` is part of the contract so every language compiler can be invoked
 * through one uniform call shape. Only `EscPosCompiler` acts on it today (code
 * page / text-encoding selection); the rest accept and ignore it until their
 * protocol has a grounded encoding-selection command to drive from it.
 */
export interface PrintCompiler<TOutput = string | Uint8Array> {
  compile(document: ResolvedPrintDocument, encoding?: TextEncodingOptions): TOutput;
}
