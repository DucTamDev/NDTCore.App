import { encodeTextForPrinter } from '../CodePageEncoder';

describe('encodeTextForPrinter', () => {
  it('passes UTF-8 straight through for a native-UTF8 printer profile', () => {
    const result = encodeTextForPrinter('café', { features: { nativeUtf8: true, codePages: [] } });
    expect(Array.from(result.bytes)).toEqual(Array.from(new TextEncoder().encode('café')));
  });

  it('falls back to code-page lookup for a non-native-UTF8 profile', () => {
    const result = encodeTextForPrinter('cafe', { features: { nativeUtf8: false, codePages: [437] } });
    expect(result.codePage?.id).toBe(437);
  });
});
