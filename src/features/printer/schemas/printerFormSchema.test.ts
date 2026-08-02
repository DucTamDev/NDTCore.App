// src/features/printer/schemas/printerFormSchema.test.ts
import { lanConnectionSchema, printerDisplaySchema } from './printerFormSchema';

describe('lanConnectionSchema', () => {
  it('accepts a valid IP and port', () => {
    const result = lanConnectionSchema.safeParse({ lanIp: '192.168.1.20', lanPort: '9100' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid IP', () => {
    const result = lanConnectionSchema.safeParse({ lanIp: 'not-an-ip', lanPort: '9100' });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-range port', () => {
    const result = lanConnectionSchema.safeParse({ lanIp: '192.168.1.20', lanPort: '70000' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric port', () => {
    const result = lanConnectionSchema.safeParse({ lanIp: '192.168.1.20', lanPort: 'abc' });
    expect(result.success).toBe(false);
  });
});

describe('printerDisplaySchema', () => {
  it('accepts a valid display name and paper size', () => {
    const result = printerDisplaySchema.safeParse({ printerName: 'Máy in quầy 1', paperSize: '80mm' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty printer name', () => {
    const result = printerDisplaySchema.safeParse({ printerName: '', paperSize: '80mm' });
    expect(result.success).toBe(false);
  });
});
