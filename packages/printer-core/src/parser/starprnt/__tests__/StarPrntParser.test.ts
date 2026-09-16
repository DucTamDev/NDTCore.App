import { StarPrntParser } from '../StarPrntParser';

describe('StarPrntParser', () => {
  it('parses a simple ESC @ (init) + text sequence without warnings', () => {
    const bytes = new Uint8Array([0x1b, 0x40, ...new TextEncoder().encode('Hello'), 0x0a]);
    const result = new StarPrntParser().parse(bytes);
    expect(result.warnings).toEqual([]);
    expect(result.commands.length).toBeGreaterThan(0);
  });

  it('decodes Star alignment and bold state into a matching text element', () => {
    const bytes = new Uint8Array([
      0x1b, 0x1d, 0x61, 0x01, // ESC GS a 1 — center
      0x1b, 0x45, // ESC E — bold on
      ...new TextEncoder().encode('Hi'),
      0x0a,
    ]);
    const result = new StarPrntParser().parse(bytes);
    const textElement = result.elements.find((el) => el.type === 'text');
    expect(textElement && textElement.type === 'text' ? textElement.content : undefined).toBe('Hi');
    expect(textElement && textElement.type === 'text' ? textElement.options?.align : undefined).toBe('center');
    expect(textElement && textElement.type === 'text' ? textElement.options?.bold : undefined).toBe(true);
  });

  it('decodes a raster image block into "ESC * r A", per-row "b" records, and "ESC * r B"', () => {
    const bytes = new Uint8Array([
      0x1b, 0x2a, 0x72, 0x41, // ESC * r A
      0x62, 0x01, 0x00, 0xff, // b nL nH data (1 byte row)
      0x1b, 0x2a, 0x72, 0x42, // ESC * r B
    ]);
    const result = new StarPrntParser().parse(bytes);
    expect(result.commands.some((c) => c.name === 'ESC * r A')).toBe(true);
    expect(result.commands.some((c) => c.name === 'b')).toBe(true);
    expect(result.commands.some((c) => c.name === 'ESC * r B')).toBe(true);
  });

  it('decodes a cash-drawer BEL byte', () => {
    const result = new StarPrntParser().parse(new Uint8Array([0x07]));
    expect(result.commands).toEqual([{ name: 'BEL', bytes: [0x07] }]);
  });
});
