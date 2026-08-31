import { printerDisplaySchema } from '../PrinterDisplaySchema';

describe('printerDisplaySchema', () => {
  it('accepts { name } không cần paperSize', () => {
    expect(printerDisplaySchema.safeParse({ name: 'Máy in' }).success).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(printerDisplaySchema.safeParse({ name: '' }).success).toBe(false);
  });
});
