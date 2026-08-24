import { createPrintService, PrintService } from '../PrintService';
import type { PrinterConfig } from '../../types/printer.types';
import type { PrintJob } from '../../types/printJob.types';

const textDocument = { elements: [{ type: 'text' as const, content: 'text-doc', x: 0, y: 0 }] };
const imageDocument = { elements: [{ type: 'image' as const, data: 'base64...', x: 0, y: 0 }] };

const printer = (id: string, overrides: Partial<PrinterConfig> = {}): PrinterConfig => ({
  id, printerName: id, protocol: 'escpos', protocolSource: 'auto', connectionType: 'lan',
  paperSize: '80mm', autoReconnect: false, isDefault: false, enabled: true, printsReceipt: true,
  ...overrides,
});

const makeDeps = (printers: PrinterConfig[], scheduleResult: (printerId: string) => PrintJob) => ({
  getPrinters: jest.fn().mockReturnValue(printers),
  scheduler: { enqueue: jest.fn().mockImplementation((job: PrintJob) => Promise.resolve(scheduleResult(job.printerId))) },
});

describe('PrintService.print', () => {
  it('returns no-available-printer with no jobs and a NO_AVAILABLE_PRINTER error when nothing is configured', async () => {
    const deps = makeDeps([], () => { throw new Error('should not be called'); });
    const service = createPrintService(deps);
    const result = await service.print('Receipt', { text: textDocument });
    expect(result.status).toBe('no-available-printer');
    expect(result.jobs).toEqual([]);
    expect(result.error?.code).toBe('NO_AVAILABLE_PRINTER');
    expect(deps.scheduler.enqueue).not.toHaveBeenCalled();
  });

  it('excludes a printer that is disabled even if it prints Receipt', async () => {
    const deps = makeDeps([printer('p1', { enabled: false })], () => { throw new Error('should not be called'); });
    const service = createPrintService(deps);
    const result = await service.print('Receipt', { text: textDocument });
    expect(result.status).toBe('no-available-printer');
  });

  it('excludes a printer that does not have printsReceipt on for a Receipt print', async () => {
    const deps = makeDeps([printer('p1', { printsReceipt: false })], () => { throw new Error('should not be called'); });
    const service = createPrintService(deps);
    const result = await service.print('Receipt', { text: textDocument });
    expect(result.status).toBe('no-available-printer');
  });

  it('routes by printsLabel (not printsReceipt) for a Label print', async () => {
    const deps = makeDeps(
      [printer('p1', { printsReceipt: true, printsLabel: false }), printer('p2', { printsReceipt: false, printsLabel: true })],
      (printerId) => ({ id: 'job1', requestId: 'req1', printerId, printType: 'Label', document: textDocument, status: 'success', retryCount: 0, createdAt: 'now' }),
    );
    const service = createPrintService(deps);
    const result = await service.print('Label', { text: textDocument });
    expect(result.status).toBe('success');
    expect(deps.scheduler.enqueue).toHaveBeenCalledTimes(1);
    expect(deps.scheduler.enqueue).toHaveBeenCalledWith(expect.objectContaining({ printerId: 'p2' }));
  });

  it('sends to every printer with printsReceipt on and reports success when all succeed', async () => {
    const deps = makeDeps([printer('p1'), printer('p2')], (printerId) => ({
      id: 'job1', requestId: 'req1', printerId, printType: 'Receipt', document: textDocument, status: 'success', retryCount: 0, createdAt: 'now',
    }));
    const service = createPrintService(deps);
    const result = await service.print('Receipt', { text: textDocument });
    expect(result.status).toBe('success');
    expect(deps.scheduler.enqueue).toHaveBeenCalledTimes(2);
  });

  it('reports partial-failure on mixed results', async () => {
    const deps = makeDeps([printer('p1'), printer('p2')], (printerId) => ({
      id: 'job1', requestId: 'req1', printerId, printType: 'Receipt', document: textDocument,
      status: printerId === 'p1' ? 'success' : 'failed', retryCount: 0, createdAt: 'now',
    }));
    const service = createPrintService(deps);
    const result = await service.print('Receipt', { text: textDocument });
    expect(result.status).toBe('partial-failure');
  });

  it('reports failed with no top-level error when all configured printers fail', async () => {
    const deps = makeDeps([printer('p1'), printer('p2')], (printerId) => ({
      id: 'job1', requestId: 'req1', printerId, printType: 'Receipt', document: textDocument, status: 'failed', retryCount: 0, createdAt: 'now',
      error: { code: 'PRINT_ERROR', message: 'x' },
    }));
    const service = createPrintService(deps);
    const result = await service.print('Receipt', { text: textDocument });
    expect(result.status).toBe('failed');
    expect(result.error).toBeUndefined();
  });

  it('sends the image document to a tspl printer with tsplRenderAsImage on, and the text document to an escpos printer', async () => {
    const deps = makeDeps(
      [printer('p-escpos', { protocol: 'escpos' }), printer('p-tspl', { protocol: 'tspl', tsplRenderAsImage: true })],
      (printerId) => ({ id: 'job1', requestId: 'req1', printerId, printType: 'Receipt', document: textDocument, status: 'success', retryCount: 0, createdAt: 'now' }),
    );
    const service = createPrintService(deps);
    await service.print('Receipt', { text: textDocument, image: imageDocument });

    expect(deps.scheduler.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: 'p-escpos', document: textDocument }),
    );
    expect(deps.scheduler.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: 'p-tspl', document: imageDocument }),
    );
  });

  it('sends the text document to a tspl printer that does NOT have tsplRenderAsImage on, even when an image document is provided', async () => {
    const deps = makeDeps(
      [printer('p-tspl', { protocol: 'tspl', tsplRenderAsImage: false })],
      (printerId) => ({ id: 'job1', requestId: 'req1', printerId, printType: 'Receipt', document: textDocument, status: 'success', retryCount: 0, createdAt: 'now' }),
    );
    const service = createPrintService(deps);
    await service.print('Receipt', { text: textDocument, image: imageDocument });

    expect(deps.scheduler.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: 'p-tspl', document: textDocument }),
    );
  });

  it('falls back to the text document for a tsplRenderAsImage tspl printer when no image document is provided', async () => {
    const deps = makeDeps(
      [printer('p-tspl', { protocol: 'tspl', tsplRenderAsImage: true })],
      (printerId) => ({ id: 'job1', requestId: 'req1', printerId, printType: 'Receipt', document: textDocument, status: 'success', retryCount: 0, createdAt: 'now' }),
    );
    const service = createPrintService(deps);
    await service.print('Receipt', { text: textDocument });

    expect(deps.scheduler.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: 'p-tspl', document: textDocument }),
    );
  });
});

describe('PrintService.imageDocumentPaperSize', () => {
  it('returns null for a tspl printer when tsplRenderAsImage is not set', () => {
    const deps = makeDeps([printer('p1', { protocol: 'tspl', printsReceipt: true, paperSize: '58mm' })], () => { throw new Error('unused'); });
    const service = createPrintService(deps);
    expect(service.imageDocumentPaperSize('Receipt')).toBeNull();
  });

  it('the real exported PrintService singleton also has no printer with tsplRenderAsImage set by default', () => {
    // Không mock PrinterService — getPrinters() đọc storage thật, nhưng danh
    // sách rỗng trong môi trường test nên effectivePrinters() rỗng, vẫn trả null.
    expect(PrintService.imageDocumentPaperSize('Receipt')).toBeNull();
  });

  it('returns the paperSize of a tspl printer that has tsplRenderAsImage on', () => {
    const deps = makeDeps([printer('p1', { protocol: 'tspl', printsReceipt: true, tsplRenderAsImage: true, paperSize: '58mm' })], () => { throw new Error('unused'); });
    const service = createPrintService(deps);
    expect(service.imageDocumentPaperSize('Receipt')).toBe('58mm');
  });

  it('returns null when every target printer for the type is text-capable (escpos), regardless of tsplRenderAsImage', () => {
    const deps = makeDeps([printer('p1', { protocol: 'escpos', printsReceipt: true, tsplRenderAsImage: true })], () => { throw new Error('unused'); });
    const service = createPrintService(deps);
    expect(service.imageDocumentPaperSize('Receipt')).toBeNull();
  });

  it('returns null when the tsplRenderAsImage tspl printer is not actually targeted by this printType', () => {
    const deps = makeDeps([printer('p1', { protocol: 'tspl', printsReceipt: false, printsLabel: true, tsplRenderAsImage: true })], () => { throw new Error('unused'); });
    const service = createPrintService(deps);
    expect(service.imageDocumentPaperSize('Receipt')).toBeNull();
  });
});
