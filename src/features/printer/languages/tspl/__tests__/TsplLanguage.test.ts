import { TsplLanguage } from '../TsplLanguage';
import { fingerprintOf } from '../../../testing/encodeCases';
import { RenderMode } from '../../../models/printer/PrinterLanguage';
import { makePrinter, makeTsplLanguage } from '../../../testing/printerFixtures';

const printer = makePrinter({ language: makeTsplLanguage({ renderMode: RenderMode.Command }) });

const documents = { text: { elements: [{ type: 'text' as const, content: 'Trà đào', x: 0, y: 0 }] } };

describe('TsplLanguage', () => {
  it('lệnh dò là ~!T và chỉ khớp khi máy có trả lời', () => {
    const probe = TsplLanguage.identifyProbe;

    expect(probe && Array.from(probe.command)).toEqual([0x7e, 0x21, 0x54, 0x0d, 0x0a]);
    expect(probe?.matches(new Uint8Array([]))).toBe(false);
    expect(probe?.matches(new Uint8Array([0x00]))).toBe(true);
  });

  it('số hàng không hợp lệ coi như 1 hàng', () => {
    const oneRow = fingerprintOf(TsplLanguage.encode(printer, documents));

    expect(fingerprintOf(TsplLanguage.encode(printer, documents, { rows: 0 }))).toBe(oneRow);
    expect(fingerprintOf(TsplLanguage.encode(printer, documents, { rows: Number.NaN }))).toBe(oneRow);
  });
});
