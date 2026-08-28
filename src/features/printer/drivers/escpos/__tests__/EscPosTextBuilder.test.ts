import { buildEscPosText } from '../EscPosTextBuilder';
import { AppErrorCode } from '../../../types/AppError';
import type { PrintDocuments } from '../../../types/driver.types';

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

  it('element không in được (barcode) → TSPL_ELEMENT_UNSUPPORTED', () => {
    const docs: PrintDocuments = { text: { elements: [{ type: 'barcode', content: 'X', x: 0, y: 0 }] } };
    try { buildEscPosText(80, docs); } catch (e) { expect(e).toMatchObject({ code: AppErrorCode.TSPL_ELEMENT_UNSUPPORTED }); }
    expect(() => buildEscPosText(80, docs)).toThrow();
  });
});
