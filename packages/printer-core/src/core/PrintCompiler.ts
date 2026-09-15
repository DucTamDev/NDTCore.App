import type { ResolvedPrintDocument } from '../document';

export interface PrintCompiler<TOutput = string | Uint8Array> {
  compile(document: ResolvedPrintDocument): TOutput;
}
