import { renderDocumentToBitmap } from '../renderDocumentToBitmap';
import { Skia } from '@shopify/react-native-skia';
import type { PrintPaperConfig } from '../../models/paper/PrintPaperConfig';
import { encodeCode128 } from '../code128';
import { LINE_HEIGHT_DOTS as LINE_HEIGHT_PX, BARCODE_HEIGHT_DOTS, QRCODE_HEIGHT_DOTS } from '../printLayoutConstants';

const MEDIA: PrintPaperConfig = { type: 'Continuous', paperSize: 80 };

describe('renderDocumentToBitmap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('creates an offscreen surface sized to the paper width', async () => {
    await renderDocumentToBitmap({ elements: [] }, MEDIA);
    expect(Skia.Surface.MakeOffscreen).toHaveBeenCalledWith(576, expect.any(Number)); // Mm80 → imageWidthPx 576
  });

  it('returns a base64 string on success', async () => {
    const result = await renderDocumentToBitmap({ elements: [] }, MEDIA);
    expect(typeof result).toBe('string');
  });

  it('returns null if Surface.MakeOffscreen returns null (native failure)', async () => {
    (Skia.Surface.MakeOffscreen as jest.Mock).mockReturnValueOnce(null);
    expect(await renderDocumentToBitmap({ elements: [] }, MEDIA)).toBeNull();
  });

  it('constructs the font at size LINE_HEIGHT_PX (24), not the Skia default', async () => {
    await renderDocumentToBitmap({ elements: [] }, MEDIA);
    expect(Skia.Font).toHaveBeenCalledWith(undefined, LINE_HEIGHT_PX);
  });

  it('looks up a monospace typeface via FontMgr.System().matchFamilyStyle and uses it when found', async () => {
    const fakeTypeface = { fake: 'typeface' };
    (Skia.FontMgr.System as jest.Mock).mockReturnValueOnce({ matchFamilyStyle: jest.fn(() => fakeTypeface) });
    await renderDocumentToBitmap({ elements: [] }, MEDIA);
    expect(Skia.Font).toHaveBeenCalledWith(fakeTypeface, LINE_HEIGHT_PX);
  });

  it('falls back to the default typeface at the correct size when matchFamilyStyle returns null', async () => {
    (Skia.FontMgr.System as jest.Mock).mockReturnValueOnce({ matchFamilyStyle: jest.fn(() => null) });
    await renderDocumentToBitmap({ elements: [] }, MEDIA);
    expect(Skia.Font).toHaveBeenCalledWith(undefined, LINE_HEIGHT_PX);
  });

  it('draws a text element via canvas.drawText at the running y offset', async () => {
    await renderDocumentToBitmap({ elements: [{ type: 'text', content: 'Xin chào', x: 0, y: 0 }] }, MEDIA);
    const surface = (Skia.Surface.MakeOffscreen as jest.Mock).mock.results[0].value;
    const drawTextCall = surface.getCanvas().ops.find((o: { op: string }) => o.op === 'drawText');
    expect(drawTextCall.args[0]).toBe('Xin chào');
  });

  it('draws a line element via canvas.drawLine spanning the full width', async () => {
    await renderDocumentToBitmap({ elements: [{ type: 'line', x: 0, y: 0 }] }, MEDIA);
    const surface = (Skia.Surface.MakeOffscreen as jest.Mock).mock.results[0].value;
    const drawLineCall = surface.getCanvas().ops.find((o: { op: string }) => o.op === 'drawLine');
    expect(drawLineCall.args[2]).toBe(576); // x1 = widthPx cho Mm80
  });

  it('draws a row element as two drawText calls (left + right)', async () => {
    await renderDocumentToBitmap({ elements: [{ type: 'row', left: 'Tổng', right: '10.000đ', x: 0, y: 0 }] }, MEDIA);
    const surface = (Skia.Surface.MakeOffscreen as jest.Mock).mock.results[0].value;
    const drawTextCalls = surface.getCanvas().ops.filter((o: { op: string }) => o.op === 'drawText');
    expect(drawTextCalls.map((c: { args: unknown[] }) => c.args[0])).toEqual(['Tổng', '10.000đ']);
  });

  it('draws each table row as its own drawText call', async () => {
    await renderDocumentToBitmap({ elements: [{ type: 'table', rows: [['a', 'b'], ['c', 'd']], x: 0, y: 0 }] }, MEDIA);
    const surface = (Skia.Surface.MakeOffscreen as jest.Mock).mock.results[0].value;
    const drawTextCalls = surface.getCanvas().ops.filter((o: { op: string }) => o.op === 'drawText');
    expect(drawTextCalls.map((c: { args: unknown[] }) => c.args[0])).toEqual(['a  b', 'c  d']);
  });

  it('sizes the surface height to the number of lines plus one bottom-margin line (2 lines → 2*LINE_HEIGHT_PX + LINE_HEIGHT_PX)', async () => {
    await renderDocumentToBitmap(
      { elements: [{ type: 'text', content: 'a', x: 0, y: 0 }, { type: 'text', content: 'b', x: 0, y: 0 }] },
      MEDIA,
    );
    // 2 * 24 (nội dung) + 24 (biên dưới bù offset y khởi đầu LINE_HEIGHT_PX của vòng lặp vẽ) = 72
    expect(Skia.Surface.MakeOffscreen).toHaveBeenCalledWith(576, 72);
  });

  it('sizes the surface height for an empty document to max(LINE_HEIGHT_PX, 0) + LINE_HEIGHT_PX', async () => {
    await renderDocumentToBitmap({ elements: [] }, MEDIA);
    expect(Skia.Surface.MakeOffscreen).toHaveBeenCalledWith(576, 48);
  });

  it('does not add height for an image element (matches the drawing loop, which does not advance y for image)', async () => {
    await renderDocumentToBitmap({ elements: [{ type: 'image', data: 'x', x: 0, y: 0 }] }, MEDIA);
    // image không được vẽ → chỉ còn biên dưới mặc định, giống document rỗng: max(24, 0) + 24 = 48
    expect(Skia.Surface.MakeOffscreen).toHaveBeenCalledWith(576, 48);
  });

  it('draws a barcode as a series of drawRect calls whose count matches the encoded bar count', async () => {
    await renderDocumentToBitmap({ elements: [{ type: 'barcode', content: 'AB', x: 0, y: 0 }] }, MEDIA);
    const surface = (Skia.Surface.MakeOffscreen as jest.Mock).mock.results[0].value;
    const rectCalls = surface.getCanvas().ops.filter((o: { op: string }) => o.op === 'drawRect');
    const { widths } = encodeCode128('AB');
    // bars sit at even indices (0, 2, 4, ...) of widths — count of even indices in an array of length N is ceil(N/2)
    const expectedBarCount = Math.ceil(widths.length / 2);
    expect(rectCalls.length).toBe(expectedBarCount);
  });

  it('barcode advances y by BARCODE_HEIGHT_DOTS, not LINE_HEIGHT_PX', async () => {
    await renderDocumentToBitmap(
      { elements: [{ type: 'barcode', content: 'A', x: 0, y: 0 }, { type: 'text', content: 'after', x: 0, y: 0 }] },
      MEDIA,
    );
    const surface = (Skia.Surface.MakeOffscreen as jest.Mock).mock.results[0].value;
    const drawTextCall = surface.getCanvas().ops.find((o: { op: string }) => o.op === 'drawText');
    expect(drawTextCall.args[2]).toBe(LINE_HEIGHT_PX + BARCODE_HEIGHT_DOTS); // y của "after"
  });

  it('draws a qrCode as a grid of drawRect calls matching the module matrix size', async () => {
    const qrcode = require('qrcode');
    (qrcode.create as jest.Mock).mockReturnValueOnce({ modules: { size: 2, data: new Uint8Array([1, 0, 0, 1]) } });
    await renderDocumentToBitmap({ elements: [{ type: 'qrCode', content: 'https://x', x: 0, y: 0 }] }, MEDIA);
    const surface = (Skia.Surface.MakeOffscreen as jest.Mock).mock.results[0].value;
    const rectCalls = surface.getCanvas().ops.filter((o: { op: string }) => o.op === 'drawRect');
    expect(rectCalls).toHaveLength(2); // chỉ 2 module "dark" (data[0]=1, data[3]=1) được vẽ, module 0 bị bỏ qua
  });

  it('qrCode advances y by QRCODE_HEIGHT_DOTS', async () => {
    await renderDocumentToBitmap(
      { elements: [{ type: 'qrCode', content: 'x', x: 0, y: 0 }, { type: 'text', content: 'after', x: 0, y: 0 }] },
      MEDIA,
    );
    const surface = (Skia.Surface.MakeOffscreen as jest.Mock).mock.results[0].value;
    const drawTextCall = surface.getCanvas().ops.find((o: { op: string }) => o.op === 'drawText');
    expect(drawTextCall.args[2]).toBe(LINE_HEIGHT_PX + QRCODE_HEIGHT_DOTS);
  });
});
