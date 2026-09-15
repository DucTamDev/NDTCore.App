/**
 * UTF-8 passthrough — used by printers whose firmware natively renders UTF-8 (e.g. Epson TM-m30II
 * with `features.nativeUtf8: true`), bypassing code-page byte mapping entirely.
 */
export function encodeUtf8Passthrough(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
