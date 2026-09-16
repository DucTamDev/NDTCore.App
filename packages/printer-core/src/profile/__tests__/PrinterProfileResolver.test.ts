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

  it('resolves the Zebra ZD420 profile with its real field values', () => {
    const profile = getProfile('zebra-zd420');
    expect(profile?.name).toBe('Zebra ZD420');
    expect(profile?.language).toBe('zpl');
    expect(profile?.paperWidth).toBe(108);
    expect(profile?.dotsPerLine).toBe(832);
    expect(profile?.dpi).toBe(203);
    expect(profile?.usbVendorId).toBe(0x0a5f);
    expect(profile?.features.cutter).toBe('full');
    expect(profile?.features.nativeUtf8).toBe(true);
  });

  it('resolves the Star TSP143 profile with its real field values', () => {
    const profile = getProfile('star-tsp143');
    expect(profile?.name).toBe('Star TSP143');
    expect(profile?.language).toBe('starprnt');
    expect(profile?.paperWidth).toBe(80);
    expect(profile?.dotsPerLine).toBe(576);
    expect(profile?.usbVendorId).toBe(0x0519);
    expect(profile?.features.cutter).toBe('partial');
    expect(profile?.features.cashDrawer).toBe(true);
  });

  it('resolves the SATO CL4NX profile with its real field values', () => {
    const profile = getProfile('sato-cl4nx');
    expect(profile?.name).toBe('SATO CL4NX');
    expect(profile?.language).toBe('sbpl');
    expect(profile?.paperWidth).toBe(104);
    expect(profile?.dotsPerLine).toBe(832);
    expect(profile?.features.cjk).toBe(true);
    expect(profile?.usbVendorId).toBeUndefined();
  });
});
