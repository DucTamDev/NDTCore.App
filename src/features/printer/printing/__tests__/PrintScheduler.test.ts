import { PrintScheduler } from '../PrintScheduler';
import { PrinterPrintService } from '../PrinterPrintService';
import { PrinterRepository } from '../../storage/PrinterRepository';
import { ResourceLock } from '../../connection/PrinterConnectionLock';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { type Printer } from '../../models/printer/Printer';
import { PrintTaskStatus } from '../../models/printing/PrintTaskStatus';
import type { PrintTask } from '../../models/printing/PrintTask';
import { PrintKind } from '../../models/printer/PrintKind';
import { makePrinter as makePrinterFixture } from '../../testing/printerFixtures';
import { makeMockConnectionService, mockOf } from '../../testing/printerServiceTestKit';
import { stripedPngBase64 } from '../../testing/encodeCases';
import { PrintErrorCode } from '../../errors';
import { PrintErrorException } from '../../exceptions';

const makeTask = (overrides: Partial<PrintTask> = {}): PrintTask => ({
  id: 'job1', requestId: 'req1', printerId: 'p1', printerName: 'Máy in', deviceId: 'lan:1.1.1.1:9100',
  connectionType: ConnectionType.Lan, kind: PrintKind.Receipt,
  data: stripedPngBase64(), status: PrintTaskStatus.Pending, retryCount: 0, createdAt: new Date().toISOString(),
  ...overrides,
});

const makePrinter = (overrides: Partial<Printer> = {}): Printer =>
  makePrinterFixture({
    name: 'Máy in', connection: { type: ConnectionType.Lan, host: '1.1.1.1', port: 9100 }, deviceId: 'lan:1.1.1.1:9100', createdAt: 'x', updatedAt: 'x',
    ...overrides,
  });

const makeScheduler = (printing: Partial<PrinterPrintService>): PrintScheduler =>
  new PrintScheduler({ printing: mockOf<PrinterPrintService>(printing), lock: new ResourceLock() });

describe('PrintScheduler', () => {
  it('enqueue() resolves with status success when printerPrintService.print resolves', async () => {
    const printerService = { print: jest.fn().mockResolvedValue(undefined) };
    const scheduler = makeScheduler(printerService);
    const result = await scheduler.enqueue(makeTask());
    expect(result.status).toBe(PrintTaskStatus.Success);
    expect(result.completedAt).toBeDefined();
  });

  it('enqueue() resolves with status failed and the exception when printerPrintService.print rejects', async () => {
    const printerService = {
      print: jest
        .fn()
        .mockRejectedValue(new PrintErrorException({ code: PrintErrorCode.UNKNOWN_ERROR, message: 'hết giấy' })),
    };
    const scheduler = makeScheduler(printerService);
    const result = await scheduler.enqueue(makeTask());
    expect(result.status).toBe(PrintTaskStatus.Failed);
    expect(result.error).toMatchObject({ code: PrintErrorCode.UNKNOWN_ERROR, message: 'hết giấy' });
  });

  it('retry() increments retryCount and re-enqueues the same task id', async () => {
    const printerService = { print: jest.fn().mockResolvedValue(undefined) };
    const scheduler = makeScheduler(printerService);
    const result = await scheduler.retry(makeTask({ status: PrintTaskStatus.Failed, retryCount: 0 }));
    expect(result.retryCount).toBe(1);
    expect(result.status).toBe(PrintTaskStatus.Success);
  });

  it('các lệnh in cùng deviceId không bao giờ chạy song song', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const scheduler = makeScheduler({ print: jest.fn().mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    }) });
    await Promise.all([
      scheduler.enqueue(makeTask({ id: 'a' })),
      scheduler.enqueue(makeTask({ id: 'b' })),
      scheduler.enqueue(makeTask({ id: 'c' })),
    ]);
    expect(maxInFlight).toBe(1);
  });

  it('hai máy in đã lưu trỏ cùng một máy vật lý thì in lần lượt, dù khác loại nội dung', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const scheduler = makeScheduler({ print: jest.fn().mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    }) });
    await Promise.all([
      scheduler.enqueue(makeTask({ id: 'a', printerId: 'receipt-1' })),
      scheduler.enqueue(makeTask({ id: 'b', printerId: 'label-1', kind: PrintKind.Label })),
    ]);
    expect(maxInFlight).toBe(1);
  });

  it('máy vật lý khác nhau thì in song song', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const scheduler = makeScheduler({ print: jest.fn().mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    }) });
    await Promise.all([
      scheduler.enqueue(makeTask({ id: 'a', printerId: 'receipt-1', deviceId: 'lan:1.1.1.1:9100' })),
      scheduler.enqueue(makeTask({ id: 'b', printerId: 'receipt-2', deviceId: 'lan:1.1.1.2:9100' })),
    ]);
    expect(maxInFlight).toBe(2);
  });

  it('task trong hàng đợi và nút "In thử" cùng máy dùng chung khoá nên chạy lần lượt', async () => {
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
    const scheduler = new PrintScheduler({ printing: printerService, lock });

    await Promise.all([
      scheduler.enqueue(makeTask({ id: 'order-task', printerId: printer.id, deviceId: printer.deviceId })),
      (async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        await printerService.testPrint(printer, stripedPngBase64());
      })(),
    ]);

    expect(order).toEqual(['send-1-start', 'send-1-end', 'send-2-start', 'send-2-end']);
  });
});
