import type { CodePage } from './CodePage';

/** Result of encoding text for a printer: the raw bytes plus which code page (if any) they assume. */
export interface EncodingResult {
  /** Encoded bytes, ready to send to the printer. */
  bytes: Uint8Array;
  /** Code page the bytes were encoded against, or null when no code page was needed/used (ASCII-only or UTF-8 passthrough). */
  codePage: CodePage | null;
  /** Characters that could not be mapped to any code page and were replaced with '?'. */
  unmappedChars: string[];
}
