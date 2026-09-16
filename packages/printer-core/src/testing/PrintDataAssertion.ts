import { hexDump } from './HexDump';

/**
 * Throws a hex-dump-formatted error when `actual` is not byte-for-byte equal
 * to `expected`. A raw `Uint8Array` diff (as `toEqual` would print) is
 * unreadable for print data — this renders both sides through `hexDump` so a
 * failing test tells you which bytes actually differ.
 */
export function assertPrintDataEqual(actual: Uint8Array, expected: Uint8Array): void {
  if (bytesEqual(actual, expected)) {
    return;
  }

  throw new Error(
    `Print data mismatch: expected ${expected.length} byte(s), got ${actual.length} byte(s).\n\n` +
      `Expected:\n${hexDump(expected)}\n\n` +
      `Actual:\n${hexDump(actual)}`,
  );
}

/**
 * Throws a hex-dump-formatted error when `needle` does not occur as a
 * contiguous byte sequence anywhere inside `actual`.
 */
export function assertPrintDataContains(actual: Uint8Array, needle: Uint8Array): void {
  if (containsSubsequence(actual, needle)) {
    return;
  }

  throw new Error(
    `Print data does not contain the expected byte sequence.\n\n` +
      `Needle:\n${hexDump(needle)}\n\n` +
      `Haystack:\n${hexDump(actual)}`,
  );
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function containsSubsequence(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.length === 0) {
    return true;
  }
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    let matches = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return true;
    }
  }
  return false;
}
