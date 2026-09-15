export interface PrintParser<TResult> {
  parse(source: string | Uint8Array): TResult;
}
