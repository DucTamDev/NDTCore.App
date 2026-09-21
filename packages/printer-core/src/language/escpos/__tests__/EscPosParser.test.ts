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
});
