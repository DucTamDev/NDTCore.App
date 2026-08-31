import { Platform } from 'react-native';
import { Buffer } from 'buffer';
import { TsplFontManager, DEFAULT_TSPL_FONT } from '../TsplFontManager';
import { PrinterErrorCode } from '../../../errors/PrinterError';

jest.mock('../../../../../services/LoggerService', () => ({ LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));

jest.mock('react-native-fs', () => ({
  readFileAssets: jest.fn(),
}));

const makeTransport = (overrides: Partial<{ write: jest.Mock }> = {}) => ({
  write: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('TsplFontManager.downloadFont', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { get: () => originalOS });
  });

  it('rejects with PRINTER_UNSUPPORTED_CONNECTION on non-Android platforms', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'ios' });
    const manager = new TsplFontManager();
    const transport = makeTransport();
    await expect(manager.downloadFont(transport as never, DEFAULT_TSPL_FONT)).rejects.toMatchObject({
      code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION,
    });
    expect(transport.write).not.toHaveBeenCalled();
  });

  it('reads the font asset as base64 and writes a DOWNLOAD command containing the font name and byte count', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'android' });
    const RNFS = jest.requireMock('react-native-fs') as { readFileAssets: jest.Mock };
    RNFS.readFileAssets.mockResolvedValue(Buffer.from('fake-font-bytes').toString('base64'));
    const manager = new TsplFontManager();
    const transport = makeTransport();

    await manager.downloadFont(transport as never, DEFAULT_TSPL_FONT);

    expect(RNFS.readFileAssets).toHaveBeenCalledWith(`fonts/${DEFAULT_TSPL_FONT.fileName}`, 'base64');
    expect(transport.write).toHaveBeenCalledTimes(1);
    const bytes = transport.write.mock.calls[0][0] as Uint8Array;
    const ascii = Array.from(bytes.slice(0, 60)).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain(`DOWNLOAD "${DEFAULT_TSPL_FONT.name}",15`); // 'fake-font-bytes' is 15 bytes
  });

  it('rejects with TSPL_FONT_INVALID when the font asset cannot be read', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'android' });
    const RNFS = jest.requireMock('react-native-fs') as { readFileAssets: jest.Mock };
    RNFS.readFileAssets.mockRejectedValue(new Error('file not found'));
    const manager = new TsplFontManager();
    const transport = makeTransport();

    await expect(manager.downloadFont(transport as never, DEFAULT_TSPL_FONT)).rejects.toMatchObject({
      code: PrinterErrorCode.TSPL_FONT_INVALID,
    });
    expect(transport.write).not.toHaveBeenCalled();
  });

  it('rejects with TSPL_FONT_INVALID when the font asset decodes to 0 bytes', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'android' });
    const RNFS = jest.requireMock('react-native-fs') as { readFileAssets: jest.Mock };
    RNFS.readFileAssets.mockResolvedValue('');
    const manager = new TsplFontManager();
    const transport = makeTransport();

    await expect(manager.downloadFont(transport as never, DEFAULT_TSPL_FONT)).rejects.toMatchObject({
      code: PrinterErrorCode.TSPL_FONT_INVALID,
    });
    expect(transport.write).not.toHaveBeenCalled();
  });

  it('rejects with TSPL_FONT_INSTALL_FAILED when the transport write fails', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'android' });
    const RNFS = jest.requireMock('react-native-fs') as { readFileAssets: jest.Mock };
    RNFS.readFileAssets.mockResolvedValue(Buffer.from('x').toString('base64'));
    const manager = new TsplFontManager();
    const transport = makeTransport({ write: jest.fn().mockRejectedValue(new Error('socket closed')) });

    await expect(manager.downloadFont(transport as never, DEFAULT_TSPL_FONT)).rejects.toMatchObject({
      code: PrinterErrorCode.TSPL_FONT_INSTALL_FAILED,
    });
  });
});
