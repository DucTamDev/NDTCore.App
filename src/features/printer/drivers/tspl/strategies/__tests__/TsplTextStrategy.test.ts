import { Buffer } from 'buffer';
import { TsplTextStrategy } from '../TsplTextStrategy';
import type { TsplStrategyContext } from '../tsplStrategy.types';
import { PrinterErrorCode } from '../../../../errors/PrinterError';
import { RenderMode } from '../../../../models/printer/PrinterDriver';
import { PrintType } from '../../../../models/printing/PrintType';
import type { Printer } from '../../../../models/printer/Printer';
import type { PrintPaperConfig } from '../../../../models/paper/PrintPaperConfig';
import type { PrintDocument } from '../../../../models/printing/PrintDocument';
import { makePrinter, makeTsplDriver } from '../../../../testing/printerFixtures';

const MEDIA: PrintPaperConfig = { type: 'Continuous', paperSize: 80 };

const printer: Printer = makePrinter({
  id: 'p1',
  name: 'M',
  driver: makeTsplDriver({ config: { renderMode: RenderMode.Encoder } }),
  paper: MEDIA,
});

const ctx = (document: PrintDocument, over: Partial<TsplStrategyContext> = {}): TsplStrategyContext => ({
  printer,
  documents: { text: document },
  printType: PrintType.Receipt,
  paper: MEDIA,
  rows: 1,
  ...over,
});

// `TsplEncoder` UTF-8-encodes nội dung text (bắt buộc để in đúng tiếng Việt có
// dấu) — decode bằng `Buffer.toString('utf-8')` thay vì map 1-1 byte→charCode
// (sẽ ra chuỗi Latin-1 sai với mọi byte >= 0x80, làm hỏng assertion cho nội
// dung có dấu như "Xin chào"/"Tổng").
const asAscii = (bytes: Uint8Array): string => Buffer.from(bytes).toString('utf-8');

describe('TsplTextStrategy', () => {
  const s = new TsplTextStrategy();

  it('mode === Encoder', () => expect(s.mode).toBe(RenderMode.Encoder));

  it('validate không ném lỗi (không cần precondition như Bitmap)', () => {
    expect(() => s.validate(ctx({ elements: [] }))).not.toThrow();
  });

  it('encode phần tử text thành 1 lệnh TEXT tại y=0', () => {
    const ascii = asAscii(s.encode(ctx({ elements: [{ type: 'text', content: 'Xin chào', x: 0, y: 0 }] })));
    expect(ascii).toContain('TEXT 0,0,"3",0,1,1,"Xin chào"');
  });

  it('mỗi phần tử tiếp theo tăng y theo LINE_HEIGHT_DOTS', () => {
    const ascii = asAscii(
      s.encode(
        ctx({
          elements: [
            { type: 'text', content: 'Dòng 1', x: 0, y: 0 },
            { type: 'text', content: 'Dòng 2', x: 0, y: 0 },
          ],
        }),
      ),
    );
    expect(ascii).toContain('TEXT 0,0,"3"');
    expect(ascii).toContain('TEXT 0,24,"3"');
  });

  it('phần tử line thành 1 dòng gạch ngang đúng contentWidthChars', () => {
    const ascii = asAscii(s.encode(ctx({ elements: [{ type: 'line', x: 0, y: 0 }] })));
    expect(ascii).toContain(`"${'-'.repeat(48)}"`); // Mm80 → charsPerLine 48
  });

  it('phần tử row canh trái/phải qua formatRow', () => {
    const ascii = asAscii(s.encode(ctx({ elements: [{ type: 'row', left: 'Tổng', right: '10.000đ', x: 0, y: 0 }] })));
    expect(ascii).toContain('Tổng');
    expect(ascii).toContain('10.000đ');
  });

  it('phần tử table: mỗi row là 1 dòng TEXT riêng', () => {
    const ascii = asAscii(s.encode(ctx({ elements: [{ type: 'table', rows: [['a', 'b'], ['c', 'd']], x: 0, y: 0 }] })));
    expect(ascii).toContain('a  b');
    expect(ascii).toContain('c  d');
  });

  it('phần tử barcode gọi lệnh BARCODE native', () => {
    const ascii = asAscii(s.encode(ctx({ elements: [{ type: 'barcode', content: '123456', x: 0, y: 0 }] })));
    expect(ascii).toContain('BARCODE 0,0,"128",50,1,0,2,2,"123456"');
  });

  it('phần tử qrCode gọi lệnh QRCODE native', () => {
    const ascii = asAscii(s.encode(ctx({ elements: [{ type: 'qrCode', content: 'https://x', x: 0, y: 0 }] })));
    expect(ascii).toContain('QRCODE 0,0,H,4,A,0,"https://x"');
  });

  it('phần tử image ném TSPL_ELEMENT_UNSUPPORTED', () => {
    const run = () => s.encode(ctx({ elements: [{ type: 'image', data: 'x', x: 0, y: 0 }] }));
    expect(run).toThrow();
    try {
      run();
    } catch (e) {
      expect(e).toMatchObject({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED });
    }
  });

  it('encode kết thúc bằng PRINT rows,1', () => {
    expect(asAscii(s.encode(ctx({ elements: [] })))).toContain('PRINT 1,1');
  });
});
