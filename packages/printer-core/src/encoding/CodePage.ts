/** Single-byte printer code page: maps a high byte (0x80-0xFF) to the Unicode character it represents. */
export interface CodePage {
  /** Numeric code page identifier (e.g. 437 for CP437, 1252 for Windows-1252). */
  id: number;
  /** Human-readable name. */
  name: string;
  /** Byte value (0x80-0xFF) -> Unicode character. 0x00-0x7F is always plain ASCII and is never listed here. */
  chars: Record<number, string>;
}
