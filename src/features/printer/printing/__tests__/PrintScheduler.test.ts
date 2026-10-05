import { PrintScheduler } from '../PrintScheduler';
import { PrinterPrintService } from '../PrinterPrintService';
import { PrinterRepository } from '../../storage/PrinterRepository';
import { ResourceLock } from '../../connection/PrinterConnectionLock';
import { PrinterErrorException, PrinterErrorCode } from '../../errors/PrinterError';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { type Printer } from '../../models/printer/Printer';
import { PrintJobStatus, type PrintJob } from '../../models/printing/PrintJob';
import { PrintKind } from '../../models/printer/PrintKind';
import { makePrinter as makePrinterFixture, makeTsplLanguage } from '../../testing/printerFixtures';
import { makeMockConnectionService } from '../../testing/printerServiceTestKit';

const tsplLanguage = makeTsplLanguage();

const makeJob = (overrides: Partial<PrintJob> = {}): PrintJob => ({
  id: 'job1', requestId: 'req1', printerId: 'p1', kind: PrintKind.Receipt,
  documents: { text: { elements: [] } }, status: PrintJobStatus.Pending, retryCount: 0, createdAt: new Date().toISOString(),
  ...overrides,
});

const makePrinter = (overrides: Partial<Printer> = {}): Printer =>
  makePrinterFixture({
    name: 'Máy in', connection: { type: ConnectionType.Lan, host: '1.1.1.1', port: 9100 }, deviceId: 'lan:1.1.1.1:9100', createdAt: 'x', updatedAt: 'x',
    ...overrides,
  });

/** Printer service giả vừa in vừa trả danh sách máy in. */
type FakePrinterService = { print: jest.Mock; getPrinters: jest.Mock };

const makeScheduler = (printerService: FakePrinterService): PrintScheduler =>
  new PrintScheduler({ printing: printerService, repository: printerService, lock: new ResourceLock() });

describe('PrintScheduler', () => {
  it('enqueue() resolves with status success when printerPrintService.print resolves', async () => {
    const printerService = { print: jest.fn().mockResolvedValue(undefined), getPrinters: jest.fn().mockReturnValue([]) };
    const scheduler = makeScheduler(printerService);
    const result = await scheduler.enqueue(makeJob());
    expect(result.status).toBe(PrintJobStatus.Success);
    expect(result.completedAt).toBeDefined();
  });

  it('enqueue() resolves with status failed and an PrinterError when printerPrintService.print rejects', async () => {
    const printerService = {
      print: jest.fn().mockRejectedValue(new PrinterErrorException({ code: PrinterErrorCode.UNKNOWN_ERROR, message: 'hết giấy' })),
      getPrinters: jest.fn().mockReturnValue([]),
    };
    const scheduler = makeScheduler(printerService);
    const result = await scheduler.enqueue(makeJob());
    expect(result.status).toBe(PrintJobStatus.Failed);
    expect(result.error).toEqual({ code: PrinterErrorCode.UNKNOWN_ERROR, message: 'hết giấy' });
  });

  it('retry() increments retryCount and re-enqueues the same job id', async () => {
    const printerService = { print: jest.fn().mockResolvedValue(undefined), getPrinters: jest.fn().mockReturnValue([]) };
    const scheduler = makeScheduler(printerService);
    const result = await scheduler.retry(makeJob({ status: PrintJobStatus.Failed, retryCount: 0 }));
    expect(result.retryCount).toBe(1);
    expect(result.status).toBe(PrintJobStatus.Success);
  });

  it('never runs two jobs for the same printerId concurrently when the printer is not found in getPrinters (lock key falls back to printerId)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const printerService = {
      print: jest.fn().mockImplementation(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      }),
      getPrinters: jest.fn().mockReturnValue([]),
    };
    const scheduler = makeScheduler(printerService);
    await Promise.all([
      scheduler.enqueue(makeJob({ id: 'a' })),
      scheduler.enqueue(makeJob({ id: 'b' })),
      scheduler.enqueue(makeJob({ id: 'c' })),
    ]);
    expect(maxInFlight).toBe(1);
  });

  it('hai máy in đã lưu trỏ cùng một máy vật lý thì in lần lượt, dù khác ngôn ngữ', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const printers = [
      makePrinter({ id: 'receipt-1' }),
      makePrinter({ id: 'label-1', kind: PrintKind.Label, language: tsplLanguage }),
    ];
    const printerService = {
      print: jest.fn().mockImplementation(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      }),
      getPrinters: jest.fn().mockReturnValue(printers),
    };
    const scheduler = makeScheduler(printerService);
    await Promise.all([
      scheduler.enqueue(makeJob({ id: 'a', printerId: 'receipt-1' })),
      scheduler.enqueue(makeJob({ id: 'b', printerId: 'label-1', kind: PrintKind.Label })),
    ]);
    expect(maxInFlight).toBe(1);
  });

  it('máy vật lý khác nhau cùng loại kết nối thì in song song', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const printers = [
      makePrinter({ id: 'receipt-1', connection: { type: ConnectionType.Lan, host: '1.1.1.1', port: 9100 } }),
      makePrinter({ id: 'receipt-2', connection: { type: ConnectionType.Lan, host: '1.1.1.2', port: 9100 } }),
    ];
    const printerService = {
      print: jest.fn().mockImplementation(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      }),
      getPrinters: jest.fn().mockReturnValue(printers),
    };
    const scheduler = makeScheduler(printerService);
    await Promise.all([
      scheduler.enqueue(makeJob({ id: 'a', printerId: 'receipt-1' })),
      scheduler.enqueue(makeJob({ id: 'b', printerId: 'receipt-2' })),
    ]);
    expect(maxInFlight).toBe(2);
  });

  it('job trong hàng đợi và nút "In thử" cùng máy dùng chung khoá nên chạy lần lượt', async () => {
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
    const lock = new ResourceLock();
    const repository = new PrinterRepository();
    const printerService = new PrinterPrintService(connectionService, repository, lock);
    const printer: Printer = makePrinter({ id: 'receipt-1' });
    repository.addPrinter(printer);
    const scheduler = new PrintScheduler({ printing: printerService, repository, lock });

    await Promise.all([
      scheduler.enqueue(makeJob({ id: 'order-job', printerId: printer.id })),
      (async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        await printerService.testPrint(printer, { text: { elements: [] } });
      })(),
    ]);

    expect(order).toEqual(['send-1-start', 'send-1-end', 'send-2-start', 'send-2-end']);
  });
});
