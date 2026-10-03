import { getPrintLanguage } from '..';
import { ENCODE_CASES, fingerprintOf } from '../../testing/encodeCases';

describe('byte ngôn ngữ in sinh ra', () => {
  it.each(ENCODE_CASES.map((encodeCase) => [encodeCase.name, encodeCase] as const))('%s', (_name, encodeCase) => {
    const language = getPrintLanguage(encodeCase.printer.language.type);

    const bytes = language.encode(encodeCase.printer, encodeCase.documents, encodeCase.options);

    expect(fingerprintOf(bytes)).toBe(encodeCase.fingerprint);
  });
});
