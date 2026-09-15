import type { CodePage } from './CodePage';
import type { EncodingResult } from './EncodingResult';
import { CP437 } from './encoders/Cp437Encoder';
import { CP858 } from './encoders/Cp858Encoder';
import { Windows1252 } from './encoders/Windows1252Encoder';
import { CP866 } from './encoders/Cp866Encoder';
import { CP857 } from './encoders/Cp857Encoder';
import { encodeUtf8Passthrough } from './encoders/Utf8Encoder';

const REPLACEMENT_BYTE = 0x3f; // '?'

/** Available code pages in lookup priority order. */
const CODE_PAGE_LIST: CodePage[] = [CP437, CP858, Windows1252, CP866, CP857];

/** All registered code pages, keyed by id. */
export const CODE_PAGES: Record<number, CodePage> = Object.fromEntries(
  CODE_PAGE_LIST.map((codePage) => [codePage.id, codePage])
);

/** char -> byte reverse index per code page, built once so encodeText doesn't rescan `chars` per character. */
const REVERSE_INDEX: ReadonlyMap<CodePage, ReadonlyMap<string, number>> = new Map(
  CODE_PAGE_LIST.map((codePage) => [
    codePage,
    new Map(Object.entries(codePage.chars).map(([byte, char]) => [char, Number(byte)])),
  ])
);

/** Find a registered code page by id. */
export function findCodePage(id: number): CodePage | undefined {
  return CODE_PAGES[id];
}

/** Check if a string contains only ASCII printable characters (plus newline/CR). */
export function isASCII(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const codePoint = text.charCodeAt(i);
    if (codePoint < 0x20 || codePoint > 0x7e) {
      if (codePoint !== 0x0a && codePoint !== 0x0d) return false;
    }
  }
  return true;
}

function findByte(char: string, codePages: readonly CodePage[]): { codePage: CodePage; byte: number } | null {
  for (const codePage of codePages) {
    const byte = REVERSE_INDEX.get(codePage)?.get(char);
    if (byte !== undefined) return { codePage, byte };
  }
  return null;
}

/**
 * Encode text into printer bytes using code-page lookup for non-ASCII characters.
 *
 * When `preferredCodePage` is given and registered, the returned `codePage` is always that code
 * page (even for ASCII-only text) — callers use this to force a printer to switch to a specific
 * code page. Otherwise the code page is auto-detected from the first non-ASCII character that
 * needs one, or stays null when the text is plain ASCII.
 *
 * Note: unlike portakal's `encodeText` (which returns per-segment code-page switches as an
 * array), this returns a single `EncodingResult` with one `codePage` — text needing multiple
 * incompatible code pages at once is not supported by this simplified shape.
 */
export function encodeText(text: string, preferredCodePage?: number): EncodingResult {
  const forcedCodePage = preferredCodePage !== undefined ? findCodePage(preferredCodePage) : undefined;
  const searchOrder = forcedCodePage ? [forcedCodePage] : CODE_PAGE_LIST;

  const bytes: number[] = [];
  const unmappedChars: string[] = [];
  let usedCodePage: CodePage | null = forcedCodePage ?? null;

  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;

    if ((codePoint >= 0x20 && codePoint <= 0x7e) || codePoint === 0x0a || codePoint === 0x0d) {
      bytes.push(codePoint);
      continue;
    }

    const hit = findByte(char, searchOrder);
    if (hit) {
      bytes.push(hit.byte);
      if (!forcedCodePage && usedCodePage === null) usedCodePage = hit.codePage;
    } else {
      bytes.push(REPLACEMENT_BYTE);
      unmappedChars.push(char);
    }
  }

  return { bytes: new Uint8Array(bytes), codePage: usedCodePage, unmappedChars };
}

/**
 * Encode text for a specific printer profile.
 *
 * Fix vs. portakal: portakal's `encodeTextForPrinter` accepts a `nativeUtf8`-shaped flag but never
 * branches on it, always doing code-page lookup. Here, when `profile.features.nativeUtf8` is true,
 * text is sent as raw UTF-8 (no code-page switch); otherwise it falls back to `encodeText` using
 * the printer's first declared code page.
 */
export function encodeTextForPrinter(
  text: string,
  profile: { features: { nativeUtf8: boolean; codePages: number[] } }
): EncodingResult {
  if (profile.features.nativeUtf8) {
    return { bytes: encodeUtf8Passthrough(text), codePage: null, unmappedChars: [] };
  }

  return encodeText(text, profile.features.codePages[0]);
}
