import { assertPrintDataEqual, assertPrintDataContains } from '../PrintDataAssertion';

describe('assertPrintDataEqual', () => {
  it('does not throw when the byte arrays are identical', () => {
    expect(() =>
      assertPrintDataEqual(Uint8Array.from([1, 2, 3]), Uint8Array.from([1, 2, 3])),
    ).not.toThrow();
  });

  it('throws a hex-dump-formatted message with both sides when the bytes differ', () => {
    expect(() => assertPrintDataEqual(Uint8Array.from([0x41, 0x42]), Uint8Array.from([0x41, 0x43]))).toThrow(
      'Print data mismatch: expected 2 byte(s), got 2 byte(s).\n\n' +
        'Expected:\n00000000  41 43                                            |AC|\n\n' +
        'Actual:\n00000000  41 42                                            |AB|',
    );
  });

  it('throws when lengths differ, even if the shorter array is a prefix of the longer one', () => {
    expect(() => assertPrintDataEqual(Uint8Array.from([1, 2, 3]), Uint8Array.from([1, 2]))).toThrow(
      /expected 2 byte\(s\), got 3 byte\(s\)/,
    );
  });
});

describe('assertPrintDataContains', () => {
  it('does not throw when the needle occurs inside the haystack', () => {
    expect(() =>
      assertPrintDataContains(Uint8Array.from([0x1b, 0x40, 0x1d, 0x56, 0x00]), Uint8Array.from([0x1d, 0x56, 0x00])),
    ).not.toThrow();
  });

  it('throws a hex-dump-formatted message with the needle and haystack when the needle is absent', () => {
    expect(() =>
      assertPrintDataContains(Uint8Array.from([0x1b, 0x40]), Uint8Array.from([0x1d, 0x56])),
    ).toThrow(
      'Print data does not contain the expected byte sequence.\n\n' +
        'Needle:\n00000000  1d 56                                            |.V|\n\n' +
        'Haystack:\n00000000  1b 40                                            |.@|',
    );
  });
});
