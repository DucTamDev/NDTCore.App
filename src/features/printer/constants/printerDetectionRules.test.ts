// src/features/printer/constants/printerDetectionRules.test.ts
import { PRINTER_DETECTION_RULES } from './printerDetectionRules';

describe('PRINTER_DETECTION_RULES', () => {
  it('ends with a catch-all fallback rule with low confidence', () => {
    const last = PRINTER_DETECTION_RULES[PRINTER_DETECTION_RULES.length - 1];
    expect(last.vendorMatch.test('anything at all')).toBe(true);
    expect(last.confidence).toBe('low');
    expect(last.candidates).toEqual(['escpos', 'tspl']);
  });

  it('matches Epson TM-T82III to escpos with high confidence', () => {
    const rule = PRINTER_DETECTION_RULES.find(
      (r) => r.vendorMatch.test('Epson TM-T82III') && (!r.modelMatch || r.modelMatch.test('Epson TM-T82III')),
    );
    expect(rule?.candidates).toEqual(['escpos']);
    expect(rule?.confidence).toBe('high');
  });

  it('matches Xprinter XP-365B to a dual candidate list with low confidence', () => {
    const rule = PRINTER_DETECTION_RULES.find(
      (r) => r.vendorMatch.test('Xprinter XP-365B') && (!r.modelMatch || r.modelMatch.test('Xprinter XP-365B')),
    );
    expect(rule?.candidates).toEqual(['tspl', 'escpos']);
    expect(rule?.confidence).toBe('low');
  });

  it('matches Xprinter XP-58 (receipt) to escpos, not the label rules', () => {
    const rule = PRINTER_DETECTION_RULES.find(
      (r) => r.vendorMatch.test('Xprinter XP-58') && (!r.modelMatch || r.modelMatch.test('Xprinter XP-58')),
    );
    expect(rule?.candidates).toEqual(['escpos']);
  });

  it('matches iTP76 (receipt) to escpos with medium confidence', () => {
    const rule = PRINTER_DETECTION_RULES.find(
      (r) => r.vendorMatch.test('iTP76') && (!r.modelMatch || r.modelMatch.test('iTP76')),
    );
    expect(rule?.candidates).toEqual(['escpos']);
    expect(rule?.confidence).toBe('medium');
  });

  it('matches iTP3300 (label) to tspl, not the receipt iTP rule', () => {
    const rule = PRINTER_DETECTION_RULES.find(
      (r) => r.vendorMatch.test('iTP3300') && (!r.modelMatch || r.modelMatch.test('iTP3300')),
    );
    expect(rule?.candidates).toEqual(['tspl']);
    expect(rule?.confidence).toBe('medium');
  });
});
