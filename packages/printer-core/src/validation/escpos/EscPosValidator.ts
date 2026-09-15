import { ESC_POS } from '../../compiler/escpos/EscPosCommand';
import type { PrintValidation } from '../../core';
import type { ValidationIssue } from '../ValidationIssue';
import type { ValidationResult } from '../ValidationResult';

/** ESC-prefixed command byte -> its fixed parameter-byte count (commands not listed here are assumed to take none). */
const ESC_PARAM_LENGTH: Record<number, number> = {
  0x40: 0,
  0x61: 1,
  0x45: 1,
  0x2d: 1,
  0x4d: 1,
  0x21: 1,
  0x56: 1,
  0x7b: 1,
  0x64: 1,
  0x4a: 1,
  0x33: 1,
  0x32: 0,
  0x74: 1,
  0x70: 3,
};

/** GS-prefixed command byte -> its fixed parameter-byte count. 0x6b/0x56/0x76/0x28 are variable-length and handled separately. */
const GS_PARAM_LENGTH: Record<number, number> = {
  0x21: 1,
  0x42: 1,
  0x48: 1,
  0x68: 1,
  0x77: 1,
  0x66: 1,
  0x61: 1,
  0x72: 1,
};

/** "GS k" symbology byte values >= this select the length-prefixed format B; below it, the NUL-terminated format A. */
const BARCODE_FORMAT_B_MIN_TYPE = 65;

function bytesFromSource(source: string): Uint8Array {
  const bytes = new Uint8Array(source.length);
  // eslint-disable-next-line no-bitwise -- clamping each char code to a single byte
  for (let i = 0; i < source.length; i++) bytes[i] = source.charCodeAt(i) & 0xff;
  return bytes;
}

function isPrintableOrExtended(byte: number): boolean {
  return (byte >= 0x20 && byte <= 0x7e) || byte >= 0x80;
}

/** Skips a "GS k" barcode command (either NUL-terminated format A or length-prefixed format B) and returns the next index. */
function skipBarcode(bytes: Uint8Array, i: number): number {
  if (i + 2 >= bytes.length) return i + 2;
  const m = bytes[i + 2]!;
  if (m >= BARCODE_FORMAT_B_MIN_TYPE) {
    return i + 3 < bytes.length ? i + 4 + bytes[i + 3]! : i + 3;
  }
  let end = i + 3;
  while (end < bytes.length && bytes[end] !== 0) end++;
  return end + 1;
}

/** Skips a "GS ( k" 2D-symbol command (QR, PDF417, ...) and returns the next index. */
function skipTwoDCode(bytes: Uint8Array, i: number): number {
  if (bytes[i + 2] !== ESC_POS.TWO_D_CODE[1] || i + 4 >= bytes.length) return i + 3;
  const len = bytes[i + 3]! + bytes[i + 4]! * 256;
  return i + 5 + len;
}

/**
 * Checks a "GS v 0" raster-image header against the bytes actually available in the
 * buffer. Returns the next index to resume scanning from, or -1 when the image's
 * declared data length overflows the buffer (a genuinely malformed stream).
 */
function skipRasterImage(bytes: Uint8Array, i: number): number {
  if (i + 7 >= bytes.length) return i + 2;
  const bytesPerRow = bytes[i + 4]! + bytes[i + 5]! * 256;
  const rows = bytes[i + 6]! + bytes[i + 7]! * 256;
  const declared = bytesPerRow * rows;
  const available = bytes.length - (i + 8);
  return declared > available ? -1 : i + 8 + declared;
}

/**
 * Minimal, heuristic ESC/POS validator — net new, since portakal's `validate()`
 * never accepted "escpos" as a source language. Walks the byte stream (encoded
 * one byte per character, per `PrintValidation`'s string-source contract),
 * skipping every command it recognizes, and flags two conditions: a raster
 * image whose declared byte count overflows the buffer, and stray bytes that
 * fall outside both the printable/extended ranges and any recognized command
 * (a rough "this might not be valid ESC/POS" signal, not a full re-parse).
 */
export class EscPosValidator implements PrintValidation {
  validate(source: string): ValidationResult {
    const bytes = bytesFromSource(source);
    const issues: ValidationIssue[] = [];
    let i = 0;
    let invalidRunStart = -1;

    const flushInvalidRun = (end: number): void => {
      if (invalidRunStart < 0) return;
      issues.push({
        level: 'warning',
        message: `Byte(s) at offset ${invalidRunStart}-${end - 1} are outside the printable/extended range and outside any recognized command.`,
      });
      invalidRunStart = -1;
    };

    while (i < bytes.length) {
      const b = bytes[i]!;

      if (b === ESC_POS.LF || isPrintableOrExtended(b)) {
        flushInvalidRun(i);
        i += 1;
        continue;
      }

      if (b === ESC_POS.ESC && i + 1 < bytes.length) {
        flushInvalidRun(i);
        const cmd = bytes[i + 1]!;
        i += 2 + (ESC_PARAM_LENGTH[cmd] ?? 0);
        continue;
      }

      if (b === ESC_POS.GS && i + 1 < bytes.length) {
        flushInvalidRun(i);
        const cmd = bytes[i + 1]!;

        if (cmd === ESC_POS.RASTER_IMAGE[0] && bytes[i + 2] === ESC_POS.RASTER_IMAGE[1]) {
          const next = skipRasterImage(bytes, i);
          if (next < 0) {
            issues.push({
              level: 'error',
              message: `Raster image ("GS v 0") at offset ${i} declares more data bytes than remain in the buffer.`,
            });
            break;
          }
          i = next;
          continue;
        }

        if (cmd === ESC_POS.BARCODE) {
          i = skipBarcode(bytes, i);
          continue;
        }

        if (cmd === ESC_POS.TWO_D_CODE[0]) {
          i = skipTwoDCode(bytes, i);
          continue;
        }

        if (cmd === 0x56) {
          const m = bytes[i + 2];
          i += m === 65 || m === 66 ? 4 : 3;
          continue;
        }

        i += 2 + (GS_PARAM_LENGTH[cmd] ?? 0);
        continue;
      }

      if (b === 0x10 && i + 1 < bytes.length) {
        flushInvalidRun(i);
        const cmd = bytes[i + 1]!;
        if (cmd === 0x04 || cmd === 0x05) i += 3;
        else if (cmd === 0x14) i += 5;
        else i += 2;
        continue;
      }

      if (b === 0x1c && i + 1 < bytes.length) {
        flushInvalidRun(i);
        i += 2;
        continue;
      }

      if (invalidRunStart < 0) invalidRunStart = i;
      i += 1;
    }

    flushInvalidRun(bytes.length);

    const errors = issues.filter((issue) => issue.level === 'error').length;
    const warnings = issues.filter((issue) => issue.level === 'warning').length;
    const infos = issues.filter((issue) => issue.level === 'info').length;

    return { valid: errors === 0, issues, errors, warnings, infos };
  }
}
