import { createPrintScheduler } from '../PrintScheduler';
import { createPrinterPrintService } from '../PrinterPrintService';
import { createPrinterRepository } from '../../storage/PrinterRepository';
import { createResourceLock } from '../../connection/PrinterConnectionLock';
import { PrinterErrorException, PrinterErrorCode } from '../../errors/PrinterError';
import type { IPrinterDriver } from '../../drivers/IPrinterDriver';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import { PrinterDriverType } from '../../models/printer/PrinterDriver';
import { PrinterStatus } from '../../models/printer/PrinterStatus';
import { type Printer } from '../../models/printer/Printer';
import { PrintJobStatus, type PrintJob } from '../../models/printing/PrintJob';
import { PrintType } from '../../models/printing/PrintType';
import { makePrinter as makePrinterFixture, makeEscPosDriver, makeTsplDriver } from '../../testing/printerFixtures';

const escposDriver = makeEscPosDriver();
const tsplDriver = makeTsplDriver();

const makeJob = (overrides: Partial<PrintJob> = {}): PrintJob => ({
  id: 'job1', requestId: 'req1', printerId: 'p1', printType: PrintType.Receipt,
  documents: { text: { elements: [] } }, status: PrintJobStatus.Pending, retryCount: 0, createdAt: new Date().toISOString(),
  ...overrides,
});

const makePrinter = (overrides: Partial<Printer> = {}): Printer =>
  makePrinterFixture({
    name: 'Máy in', connection: { type: PrinterConnectionType.Lan, host: '1.1.1.1', port: 9100 }, identityKey: 'lan:1.1.1.1:9100', createdAt: 'x', updatedAt: 'x',
    ...overrides,
  });

describe('PrintScheduler', () => {
  it('enqueue() resolves with status success when PrinterPrintService.print resolves', async () => {
    const printerService = { print: jest.fn().mockResolvedValue(undefined), getPrinters: jest.fn().mockReturnValue([]) };
    const scheduler = createPrintScheduler(printerService, createResourceLock());
    const result = await scheduler.enqueue(makeJob());
    expect(result.status).toBe(PrintJobStatus.Success);
    expect(result.completedAt).toBeDefined();
  });

  it('enqueue() resolves with status failed and an PrinterError when PrinterPrintService.print rejects', async () => {
    const printerService = {
      print: jest.fn().mockRejectedValue(new PrinterErrorException({ code: PrinterErrorCode.UNKNOWN_ERROR, message: 'hết giấy' })),
      getPrinters: jest.fn().mockReturnValue([]),
    };
    const scheduler = createPrintScheduler(printerService, createResourceLock());
    const result = await scheduler.enqueue(makeJob());
    expect(result.status).toBe(PrintJobStatus.Failed);
    expect(result.error).toEqual({ code: PrinterErrorCode.UNKNOWN_ERROR, message: 'hết giấy' });
  });

  it('retry() increments retryCount and re-enqueues the same job id', async () => {
    const printerService = { print: jest.fn().mockResolvedValue(undefined), getPrinters: jest.fn().mockReturnValue([]) };
    const scheduler = createPrintScheduler(printerService, createResourceLock());
    const result = await scheduler.retry(makeJob({ status: PrintJobStatus.Failed, retryCount: 0 }));
    expect(result.retryCount).toBe(1);
    expect(result.status).toBe(PrintJobStatus.Success);
  });

  it('never runs two jobs for the same printerId concurrently when the printer is not found in getPrinters (resourceKeyFor falls back to printerId)', async () => {
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
    const scheduler = createPrintScheduler(printerService, createResourceLock());
    await Promise.all([
      scheduler.enqueue(makeJob({ id: 'a' })),
      scheduler.enqueue(makeJob({ id: 'b' })),
      scheduler.enqueue(makeJob({ id: 'c' })),
    ]);
    expect(maxInFlight).toBe(1);
  });

  it('serializes jobs for different printers that share the same resource key (escpos:lan, vendor library singleton)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const printers = [makePrinter({ id: 'receipt-1' }), makePrinter({ id: 'receipt-2' })];
    const printerService = {
      print: jest.fn().mockImplementation(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      }),
      getPrinters: jest.fn().mockReturnValue(printers),
    };
    const scheduler = createPrintScheduler(printerService, createResourceLock());
    await Promise.all([
      scheduler.enqueue(makeJob({ id: 'a', printerId: 'receipt-1' })),
      scheduler.enqueue(makeJob({ id: 'b', printerId: 'receipt-2' })),
    ]);
    expect(maxInFlight).toBe(1);
  });

  it('runs jobs in parallel for tspl printers on different LAN hosts (per-connection resource key)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const printers = [
      makePrinter({ id: 'label-1', type: PrintType.Label, driver: tsplDriver, connection: { type: PrinterConnectionType.Lan, host: '1.1.1.1', port: 9100 } }),
      makePrinter({ id: 'label-2', type: PrintType.Label, driver: tsplDriver, connection: { type: PrinterConnectionType.Lan, host: '1.1.1.2', port: 9100 } }),
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
    const scheduler = createPrintScheduler(printerService, createResourceLock());
    await Promise.all([
      scheduler.enqueue(makeJob({ id: 'a', printerId: 'label-1', printType: PrintType.Label })),
      scheduler.enqueue(makeJob({ id: 'b', printerId: 'label-2', printType: PrintType.Label })),
    ]);
    expect(maxInFlight).toBe(2);
  });

  it('runs jobs in parallel for different driver+connectionType combos (escpos:lan vs tspl:bluetooth)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const printers = [
      makePrinter({ id: 'receipt-lan', type: PrintType.Receipt, driver: escposDriver, connection: { type: PrinterConnectionType.Lan, host: '1.1.1.1', port: 9100 } }),
      makePrinter({
        id: 'label-bt', type: PrintType.Label, driver: tsplDriver,
        connection: { type: PrinterConnectionType.Bluetooth, deviceId: 'd1' },
      }),
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
    const scheduler = createPrintScheduler(printerService, createResourceLock());
    await Promise.all([
      scheduler.enqueue(makeJob({ id: 'a', printerId: 'receipt-lan', printType: PrintType.Receipt })),
      scheduler.enqueue(makeJob({ id: 'b', printerId: 'label-bt', printType: PrintType.Label })),
    ]);
    expect(maxInFlight).toBe(2);
  });

  it('serializes a scheduled print() job against a manual PrinterPrintService.testPrint() call sharing the same lock', async () => {
    const order: string[] = [];
    const escposIPrinterDriver: IPrinterDriver = {
      scan: jest.fn().mockReturnValue(() => undefined),
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockReturnValue(PrinterStatus.Connected),
      onStatusChange: jest.fn().mockReturnValue(() => undefined),
      testPrint: jest.fn().mockImplementation(async () => {
        order.push('testPrint-start');
        order.push('testPrint-end');
      }),
      print: jest.fn().mockImplementation(async () => {
        order.push('print-start');
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push('print-end');
      }),
      identify: jest.fn().mockResolvedValue(null),
    };
    // Chung 1 lock — đây chính là cầu nối giữa PrintScheduler (đơn hàng thật)
    // và PrinterPrintService.testPrint() (nút "In thử" thủ công), lý do sửa lỗi
    // multi-printer race lần trước không đủ (chỉ khoá được PrintScheduler).
    const lock = createResourceLock();
    const repository = createPrinterRepository();
    const printerService = createPrinterPrintService(
      { [PrinterDriverType.EscPos]: escposIPrinterDriver, [PrinterDriverType.Tspl]: escposIPrinterDriver },
      repository,
      lock,
    );
    const printer: Printer = makePrinter({ id: 'receipt-1' });
    repository.addPrinter(printer);
    const scheduler = createPrintScheduler({ print: printerService.print, getPrinters: repository.getPrinters }, lock);

    await Promise.all([
      scheduler.enqueue(makeJob({ id: 'order-job', printerId: printer.id })),
      (async () => {
        // Bấm "In thử" ngay sau khi đơn hàng bắt đầu in — phải đợi đơn hàng
        // in xong mới tới lượt, không được xen vào giữa.
        await new Promise((resolve) => setTimeout(resolve, 1));
        await printerService.testPrint(printer, { text: { elements: [] } });
      })(),
    ]);

    expect(order).toEqual(['print-start', 'print-end', 'testPrint-start', 'testPrint-end']);
  });
});
