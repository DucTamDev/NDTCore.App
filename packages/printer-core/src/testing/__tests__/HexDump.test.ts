import { hexDump } from '../HexDump';

describe('hexDump', () => {
  it('formats a full 16-byte line with offset, hex bytes, and ASCII gutter', () => {
    const data = Uint8Array.from([
      0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21, 0x0a, 0x00, 0x01,
    ]);

    expect(hexDump(data)).toBe(
      '00000000  48 65 6c 6c 6f 2c 20 77 6f 72 6c 64 21 0a 00 01  |Hello, world!...|',
    );
  });

  it('pads a short final line so hex columns still line up, and advances the offset per line', () => {
    const data = Uint8Array.from([0x41, 0x42, 0x43]);

    expect(hexDump(data, 2)).toBe('00000000  41 42  |AB|\n00000002  43     |C|');
  });

  it('renders bytes outside the printable ASCII range as "." in the gutter, and pads a short default-width line', () => {
    const data = Uint8Array.from([0x00, 0x1f, 0x20, 0x7e, 0x7f, 0xff]);

    expect(hexDump(data)).toBe(
      '00000000  00 1f 20 7e 7f ff                                |.. ~..|',
    );
  });

  it('returns an empty string for empty input', () => {
    expect(hexDump(new Uint8Array(0))).toBe('');
  });

  it('throws for a non-positive bytesPerLine', () => {
    expect(() => hexDump(Uint8Array.from([1]), 0)).toThrow(/bytesPerLine/);
  });
});
