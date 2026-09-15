import { LabelBuilder } from '../builder/LabelBuilder';
import { TscCompiler } from '../compiler/tsc/TscCompiler';
import { TscParser } from '../parser/tsc/TscParser';
import { TscValidator } from '../validation/tsc/TscValidator';
import { EscPosCompiler } from '../compiler/escpos/EscPosCompiler';
import { EscPosParser } from '../parser/escpos/EscPosParser';

describe('Phase 1 end-to-end', () => {
  const doc = new LabelBuilder({ width: 40, height: 30, unit: 'mm', dpi: 203 })
    .text('Hello World', { x: 10, y: 10, size: 2 })
    .barcode({ symbology: 'code128', content: '123456789' })
    .resolve();

  it('compiles, parses, and validates a document as TSC', () => {
    const tsc = new TscCompiler().compile(doc);
    expect(new TscValidator().validate(tsc).valid).toBe(true);
    expect(new TscParser().parse(tsc).commands.length).toBeGreaterThan(0);
  });

  it('compiles and parses the same document as ESC/POS', () => {
    const bytes = new EscPosCompiler().compile(doc);
    expect(new EscPosParser().parse(bytes).commands.length).toBeGreaterThan(0);
  });
});
