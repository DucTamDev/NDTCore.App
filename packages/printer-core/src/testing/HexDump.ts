/**
 * Formats bytes as a classic hex dump — offset, hex byte values, and a
 * printable-ASCII gutter — the same layout as `hexdump -C` / `xxd`. Used by
 * `PrintDataAssertion.ts` to render byte-array mismatches as something a
 * person can actually read, instead of a raw array diff.
 */
export function hexDump(data: Uint8Array, bytesPerLine = 16): string {
  if (bytesPerLine <= 0) {
    throw new Error(`hexDump: bytesPerLine must be positive, got ${bytesPerLine}`);
  }
  if (data.length === 0) {
    return '';
  }

  const lines: string[] = [];
  for (let offset = 0; offset < data.length; offset += bytesPerLine) {
    const chunk = data.subarray(offset, offset + bytesPerLine);

    const hexParts: string[] = [];
    let ascii = '';
    for (let i = 0; i < bytesPerLine; i++) {
      if (i < chunk.length) {
        const byte = chunk[i];
        hexParts.push(byte.toString(16).padStart(2, '0'));
        ascii += byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.';
      } else {
        // Pad missing columns on the final short line so every hex column lines up.
        hexParts.push('  ');
      }
    }

    const offsetStr = offset.toString(16).padStart(8, '0');
    lines.push(`${offsetStr}  ${hexParts.join(' ')}  |${ascii}|`);
  }

  return lines.join('\n');
}
