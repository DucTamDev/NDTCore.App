import { Buffer } from 'buffer';
import { encodeTsplCommand } from '../TsplCommandEncoder';
import { PrinterErrorCode } from '../../../errors/PrinterError';
import { RenderMode } from '../../../models/printer/PrinterLanguage';
import type { Printer } from '../../../models/printer/Printer';
import { CutterMode, PaperSize, PaperType, type PaperOptions } from '../../../models/paper/PaperOptions';
import type { PrintDocument } from '../../../models/printing/PrintDocument';
import { makePrinter, makeTsplLanguage } from '../../../testing/printerFixtures';

const CONTINUOUS: PaperOptions = {
  type: PaperType.Continuous,
  paperSize: PaperSize.Mm80,
  cutterMode: CutterMode.PerJob,
};

const DIE_CUT: PaperOptions = {
  type: PaperType.DieCut,
  paperSize: PaperSize.Mm80,
  itemWidthMm: 30,
  itemHeightMm: 40,
  columns: 3,
  horizontalGapMm: 2,
  verticalGapMm: 3,
};

const printerWith = (paper: PaperOptions): Printer =>
  makePrinter({ language: makeTsplLanguage({ renderMode: RenderMode.Command }), paper });

/** Encode rồi đọc lại thành chuỗi; nội dung TSPL mã hoá UTF-8 nên đọc theo UTF-8 để giữ dấu tiếng Việt. */
const encodeToText = (document: PrintDocument, paper: PaperOptions = CONTINUOUS): string =>
  Buffer.from(encodeTsplCommand(printerWith(paper), { text: document }, 1)).toString('utf-8');

describe('encodeTsplCommand', () => {
  it('phần tử text thành một lệnh TEXT tại y = 0', () => {
    expect(encodeToText({ elements: [{ type: 'text', content: 'Xin chào', x: 0, y: 0 }] })).toContain(
      'TEXT 0,0,"3",0,1,1,"Xin chào"',
    );
  });

  it('mỗi phần tử sau xuống thêm LINE_HEIGHT_DOTS', () => {
    const text = encodeToText({
      elements: [
        { type: 'text', content: 'Dòng 1', x: 0, y: 0 },
        { type: 'text', content: 'Dòng 2', x: 0, y: 0 },
      ],
    });

    expect(text).toContain('TEXT 0,0,"3"');
    expect(text).toContain('TEXT 0,24,"3"');
  });

  it('phần tử line thành một dòng gạch ngang đủ số ký tự của khổ giấy', () => {
    expect(encodeToText({ elements: [{ type: 'line', x: 0, y: 0 }] })).toContain(`"${'-'.repeat(48)}"`);
  });

  it('phần tử row canh trái/phải', () => {
    const text = encodeToText({ elements: [{ type: 'row', left: 'Tổng', right: '10.000đ', x: 0, y: 0 }] });

    expect(text).toContain(`"Tổng${' '.repeat(37)}10.000đ"`);
  });

  it('phần tử table: mỗi hàng một dòng TEXT, phần tử sau nằm dưới hàng cuối', () => {
    const text = encodeToText({
      elements: [
        { type: 'table', rows: [['a', 'b'], ['c', 'd']], x: 0, y: 0 },
        { type: 'text', content: 'Sau bảng', x: 0, y: 0 },
      ],
    });

    expect(text).toContain('TEXT 0,0,"3",0,1,1,"a  b"');
    expect(text).toContain('TEXT 0,24,"3",0,1,1,"c  d"');
    expect(text).toContain('TEXT 0,48,"3",0,1,1,"Sau bảng"');
  });

  it('phần tử barcode dùng lệnh BARCODE của máy', () => {
    expect(encodeToText({ elements: [{ type: 'barcode', content: '123456', x: 0, y: 0 }] })).toContain(
      'BARCODE 0,0,"128",50,1,0,2,2,"123456"',
    );
  });

  it('phần tử qrCode dùng lệnh QRCODE của máy', () => {
    expect(encodeToText({ elements: [{ type: 'qrCode', content: 'https://x', x: 0, y: 0 }] })).toContain(
      'QRCODE 0,0,H,4,A,0,"https://x"',
    );
  });

  it('phần tử ảnh → TSPL_ELEMENT_UNSUPPORTED', () => {
    expect(() => encodeToText({ elements: [{ type: 'image', data: 'x', x: 0, y: 0 }] })).toThrow(
      expect.objectContaining({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED }),
    );
  });

  it('kết thúc bằng PRINT rows,1', () => {
    expect(encodeToText({ elements: [] })).toContain('PRINT 1,1');
  });

  it('tem rời 3 cột lặp lại nội dung ở x = 0, pitch, 2 × pitch', () => {
    // pitch = (30 + 2) × 8 = 256 dot
    const text = encodeToText({ elements: [{ type: 'text', content: 'Xin chào', x: 0, y: 0 }] }, DIE_CUT);

    expect(text).toContain('TEXT 0,0,"3",0,1,1,"Xin chào"');
    expect(text).toContain('TEXT 256,0,"3",0,1,1,"Xin chào"');
    expect(text).toContain('TEXT 512,0,"3",0,1,1,"Xin chào"');
  });
});
