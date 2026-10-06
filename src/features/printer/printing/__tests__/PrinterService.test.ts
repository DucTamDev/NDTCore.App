import { PrinterService } from '../PrinterService';
import { PrinterRepository } from '../../storage/PrinterRepository';
import { PrinterConnectionLock } from '../../connection/PrinterConnectionLock';
import { printerStorage } from '../../storage/PrinterStorage';
import { printerLogger } from '../../logging/PrinterLogger';
import { PrinterConnectionStatus } from '../../models/printer/PrinterConnectionStatus';
import { PrintLanguage } from '../../models/printer/PrinterLanguage';
import { ConnectionType } from '../../models/printer/ConnectionType';
import type { Printer } from '../../models/printer/Printer';
import { PrintKind } from '../../models/printer/PrintKind';
import { EscPosLanguage, TsplLanguage } from '../../languages';
import { basePrinter, makeMockConnectionService, tsplLanguage } from '../../testing/printerServiceTestKit';
import { stripedPngBase64 } from '../../testing/encodeCases';
import { PrintErrorCode, PrinterErrorCode } from '../../errors';

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

const image = stripedPngBase64();

/** Máy tem để so byte theo số hàng. */
const tsplLabelPrinter: Printer = {
  ...basePrinter,
  id: 'p2',
  deviceId: 'lan:192.168.1.11:9100',
  kind: PrintKind.Label,
  language: tsplLanguage,
  connection: { type: ConnectionType.Lan, host: '192.168.1.11', port: 9100 },
};

/** Service với connection giả, repository thật trên storage đã xoá sạch. */
const setup = (connectionOverrides: Parameters<typeof makeMockConnectionService>[0] = {}) => {
  const connectionService = makeMockConnectionService(connectionOverrides);
  const repository = new PrinterRepository();
  const lock = new PrinterConnectionLock();
  const service = new PrinterService(connectionService, repository, lock);

  return { service, connectionService, repository, lock };
};

describe('PrinterService', () => {
  beforeEach(() => {
    printerStorage.savePrinters([]);
    jest.clearAllMocks();
  });

  it('in: encode theo ngôn ngữ của máy rồi gửi qua kết nối của máy', async () => {
    const { service, connectionService, repository } = setup();
    repository.addPrinter(basePrinter);

    await service.print(basePrinter.id, image);

    expect(connectionService.send).toHaveBeenCalledWith(basePrinter.id, EscPosLanguage.encode(basePrinter, image));
    expect(printerLogger.printSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: basePrinter.id, language: PrintLanguage.EscPos }),
    );
  });

  it('in: máy in không còn trong danh sách → PRINTER_NOT_FOUND, không kết nối, không gửi', async () => {
    const { service, connectionService } = setup();

    await expect(service.print('deleted', image)).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_NOT_FOUND });
    expect(connectionService.connect).not.toHaveBeenCalled();
    expect(connectionService.send).not.toHaveBeenCalled();
  });

  it('in: chưa kết nối thì kết nối trước', async () => {
    const { service, connectionService, repository } = setup({
      getStatus: jest.fn().mockReturnValue(PrinterConnectionStatus.Idle),
    });
    repository.addPrinter(basePrinter);

    await service.print(basePrinter.id, image);

    expect(connectionService.connect).toHaveBeenCalledWith(basePrinter);
    expect(connectionService.send).toHaveBeenCalled();
  });

  it('in: đã kết nối thì không kết nối lại', async () => {
    const { service, connectionService, repository } = setup();
    repository.addPrinter(basePrinter);

    await service.print(basePrinter.id, image);

    expect(connectionService.connect).not.toHaveBeenCalled();
  });

  it('in: chuyển tuỳ chọn số hàng xuống ngôn ngữ in', async () => {
    const { service, connectionService, repository } = setup();
    repository.addPrinter(tsplLabelPrinter);

    await service.print(tsplLabelPrinter.id, image, { copies: 3 });

    const expected = TsplLanguage.encode(tsplLabelPrinter, image, { copies: 3 });
    expect(connectionService.send).toHaveBeenCalledWith(tsplLabelPrinter.id, expected);
  });

  it('in: ảnh hỏng thì không gửi gì và ghi log thất bại', async () => {
    const { service, connectionService, repository } = setup();
    repository.addPrinter(basePrinter);
    await expect(service.print(basePrinter.id, 'not-a-png')).rejects.toMatchObject({
      code: PrintErrorCode.INVALID_IMAGE,
    });

    expect(connectionService.send).not.toHaveBeenCalled();
    expect(printerLogger.printFailed).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: PrintErrorCode.INVALID_IMAGE }),
    );
  });

  /** `PrintService` gọi `print` bên trong khoá của chính máy đó; khoá không reentrant nên tự khoá sẽ treo. */
  it('in: không tự lấy khoá', async () => {
    const { service, repository, lock } = setup();
    const runExclusive = jest.spyOn(lock, 'runExclusive');
    repository.addPrinter(basePrinter);

    await service.print(basePrinter.id, image);

    expect(runExclusive).not.toHaveBeenCalled();
  });

  it('in thử: chạy trong khoá theo máy vật lý và không lưu máy in', async () => {
    const { service, connectionService, repository, lock } = setup();
    const runExclusive = jest.spyOn(lock, 'runExclusive');

    await service.testPrint(basePrinter, image);

    expect(runExclusive).toHaveBeenCalledWith('lan:192.168.1.10:9100', expect.any(Function));
    expect(connectionService.send).toHaveBeenCalledWith(basePrinter.id, expect.any(Uint8Array));
    expect(repository.getPrinters()).toEqual([]);
    expect(printerLogger.testPrintSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: basePrinter.id, language: PrintLanguage.EscPos }),
    );
  });

  it('in thử: kết nối thất bại thì ghi log thất bại và ném lại lỗi', async () => {
    const { service } = setup({
      getStatus: jest.fn().mockReturnValue(PrinterConnectionStatus.Idle),
      connect: jest.fn().mockRejectedValue(new Error('offline')),
    });

    await expect(service.testPrint(basePrinter, image)).rejects.toThrow('offline');

    expect(printerLogger.testPrintFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: basePrinter.id, errorCode: PrintErrorCode.UNKNOWN_ERROR }),
    );
  });
});
