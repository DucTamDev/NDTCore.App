import { EscPosParser } from '../EscPosParser';

describe('EscPosParser', () => {
  it('parses a simple ESC @ (init) + text sequence without warnings', () => {
    const bytes = new Uint8Array([0x1b, 0x40, ...new TextEncoder().encode('Hello'), 0x0a]);
    const result = new EscPosParser().parse(bytes);
    expect(result.warnings).toEqual([]);
    expect(result.commands.length).toBeGreaterThan(0);
  });

  it('decodes alignment, bold, and text into a matching text element', () => {
    const bytes = new Uint8Array([
      0x1b,
      0x61,
      0x01, // ESC a 1 — center
      0x1b,
      0x45,
      0x01, // ESC E 1 — bold on
      ...new TextEncoder().encode('Hi'),
      0x0a,
    ]);
    const result = new EscPosParser().parse(bytes) as unknown as {
      commands: unknown[];
      warnings: string[];
      elements: Array<{ type: string; content: string; options: Record<string, unknown> }>;
    };

    const textElement = result.elements.find((el) => el.type === 'text');
    expect(textElement?.content).toBe('Hi');
    expect(textElement?.options.align).toBe('center');
    expect(textElement?.options.bold).toBe(true);
  });

  it('đọc chuỗi 1 ký tự = 1 byte giống hệt dạng byte, kể cả byte >= 0x80', () => {
    const bytes = new Uint8Array([0x1b, 0x40, 0x48, 0x69, 0x80, 0x0a]);
    const fromBytes = new EscPosParser().parse(bytes);

    const fromString = new EscPosParser().parse(String.fromCharCode(...bytes));

    expect(fromString.commands.length).toBeGreaterThan(0);
    expect(fromString).toEqual(fromBytes);
  });

  it('dựng fontSize từ hệ số phóng đại GS ! theo font A 24 dots', () => {
    const bytes = new Uint8Array([0x1d, 0x21, 0x11, ...new TextEncoder().encode('Hi'), 0x0a]);
    const result = new EscPosParser().parse(bytes) as unknown as {
      elements: Array<{ type: string; options: Record<string, unknown> }>;
    };

    expect(result.elements.find((el) => el.type === 'text')?.options.fontSize).toBe(48);
  });
});
