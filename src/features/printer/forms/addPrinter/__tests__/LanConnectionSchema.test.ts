import { lanConnectionSchema } from '../LanConnectionSchema';

describe('lanConnectionSchema', () => {
  it('accepts a valid IPv4 + port', () => {
    expect(lanConnectionSchema.safeParse({ lanIp: '192.168.1.10', lanPort: '9100' }).success).toBe(true);
  });

  it('rejects an invalid IPv4', () => {
    expect(lanConnectionSchema.safeParse({ lanIp: '999.1.1.1', lanPort: '9100' }).success).toBe(false);
  });
});
