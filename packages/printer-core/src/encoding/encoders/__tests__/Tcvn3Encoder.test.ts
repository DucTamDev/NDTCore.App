import { encodeTcvn3 } from '../Tcvn3Encoder';

describe('encodeTcvn3', () => {
  it('maps a precomposed Vietnamese character to a single TCVN3 byte', () => {
    const bytes = encodeTcvn3('đ');
    expect(bytes).toHaveLength(1);
    expect(bytes[0]).toBe(0xae);
  });

  it('maps the uppercase precomposed Vietnamese character to a single TCVN3 byte', () => {
    const bytes = encodeTcvn3('Đ');
    expect(bytes).toHaveLength(1);
    expect(bytes[0]).toBe(0xa7);
  });

  it('passes plain ASCII through unchanged', () => {
    const bytes = encodeTcvn3('AB');
    expect(Array.from(bytes)).toEqual([0x41, 0x42]);
  });
});
