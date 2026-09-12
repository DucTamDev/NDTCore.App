import { renderDocumentToBitmap } from '../renderDocumentToBitmap';
import { Skia } from '@shopify/react-native-skia';
import type { PrintPaperConfig } from '../../models/paper/PrintPaperConfig';

const MEDIA: PrintPaperConfig = { type: 'Continuous', paperSize: 80 };

describe('renderDocumentToBitmap', () => {
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
});
