import { buildEscPosText } from '../EscPosTextBuilder';
import { PrinterErrorCode } from '../../../errors/PrinterError';
import type { PrintDocuments } from '../../../models/printing/PrintDocuments';

describe('buildEscPosText', () => {
  it('render text/line/row/table thành text', () => {
    const docs: PrintDocuments = { text: { elements: [
      { type: 'text', content: 'Hoá đơn', x: 0, y: 0 },
      { type: 'line', x: 0, y: 0 },
      { type: 'row', left: 'Tổng', right: '10.000', x: 0, y: 0 },
    ] } };
    const out = buildEscPosText(80, docs);
    expect(out).toContain('Hoá đơn');
    expect(out).toContain('Tổng');
    expect(out.trim().split('\n').length).toBeGreaterThanOrEqual(3);
  });

  it('row: chèn khoảng trắng để giá trị phải chạm đúng mép số ký tự của khổ giấy', () => {
    const docs: PrintDocuments = { text: { elements: [{ type: 'row', left: 'Tổng', right: '10.000', x: 0, y: 0 }] } };
    expect(buildEscPosText(80, docs)).toBe(`Tổng${' '.repeat(38)}10.000\n`);
  });

  it('row tràn dòng vẫn giữ 1 khoảng trắng giữa trái và phải', () => {
    const left = 'A'.repeat(30);
    const right = 'B'.repeat(30);
    const docs: PrintDocuments = { text: { elements: [{ type: 'row', left, right, x: 0, y: 0 }] } };
    expect(buildEscPosText(80, docs)).toBe(`${left} ${right}\n`);
  });

  it('element không in được (barcode) → TSPL_ELEMENT_UNSUPPORTED', () => {
    const docs: PrintDocuments = { text: { elements: [{ type: 'barcode', content: 'X', x: 0, y: 0 }] } };
    try { buildEscPosText(80, docs); } catch (e) { expect(e).toMatchObject({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED }); }
    expect(() => buildEscPosText(80, docs)).toThrow();
  });
});
