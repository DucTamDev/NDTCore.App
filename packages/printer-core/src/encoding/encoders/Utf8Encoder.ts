/** Gửi thẳng UTF-8, không qua code page — cho máy in có firmware tự hiển thị UTF-8 (`features.nativeUtf8`). */
export function encodeUtf8Passthrough(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
