import { PrintService, printService } from '../PrintService';
import { PrinterService } from '../PrinterService';
import { PrinterConnectionLock } from '../../connection/PrinterConnectionLock';
import type { PrinterRepository } from '../../storage/PrinterRepository';
import { CutterMode } from '../../models/paper/CutterMode';
import { PaperSize } from '../../models/paper/PaperSize';
import { PaperType } from '../../models/paper/PaperType';
import type { PaperOptions } from '../../models/paper/PaperOptions';
import { ConnectionType } from '../../models/connections/ConnectionType';
import { type Printer } from '../../models/printer/Printer';
import { PrintKind } from '../../models/printer/PrintKind';
import { PrintTaskStatus } from '../../models/printing/PrintTaskStatus';
import { PrintStatus } from '../../models/printing/PrintStatus';
import { makePrinter, makeEscPosLanguage, makeTsplLanguage } from '../../testing/printerFixtures';
import { makeMockConnectionService, mockOf } from '../../testing/printerServiceTestKit';
import { stripedPngBase64 } from '../../testing/encodeCases';
import { PrintErrorCode } from '../../errors';
import { PrintErrorException } from '../../exceptions';

const image = 'base64-png';

/** Hàm chụp giả: khổ giấy nào cũng ra cùng một ảnh. */
const render = (): Promise<string> => Promise.resolve(image);

const lanPrinter = (id: string, host: string, overrides: Partial<Printer> = {}): Printer =>
  makePrinter({
    id,
    connection: { type: ConnectionType.Lan, host, port: 9100 },
    deviceId: `lan:${host}:9100`,
    ...overrides,
  });

/** `print` giả: máy trong `failingIds` lỗi, máy khác in xong ngay. */
const makePrinterService = (failingIds: string[] = []): jest.Mocked<PrinterService> =>
  mockOf<jest.Mocked<PrinterService>>({
    print: jest.fn().mockImplementation(async (printerId: string) => {
      if (failingIds.includes(printerId)) {
        throw new PrintErrorException({ code: PrintErrorCode.UNKNOWN_ERROR, message: 'hết giấy' });
      }
    }),
  });

const makeService = (printers: Printer[], printing: PrinterService = makePrinterService()): PrintService =>
  new PrintService(mockOf<PrinterRepository>({ getPrinters: () => printers }), printing, new PrinterConnectionLock());

describe('PrintService.print', () => {
  it('returns no-available-printer with no tasks when no printer prints this kind', async () => {
    const printing = makePrinterService();
    const result = await makeService([], printing).print(PrintKind.Receipt, render);
    expect(result.status).toBe(PrintStatus.NoAvailablePrinter);
    expect(result.results).toEqual([]);
    expect(result.error?.code).toBe(PrintErrorCode.NO_AVAILABLE_PRINTER);
    expect(printing.print).not.toHaveBeenCalled();
  });

  it('tạo lệnh in mang thông tin máy và ảnh nguyên vẹn, in xong thì Success', async () => {
    const p1 = lanPrinter('p1', '1.1.1.1');
    const printing = makePrinterService();
    const result = await makeService([p1], printing).print(PrintKind.Receipt, render);
    expect(printing.print).toHaveBeenCalledWith('p1', image);
    expect(result.status).toBe(PrintStatus.Success);
    expect(result.results[0]).toMatchObject({
      task: {
        printerId: 'p1',
        printerName: p1.name,
        deviceId: p1.deviceId,
        connectionType: ConnectionType.Lan,
        kind: PrintKind.Receipt,
        data: image,
      },
      status: PrintTaskStatus.Success,
    });
    expect(result.results[0].startedAt).toBeDefined();
    expect(result.results[0].completedAt).toBeDefined();
  });

  it('máy lỗi thì lệnh Failed kèm exception, các máy khác vẫn in: PartialFailure', async () => {
    const printers = [lanPrinter('p1', '1.1.1.1'), lanPrinter('p2', '1.1.1.2')];
    const result = await makeService(printers, makePrinterService(['p2'])).print(PrintKind.Receipt, render);
    expect(result.status).toBe(PrintStatus.PartialFailure);
    expect(result.results.map((entry) => entry.status)).toEqual([PrintTaskStatus.Success, PrintTaskStatus.Failed]);
    expect(result.results[1].error).toMatchObject({ code: PrintErrorCode.UNKNOWN_ERROR, message: 'hết giấy' });
  });

  it('reports failed with no top-level error when every task fails', async () => {
    const service = makeService([lanPrinter('p1', '1.1.1.1')], makePrinterService(['p1']));
    const result = await service.print(PrintKind.Receipt, render);
    expect(result.status).toBe(PrintStatus.Failed);
    expect(result.error).toBeUndefined();
  });
});

describe('PrintService target selection', () => {
  const printedIds = async (printers: Printer[], kind: PrintKind): Promise<string[]> => {
    const printing = makePrinterService();
    await makeService(printers, printing).print(kind, render);
    return printing.print.mock.calls.map(([printerId]) => printerId);
  };

  it('bỏ qua máy in đang tắt', async () => {
    const printers = [lanPrinter('p1', '1.1.1.1', { enabled: false }), lanPrinter('p2', '1.1.1.2')];
    expect(await printedIds(printers, PrintKind.Receipt)).toEqual(['p2']);
  });

  it('chỉ chọn máy in nhận đúng loại nội dung', async () => {
    const printers = [
      lanPrinter('receipt-1', '1.1.1.1'),
      lanPrinter('label-1', '1.1.1.2', { kind: PrintKind.Label, language: makeTsplLanguage() }),
    ];
    expect(await printedIds(printers, PrintKind.Label)).toEqual(['label-1']);
    expect(await printedIds(printers, PrintKind.Receipt)).toEqual(['receipt-1']);
  });

  it('gửi tới mọi máy in nhận loại nội dung đó', async () => {
    const printers = [lanPrinter('p1', '1.1.1.1'), lanPrinter('p2', '1.1.1.2')];
    expect(await printedIds(printers, PrintKind.Receipt)).toEqual(['p1', 'p2']);
  });
});

describe('PrintService khoá theo máy vật lý', () => {
  /** Số lệnh `print` chạy cùng lúc nhiều nhất khi in tới `printers`. */
  const maxConcurrentPrints = async (printers: Printer[]): Promise<number> => {
    let inFlight = 0;
    let maxInFlight = 0;
    const printing = mockOf<PrinterService>({
      print: jest.fn().mockImplementation(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      }),
    });
    await makeService(printers, printing).print(PrintKind.Receipt, render);
    return maxInFlight;
  };

  it('hai máy in đã lưu trỏ cùng một máy vật lý thì in lần lượt', async () => {
    const printers = [lanPrinter('receipt-1', '1.1.1.1'), lanPrinter('receipt-2', '1.1.1.1')];
    expect(await maxConcurrentPrints(printers)).toBe(1);
  });

  it('máy vật lý khác nhau thì in song song', async () => {
    const printers = [lanPrinter('receipt-1', '1.1.1.1'), lanPrinter('receipt-2', '1.1.1.2')];
    expect(await maxConcurrentPrints(printers)).toBe(2);
  });

  it('lệnh in và nút "In thử" cùng máy dùng chung khoá nên chạy lần lượt', async () => {
    const order: string[] = [];
    let sendCount = 0;
    const connectionService = makeMockConnectionService({
      send: jest.fn().mockImplementation(async () => {
        sendCount += 1;
        const call = sendCount;
        order.push(`send-${call}-start`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push(`send-${call}-end`);
      }),
    });
    const lock = new PrinterConnectionLock();
    const printer = makePrinter({ id: 'receipt-1', language: makeEscPosLanguage() });
    const repository = mockOf<PrinterRepository>({ getPrinters: () => [printer], findById: () => printer });
    const printing = new PrinterService(connectionService, repository, lock);
    const service = new PrintService(repository, printing, lock);

    await Promise.all([
      service.print(PrintKind.Receipt, () => Promise.resolve(stripedPngBase64())),
      (async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        await printing.testPrint(printer, stripedPngBase64());
      })(),
    ]);

    expect(order).toEqual(['send-1-start', 'send-1-end', 'send-2-start', 'send-2-end']);
  });
});

describe('PrintService chụp theo khổ giấy', () => {
  const mm58 = { type: PaperType.Continuous, paperSize: PaperSize.Mm58, cutterMode: CutterMode.PerJob } as const;
  const mm80 = { type: PaperType.Continuous, paperSize: PaperSize.Mm80, cutterMode: CutterMode.PerJob } as const;

  /** Hàm chụp giả: ảnh mang khổ giấy để biết máy nào nhận ảnh nào. */
  const renderByPaper = jest.fn((paper: PaperOptions) => Promise.resolve(`png-${paper.paperSize}`));

  beforeEach(() => renderByPaper.mockClear());

  it('không có máy nào nhận loại nội dung → không chụp', async () => {
    await makeService([]).print(PrintKind.Receipt, renderByPaper);
    expect(renderByPaper).not.toHaveBeenCalled();
  });

  it('máy cùng giấy chụp một lần, khác giấy chụp riêng; mỗi máy nhận ảnh đúng giấy của nó', async () => {
    const printers = [
      lanPrinter('a', '1.1.1.1', { paper: mm58 }),
      lanPrinter('b', '1.1.1.2', { paper: mm80 }),
      lanPrinter('c', '1.1.1.3', { paper: mm58 }),
    ];
    const printing = makePrinterService();

    await makeService(printers, printing).print(PrintKind.Receipt, renderByPaper);

    expect(renderByPaper.mock.calls.map(([paper]) => paper.paperSize)).toEqual([PaperSize.Mm58, PaperSize.Mm80]);
    expect(printing.print.mock.calls).toEqual([
      ['a', 'png-58'],
      ['b', 'png-80'],
      ['c', 'png-58'],
    ]);
  });

  it('chụp hỏng → Failed với INVALID_IMAGE, không gửi gì', async () => {
    const printing = makePrinterService();
    const result = await makeService([lanPrinter('a', '1.1.1.1')], printing).print(PrintKind.Receipt, () =>
      Promise.resolve(null),
    );
    expect(result.status).toBe(PrintStatus.Failed);
    expect(result.error?.code).toBe(PrintErrorCode.INVALID_IMAGE);
    expect(printing.print).not.toHaveBeenCalled();
  });

  it('hàm chụp ném lỗi → Failed, print không reject', async () => {
    const result = await makeService([lanPrinter('a', '1.1.1.1')]).print(PrintKind.Receipt, () =>
      Promise.reject(new Error('view chưa mount')),
    );
    expect(result.status).toBe(PrintStatus.Failed);
  });

  it('singleton printService mặc định chưa có máy in nào → NoAvailablePrinter', async () => {
    expect((await printService.print(PrintKind.Receipt, renderByPaper)).status).toBe(PrintStatus.NoAvailablePrinter);
  });
});
