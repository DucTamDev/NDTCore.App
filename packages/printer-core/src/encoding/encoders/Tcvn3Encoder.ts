/** Unicode character (single precomposed Vietnamese letter) -> TCVN3 byte. */
export interface Tcvn3Mapping {
  [unicodeChar: string]: number;
}

/**
 * TCVN3 (a.k.a. "ABC") is a legacy 8-bit Vietnamese charset still found on older Vietnamese
 * thermal printer firmware. Unlike CP1258, it has no published WHATWG/Unicode.org table and no
 * reference implementation exists in this repo's dependencies to cross-check against (checked:
 * no `tcvn3`/`vscii`-named package in node_modules).
 *
 * The two entries below (Đ/đ) were originally transcribed wrong — the first pass of this file
 * accidentally copied CP1258's byte values for Đ/đ (0xD0/0xF0) instead of TCVN3's. They have
 * since been corrected to 0xA7/0xAE, sourced from independent TCVN3-specific research (a cited
 * Vietnamese character-encoding reference, not CP1258 and not the original recollection). This
 * is the only part of the table backed by that research; treat it as "checked against one
 * external source", not as independently cross-verified the way Windows1258Encoder's table is.
 *
 * The wider TCVN3 grid — the ~120 remaining precomposed vowel+tone combinations (à/á/ả/ã/ạ and
 * their ă/â/ê/ô/ơ/ư variants, upper and lower case) — is intentionally NOT populated here: exact
 * byte assignments for that grid have not been verified, and inventing them would risk silently
 * corrupting printed Vietnamese text on real hardware. Before
 * relying on this encoder for anything beyond Đ/đ, cross-check against an authoritative TCVN3
 * (TCVN 5712:1993) reference table and extend TCVN3_CHARS accordingly.
 */
const TCVN3_CHARS: Tcvn3Mapping = {
  Đ: 0xa7,
  đ: 0xae,
};

const ASCII_MAX = 0x7f;
const REPLACEMENT_BYTE = 0x3f; // '?'

/** Encode text to TCVN3 bytes: known Vietnamese letters via TCVN3_CHARS, ASCII passed through unchanged, anything else replaced with '?'. */
export function encodeTcvn3(text: string): Uint8Array {
  const bytes: number[] = [];
  for (const char of text) {
    const mapped = TCVN3_CHARS[char];
    if (mapped !== undefined) {
      bytes.push(mapped);
      continue;
    }
    const codePoint = char.codePointAt(0) ?? REPLACEMENT_BYTE;
    bytes.push(codePoint <= ASCII_MAX ? codePoint : REPLACEMENT_BYTE);
  }
  return new Uint8Array(bytes);
}
