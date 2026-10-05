import { PrinterPrintService } from '../PrinterPrintService';
import { PrinterRepository } from '../../storage/PrinterRepository';
import { ResourceLock } from '../../connection/PrinterConnectionLock';
import { printerStorage } from '../../storage/PrinterStorage';
import { printerLogger } from '../../logging/PrinterLogger';
import { PrinterStatus } from '../../models/printer/PrinterStatus';
import { PrintLanguage, RenderMode } from '../../models/printer/PrinterLanguage';
import { ConnectionType } from '../../models/printer/ConnectionType';
import type { Printer } from '../../models/printer/Printer';
import { PrintKind } from '../../models/printer/PrintKind';
import type { PrintDocuments } from '../../models/printing/PrintDocuments';
import { PrinterErrorCode } from '../../errors/PrinterError';
import { EscPosLanguage, TsplLanguage } from '../../languages';
import { basePrinter, makeMockConnectionService, tsplLanguage } from '../../testing/printerServiceTestKit';

jest.mock('../../../../services/LoggerService', () => ({
  LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() },
}));

jest.mock('../../logging/PrinterLogger', () => ({
  printerLogger: {
    printSucceeded: jest.fn(),
    printFailed: jest.fn(),
    testPrintSucceeded: jest.fn(),
    testPrintFailed: jest.fn(),
  },
}));

const documents: PrintDocuments = { text: { elements: [{ type: 'text', content: 'Trà đào', x: 0, y: 0 }] } };

/** In lệnh nên không cần ảnh, để so byte theo số hàng. */
const tsplLabelPrinter: Printer = {
  ...basePrinter,
  id: 'p2',
  deviceId: 'lan:192.168.1.11:9100',
  kind: PrintKind.Label,
  language: { ...tsplLanguage, renderMode: RenderMode.Command },
  connection: { type: ConnectionType.Lan, host: '192.168.1.11', port: 9100 },
};

/** Service với connection giả, repository thật trên storage đã xoá sạch. */
const setup = (connectionOverrides: Parameters<typeof makeMockConnectionService>[0] = {}) => {
  const connectionService = makeMockConnectionService(connectionOverrides);
  const repository = new PrinterRepository();
  const lock = new ResourceLock();
  const service = new PrinterPrintService(connectionService, repository, lock);

  return { service, connectionService, repository, lock };
};

describe('PrinterPrintService', () => {
  beforeEach(() => {
    printerStorage.savePrinters([]);
    jest.clearAllMocks();
  });

  it('in: encode theo ngôn ngữ của máy rồi gửi qua kết nối của máy', async () => {
    const { service, connectionService, repository } = setup();
    repository.addPrinter(basePrinter);

    await service.print(basePrinter.id, documents);

    expect(connectionService.send).toHaveBeenCalledWith(basePrinter.id, EscPosLanguage.encode(basePrinter, documents));
    expect(printerLogger.printSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: basePrinter.id, language: PrintLanguage.EscPos }),
    );
  });

  it('in: chưa kết nối thì kết nối trước', async () => {
    const { service, connectionService, repository } = setup({
      getStatus: jest.fn().mockReturnValue(PrinterStatus.Idle),
    });
    repository.addPrinter(basePrinter);

    await service.print(basePrinter.id, documents);

    expect(connectionService.connect).toHaveBeenCalledWith(basePrinter);
    expect(connectionService.send).toHaveBeenCalled();
  });

  it('in: đã kết nối thì không kết nối lại', async () => {
    const { service, connectionService, repository } = setup();
    repository.addPrinter(basePrinter);

    await service.print(basePrinter.id, documents);

    expect(connectionService.connect).not.toHaveBeenCalled();
  });

  it('in: chuyển tuỳ chọn số hàng xuống ngôn ngữ in', async () => {
    const { service, connectionService, repository } = setup();
    repository.addPrinter(tsplLabelPrinter);

    await service.print(tsplLabelPrinter.id, documents, { rows: 3 });

    const expected = TsplLanguage.encode(tsplLabelPrinter, documents, { rows: 3 });
    expect(connectionService.send).toHaveBeenCalledWith(tsplLabelPrinter.id, expected);
  });

  it('in: nội dung không in được thì không gửi gì và ghi log thất bại', async () => {
    const { service, connectionService, repository } = setup();
    repository.addPrinter(basePrinter);
    const unprintable: PrintDocuments = {
      text: {
        elements: [
          { type: 'text', content: 'Trà sữa', x: 0, y: 0 },
          { type: 'barcode', content: '123', x: 0, y: 10 },
        ],
      },
    };

    await expect(service.print(basePrinter.id, unprintable)).rejects.toMatchObject({
      code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED,
    });

    expect(connectionService.send).not.toHaveBeenCalled();
    expect(printerLogger.printFailed).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED }),
    );
  });

  /** `PrintScheduler` gọi `print` bên trong khoá của chính máy đó; khoá không reentrant nên tự khoá sẽ treo. */
  it('in: không tự lấy khoá', async () => {
    const { service, repository, lock } = setup();
    const runExclusive = jest.spyOn(lock, 'runExclusive');
    repository.addPrinter(basePrinter);

    await service.print(basePrinter.id, documents);

    expect(runExclusive).not.toHaveBeenCalled();
  });

  it('in thử: chạy trong khoá theo máy vật lý và không lưu máy in', async () => {
    const { service, connectionService, repository, lock } = setup();
    const runExclusive = jest.spyOn(lock, 'runExclusive');

    await service.testPrint(basePrinter, documents);

    expect(runExclusive).toHaveBeenCalledWith('lan:192.168.1.10:9100', expect.any(Function));
    expect(connectionService.send).toHaveBeenCalledWith(basePrinter.id, expect.any(Uint8Array));
    expect(repository.getPrinters()).toEqual([]);
    expect(printerLogger.testPrintSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: basePrinter.id, language: PrintLanguage.EscPos }),
    );
  });

  it('in thử: kết nối thất bại thì ghi log thất bại và ném lại lỗi', async () => {
    const { service } = setup({
      getStatus: jest.fn().mockReturnValue(PrinterStatus.Idle),
      connect: jest.fn().mockRejectedValue(new Error('offline')),
    });

    await expect(service.testPrint(basePrinter, documents)).rejects.toThrow('offline');

    expect(printerLogger.testPrintFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: basePrinter.id, errorCode: PrinterErrorCode.UNKNOWN_ERROR }),
    );
  });
});
