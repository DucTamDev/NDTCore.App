import { getProfile, findByLanguage } from '../PrinterProfileResolver';

describe('PrinterProfileResolver', () => {
  it('resolves a known TSC printer key', () => {
    const profile = getProfile('tsc-te310');
    expect(profile?.language).toBe('tsc');
    expect(profile?.dpi).toBe(300);
  });

  it('returns undefined for an unknown key', () => {
    expect(getProfile('nonexistent-printer')).toBeUndefined();
  });

  it('finds all escpos-language profiles', () => {
    const profiles = findByLanguage('escpos');
    expect(profiles.length).toBeGreaterThan(0);
    profiles.forEach((p) => expect(p.language).toBe('escpos'));
  });
});
