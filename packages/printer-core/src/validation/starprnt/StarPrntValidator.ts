import { STAR_PRNT } from '../../compiler/starprnt/StarPrntCommand';
import type { PrintValidation } from '../../core';
import type { ValidationIssue } from '../ValidationIssue';
import type { ValidationResult } from '../ValidationResult';

/** ESC-prefixed command byte -> its fixed parameter-byte count (commands not listed here are assumed to take none). */
const ESC_PARAM_LENGTH: Record<number, number> = {
  0x40: 0, // ESC @
  0x45: 0, // ESC E
  0x46: 0, // ESC F
  0x2d: 1, // ESC - n
  0x69: 2, // ESC i h w
  0x64: 1, // ESC d n
};

function isPrintableOrExtended(byte: number): boolean {
  return (byte >= 0x20 && byte <= 0x7e) || byte >= 0x80;
}

/** Skips an "ESC GS a n" alignment command (4 bytes total) and returns the next index, or `i + 2` when the buffer is too short to hold it. */
function skipAlign(bytes: Uint8Array, i: number): number {
  return i + 3 < bytes.length ? i + 4 : i + 2;
}

/** Skips an "ESC * r A ... ESC * r B" raster-image block and returns the next index, or -1 when a raster line's declared byte count overflows the buffer. */
function skipRaster(bytes: Uint8Array, i: number): number {
  let j = i + 4;
  while (j < bytes.length) {
    if (bytes[j] === STAR_PRNT.ESC && j + 3 < bytes.length && bytes[j + 1] === STAR_PRNT.RASTER_EXIT[0] && bytes[j + 2] === STAR_PRNT.RASTER_EXIT[1] && bytes[j + 3] === STAR_PRNT.RASTER_EXIT[2]) {
      return j + 4;
    }
    if (bytes[j] === STAR_PRNT.RASTER_LINE && j + 2 < bytes.length) {
      const nL = bytes[j + 1]!;
      const nH = bytes[j + 2]!;
      const len = nL + nH * 256;
      if (j + 3 + len > bytes.length) return -1;
      j += 3 + len;
    } else {
      j++;
    }
  }
  return j;
}

function bytesFromSource(source: string): Uint8Array {
  const bytes = new Uint8Array(source.length);
  // eslint-disable-next-line no-bitwise -- clamping each char code to a single byte
  for (let i = 0; i < source.length; i++) bytes[i] = source.charCodeAt(i) & 0xff;
  return bytes;
}

/**
 * Minimal, heuristic Star Line Mode validator — net new, since portakal never
 * wired `.validate()` for `starprnt`. Structurally close to `EscPosValidator`
 * (the two protocols share the same walk-and-skip-recognized-commands shape):
 * walks the byte stream, skipping every command it recognizes, and flags a
 * raster image whose declared row length overflows the buffer plus stray
 * bytes that fall outside both the printable/extended ranges and any
 * recognized command.
 */
export class StarPrntValidator implements PrintValidation {
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

      if (b === STAR_PRNT.LF || isPrintableOrExtended(b)) {
        flushInvalidRun(i);
        i += 1;
        continue;
      }

      if (b === STAR_PRNT.CASH_DRAWER) {
        flushInvalidRun(i);
        i += 1;
        continue;
      }

      if (b === STAR_PRNT.ESC && i + 1 < bytes.length) {
        flushInvalidRun(i);
        const cmd = bytes[i + 1]!;

        if (cmd === STAR_PRNT.RASTER_ENTER[0] && bytes[i + 2] === STAR_PRNT.RASTER_ENTER[1] && bytes[i + 3] === STAR_PRNT.RASTER_ENTER[2]) {
          const next = skipRaster(bytes, i);
          if (next < 0) {
            issues.push({
              level: 'error',
              message: `Raster row ("b nL nH data") inside the raster block starting at offset ${i} declares more data bytes than remain in the buffer.`,
            });
            break;
          }
          i = next;
          continue;
        }

        if (cmd === STAR_PRNT.ALIGN[0] && bytes[i + 2] === STAR_PRNT.ALIGN[1]) {
          i = skipAlign(bytes, i);
          continue;
        }

        i += 2 + (ESC_PARAM_LENGTH[cmd] ?? 0);
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
