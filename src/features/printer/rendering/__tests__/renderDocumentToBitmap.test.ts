import { renderDocumentToBitmap } from '../renderDocumentToBitmap';
import { Skia } from '@shopify/react-native-skia';
import type { PrintPaperConfig } from '../../models/paper/PrintPaperConfig';
import { encodeCode128 } from '../code128';
import { LINE_HEIGHT_DOTS as LINE_HEIGHT_PX, BARCODE_HEIGHT_DOTS } from '../printLayoutConstants';

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

  it('sizes the surface height to the number of lines (2 lines → 2 * LINE_HEIGHT_PX, min 1 line)', async () => {
    await renderDocumentToBitmap(
      { elements: [{ type: 'text', content: 'a', x: 0, y: 0 }, { type: 'text', content: 'b', x: 0, y: 0 }] },
      MEDIA,
    );
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
});
