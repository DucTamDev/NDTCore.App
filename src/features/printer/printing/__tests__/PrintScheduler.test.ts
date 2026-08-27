import { createPrintScheduler } from '../PrintScheduler';
import { createPrinterService } from '../PrinterService';
import { createResourceLock } from '../PrinterConnectionLock';
import { AppErrorException, AppErrorCode } from '../../types/AppError';
import type { IPrinterDriver } from '../../types/driver.types';
import { ConnectionType, DriverSource, PrinterDriverType, PrinterStatus, TsplRenderMode, type Printer, type PrinterDriver } from '../../types/printer.types';
import { PrintJobStatus, type PrintJob } from '../../types/printJob.types';
import { PrintType } from '../../types/printConfiguration.types';

const escposDriver: PrinterDriver = { type: PrinterDriverType.escpos, source: DriverSource.auto, contentTypes: [PrintType.Receipt], config: { type: PrinterDriverType.escpos } };
const tsplDriver: PrinterDriver = { type: PrinterDriverType.tspl, source: DriverSource.auto, contentTypes: [PrintType.Label], config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap } };

const makeJob = (overrides: Partial<PrintJob> = {}): PrintJob => ({
  id: 'job1', requestId: 'req1', printerId: 'p1', printType: PrintType.Receipt,
  documentVariants: { text: { elements: [] } }, status: PrintJobStatus.pending, retryCount: 0, createdAt: new Date().toISOString(),
  ...overrides,
});

const makePrinter = (overrides: Partial<Printer> = {}): Printer => ({
  id: 'p1', name: 'Máy in', drivers: [escposDriver], connectionType: ConnectionType.lan, lan: { ip: '1.1.1.1', port: 9100 },
  identityKey: 'lan:1.1.1.1:9100', paperSize: 80, autoReconnect: false, enabled: true, createdAt: 'x', updatedAt: 'x',
  ...overrides,
});

describe('PrintScheduler', () => {
  it('enqueue() resolves with status success when PrinterService.print resolves', async () => {
    const printerService = { print: jest.fn().mockResolvedValue(undefined), getPrinters: jest.fn().mockReturnValue([]) };
    const scheduler = createPrintScheduler(printerService, createResourceLock());
    const result = await scheduler.enqueue(makeJob());
    expect(result.status).toBe(PrintJobStatus.success);
    expect(result.completedAt).toBeDefined();
  });

  it('enqueue() resolves with status failed and an AppError when PrinterService.print rejects', async () => {
    const printerService = {
      print: jest.fn().mockRejectedValue(new AppErrorException({ code: AppErrorCode.PRINT_ERROR, message: 'hết giấy' })),
      getPrinters: jest.fn().mockReturnValue([]),
    };
    const scheduler = createPrintScheduler(printerService, createResourceLock());
    const result = await scheduler.enqueue(makeJob());
    expect(result.status).toBe(PrintJobStatus.failed);
    expect(result.error).toEqual({ code: AppErrorCode.PRINT_ERROR, message: 'hết giấy' });
  });

  it('retry() increments retryCount and re-enqueues the same job id', async () => {
    const printerService = { print: jest.fn().mockResolvedValue(undefined), getPrinters: jest.fn().mockReturnValue([]) };
    const scheduler = createPrintScheduler(printerService, createResourceLock());
    const result = await scheduler.retry(makeJob({ status: PrintJobStatus.failed, retryCount: 0 }));
    expect(result.retryCount).toBe(1);
    expect(result.status).toBe(PrintJobStatus.success);
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
      makePrinter({ id: 'label-1', drivers: [tsplDriver], lan: { ip: '1.1.1.1', port: 9100 } }),
      makePrinter({ id: 'label-2', drivers: [tsplDriver], lan: { ip: '1.1.1.2', port: 9100 } }),
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
      makePrinter({ id: 'receipt-lan', drivers: [escposDriver], connectionType: ConnectionType.lan, lan: { ip: '1.1.1.1', port: 9100 } }),
      makePrinter({
        id: 'label-bt', drivers: [tsplDriver], connectionType: ConnectionType.bluetooth, lan: undefined,
        device: { deviceId: 'd1', displayName: 'Label BT', rawDevice: {} },
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

  it('serializes a scheduled print() job against a manual PrinterService.testPrint() call sharing the same lock', async () => {
    const order: string[] = [];
    const escposIPrinterDriver: IPrinterDriver = {
      scan: jest.fn().mockReturnValue(() => undefined),
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockReturnValue(PrinterStatus.connected),
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
      encode: jest.fn().mockReturnValue(new Uint8Array()),
    };
    // Chung 1 lock — đây chính là cầu nối giữa PrintScheduler (đơn hàng thật)
    // và PrinterService.testPrint() (nút "In thử" thủ công), lý do sửa lỗi
    // multi-printer race lần trước không đủ (chỉ khoá được PrintScheduler).
    const lock = createResourceLock();
    const printerService = createPrinterService({ escpos: escposIPrinterDriver, tspl: escposIPrinterDriver }, lock);
    const printer: Printer = makePrinter({ id: 'receipt-1' });
    printerService.addPrinter(printer);
    const scheduler = createPrintScheduler(printerService, lock);

    await Promise.all([
      scheduler.enqueue(makeJob({ id: 'order-job', printerId: printer.id })),
      (async () => {
        // Bấm "In thử" ngay sau khi đơn hàng bắt đầu in — phải đợi đơn hàng
        // in xong mới tới lượt, không được xen vào giữa.
        await new Promise((resolve) => setTimeout(resolve, 1));
        await printerService.testPrint(printer, escposDriver, { text: { elements: [] } });
      })(),
    ]);

    expect(order).toEqual(['print-start', 'print-end', 'testPrint-start', 'testPrint-end']);
  });
});
