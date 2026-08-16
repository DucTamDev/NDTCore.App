import { createPrintScheduler } from '../PrintScheduler';
import { createPrinterService } from '../PrinterService';
import { createResourceLock } from '../PrinterConnectionLock';
import { AppErrorException } from '../../../../types/AppError';
import type { IPrinterDriver } from '../../types/driver.types';
import type { PrintJob } from '../../types/printJob.types';
import type { PrinterConfig } from '../../types/printer.types';

const makeJob = (overrides: Partial<PrintJob> = {}): PrintJob => ({
  id: 'job1',
  requestId: 'req1',
  printerId: 'p1',
  document: { elements: [] },
  status: 'pending',
  retryCount: 0,
  createdAt: new Date().toISOString(),
  ...overrides,
});

const makePrinterConfig = (overrides: Partial<PrinterConfig> = {}): PrinterConfig => ({
  id: 'p1',
  printerName: 'Máy in',
  protocol: 'escpos',
  protocolSource: 'auto',
  connectionType: 'lan',
  paperSize: '80mm',
  autoReconnect: false,
  isDefault: false,
  ...overrides,
});

describe('PrintScheduler', () => {
  it('enqueue() resolves with status success when PrinterService.print resolves', async () => {
    const printerService = { print: jest.fn().mockResolvedValue(undefined), getPrinters: jest.fn().mockReturnValue([]) };
    const scheduler = createPrintScheduler(printerService, createResourceLock());
    const result = await scheduler.enqueue(makeJob());
    expect(result.status).toBe('success');
    expect(result.completedAt).toBeDefined();
  });

  it('enqueue() resolves with status failed and an AppError when PrinterService.print rejects', async () => {
    const printerService = {
      print: jest.fn().mockRejectedValue(new AppErrorException({ code: 'PRINT_ERROR', message: 'hết giấy' })),
      getPrinters: jest.fn().mockReturnValue([]),
    };
    const scheduler = createPrintScheduler(printerService, createResourceLock());
    const result = await scheduler.enqueue(makeJob());
    expect(result.status).toBe('failed');
    expect(result.error).toEqual({ code: 'PRINT_ERROR', message: 'hết giấy' });
  });

  it('never runs two jobs for the same printerId concurrently', async () => {
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

  it('retry() increments retryCount and re-enqueues the same job id', async () => {
    const printerService = { print: jest.fn().mockResolvedValue(undefined), getPrinters: jest.fn().mockReturnValue([]) };
    const scheduler = createPrintScheduler(printerService, createResourceLock());
    const failed = makeJob({ status: 'failed', retryCount: 0 });
    const result = await scheduler.retry(failed);
    expect(result.id).toBe(failed.id);
    expect(result.retryCount).toBe(1);
    expect(result.status).toBe('success');
  });

  it('serializes jobs for different printerIds that share the same protocol+connectionType', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const printers = [
      makePrinterConfig({ id: 'receipt-1', protocol: 'escpos', connectionType: 'lan' }),
      makePrinterConfig({ id: 'receipt-2', protocol: 'escpos', connectionType: 'lan' }),
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
    // Hai printerId khác nhau nhưng cùng protocol+connectionType — mô phỏng 2
    // máy in escpos dùng chung 1 kết nối native (giới hạn của thư viện
    // ThermalReceiptDriver). Phải in tuần tự, không được chạy song song.
    await Promise.all([
      scheduler.enqueue(makeJob({ id: 'a', printerId: 'receipt-1' })),
      scheduler.enqueue(makeJob({ id: 'b', printerId: 'receipt-2' })),
    ]);
    expect(maxInFlight).toBe(1);
  });

  it('still runs jobs in parallel for different protocol+connectionType combos', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const printers = [
      makePrinterConfig({ id: 'receipt-lan', protocol: 'escpos', connectionType: 'lan' }),
      makePrinterConfig({ id: 'label-bt', protocol: 'tspl', connectionType: 'bluetooth' }),
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
      scheduler.enqueue(makeJob({ id: 'a', printerId: 'receipt-lan' })),
      scheduler.enqueue(makeJob({ id: 'b', printerId: 'label-bt' })),
    ]);
    // Không dùng chung tài nguyên kết nối — không có lý do gì để tuần tự hoá.
    expect(maxInFlight).toBe(2);
  });

  it('serializes a scheduled print() job against a manual PrinterService.testPrint() call sharing the same lock', async () => {
    const order: string[] = [];
    const escposDriver: IPrinterDriver = {
      scan: jest.fn().mockReturnValue(() => undefined),
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockReturnValue('connected'),
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
    // và PrinterService.testPrint() (nút "In thử" thủ công), lý do sửa lỗi
    // multi-printer race lần trước không đủ (chỉ khoá được PrintScheduler).
    const lock = createResourceLock();
    const printerService = createPrinterService({ escpos: escposDriver, tspl: escposDriver }, lock);
    const config: PrinterConfig = makePrinterConfig({ id: 'receipt-1', protocol: 'escpos', connectionType: 'lan' });
    printerService.addPrinter(config);
    const scheduler = createPrintScheduler(printerService, lock);

    await Promise.all([
      scheduler.enqueue(makeJob({ id: 'order-job', printerId: config.id })),
      (async () => {
        // Bấm "In thử" ngay sau khi đơn hàng bắt đầu in — phải đợi đơn hàng
        // in xong mới tới lượt, không được xen vào giữa.
        await new Promise((resolve) => setTimeout(resolve, 1));
        await printerService.testPrint(config);
      })(),
    ]);

    expect(order).toEqual(['print-start', 'print-end', 'testPrint-start', 'testPrint-end']);
  });
});
