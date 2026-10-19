import { PrintService, printService } from '../PrintService';
import type { PrintQueue } from '../PrintQueue';
import type { PrinterRepository } from '../../storage/PrinterRepository';
import { CutterMode } from '../../models/paper/CutterMode';
import { PaperSize } from '../../models/paper/PaperSize';
import { PaperType } from '../../models/paper/PaperType';
import type { PaperOptions } from '../../models/paper/PaperOptions';
import { ConnectionType } from '../../models/connections/ConnectionType';
import { type Printer } from '../../models/printer/Printer';
import { PrintKind } from '../../models/printer/PrintKind';
import { PrintEnqueueStatus } from '../../models/printing/PrintEnqueueStatus';
import type { PrintTask } from '../../models/printing/PrintTask';
import { makePrinter, makeTsplLanguage } from '../../testing/printerFixtures';
import { mockOf } from '../../testing/printerServiceTestKit';
import { PrintErrorCode } from '../../errors';

const image = 'base64-png';

const TITLE = 'Hoá đơn #A1';

/** Hàm chụp giả: khổ giấy nào cũng ra cùng một ảnh. */
const render = (): Promise<string> => Promise.resolve(image);

const lanPrinter = (id: string, host: string, overrides: Partial<Printer> = {}): Printer =>
  makePrinter({
    id,
    connection: { type: ConnectionType.Lan, host, port: 9100 },
    deviceId: `lan:${host}:9100`,
    ...overrides,
  });

const makeQueue = (): jest.Mocked<PrintQueue> => mockOf<jest.Mocked<PrintQueue>>({ enqueue: jest.fn() });

const makeService = (printers: Printer[], queue: PrintQueue = makeQueue()): PrintService =>
  new PrintService(mockOf<PrinterRepository>({ getPrinters: () => printers }), queue);

/** Các lệnh đã đưa vào hàng đợi, theo thứ tự. */
const enqueuedOf = (queue: jest.Mocked<PrintQueue>): PrintTask[] => queue.enqueue.mock.calls.map(([task]) => task);

describe('PrintService.print', () => {
  it('không có máy nhận loại nội dung → NoAvailablePrinter, không chụp, không enqueue', async () => {
    const queue = makeQueue();
    const capture = jest.fn(render);
    const result = await makeService([], queue).print(PrintKind.Receipt, capture, TITLE);

    expect(result.status).toBe(PrintEnqueueStatus.NoAvailablePrinter);
    expect(result.tasks).toEqual([]);
    expect(result.error?.code).toBe(PrintErrorCode.NO_AVAILABLE_PRINTER);
    expect(capture).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('enqueue mỗi máy một lệnh mang title, máy, ảnh đúng giấy', async () => {
    const p1 = lanPrinter('p1', '1.1.1.1');
    const p2 = lanPrinter('p2', '1.1.1.2');
    const queue = makeQueue();
    const result = await makeService([p1, p2], queue).print(PrintKind.Receipt, render, TITLE);

    expect(result.status).toBe(PrintEnqueueStatus.Queued);
    expect(result.tasks).toHaveLength(2);
    expect(enqueuedOf(queue)).toEqual(result.tasks);
    expect(enqueuedOf(queue)[0]).toMatchObject({
      printerId: 'p1',
      printerName: p1.name,
      deviceId: p1.deviceId,
      connectionType: ConnectionType.Lan,
      kind: PrintKind.Receipt,
      data: image,
      title: TITLE,
    });
    expect(enqueuedOf(queue)[1]).toMatchObject({ printerId: 'p2', deviceId: p2.deviceId });
  });

  it('trả về Queued trước khi in xong', async () => {
    const queue = makeQueue();
    const result = await makeService([lanPrinter('p1', '1.1.1.1')], queue).print(PrintKind.Receipt, render, TITLE);

    expect(result.status).toBe(PrintEnqueueStatus.Queued);
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
  });

  it('chụp hỏng → CaptureFailed với INVALID_IMAGE, không enqueue', async () => {
    const queue = makeQueue();
    const result = await makeService([lanPrinter('a', '1.1.1.1')], queue).print(
      PrintKind.Receipt,
      () => Promise.resolve(null),
      TITLE,
    );

    expect(result.status).toBe(PrintEnqueueStatus.CaptureFailed);
    expect(result.error?.code).toBe(PrintErrorCode.INVALID_IMAGE);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('hàm chụp ném lỗi → CaptureFailed, print không reject', async () => {
    const queue = makeQueue();
    const result = await makeService([lanPrinter('a', '1.1.1.1')], queue).print(
      PrintKind.Receipt,
      () => Promise.reject(new Error('view chưa mount')),
      TITLE,
    );

    expect(result.status).toBe(PrintEnqueueStatus.CaptureFailed);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('singleton printService mặc định chưa có máy in nào → NoAvailablePrinter', async () => {
    expect((await printService.print(PrintKind.Receipt, render, TITLE)).status).toBe(
      PrintEnqueueStatus.NoAvailablePrinter,
    );
  });
});

describe('PrintService target selection', () => {
  const enqueuedIds = async (printers: Printer[], kind: PrintKind): Promise<string[]> => {
    const queue = makeQueue();
    await makeService(printers, queue).print(kind, render, TITLE);
    return enqueuedOf(queue).map((task) => task.printerId);
  };

  it('bỏ qua máy in đang tắt', async () => {
    const printers = [lanPrinter('p1', '1.1.1.1', { enabled: false }), lanPrinter('p2', '1.1.1.2')];
    expect(await enqueuedIds(printers, PrintKind.Receipt)).toEqual(['p2']);
  });

  it('chỉ chọn máy in nhận đúng loại nội dung', async () => {
    const printers = [
      lanPrinter('receipt-1', '1.1.1.1'),
      lanPrinter('label-1', '1.1.1.2', { kind: PrintKind.Label, language: makeTsplLanguage() }),
    ];
    expect(await enqueuedIds(printers, PrintKind.Label)).toEqual(['label-1']);
    expect(await enqueuedIds(printers, PrintKind.Receipt)).toEqual(['receipt-1']);
  });
});

describe('PrintService chụp theo khổ giấy', () => {
  const mm58 = { type: PaperType.Continuous, paperSize: PaperSize.Mm58, cutterMode: CutterMode.PerJob } as const;
  const mm80 = { type: PaperType.Continuous, paperSize: PaperSize.Mm80, cutterMode: CutterMode.PerJob } as const;

  /** Hàm chụp giả: ảnh mang khổ giấy để biết máy nào nhận ảnh nào. */
  const renderByPaper = jest.fn((paper: PaperOptions) => Promise.resolve(`png-${paper.paperSize}`));

  beforeEach(() => renderByPaper.mockClear());

  it('máy cùng giấy chụp một lần, khác giấy chụp riêng; mỗi máy nhận ảnh đúng giấy của nó', async () => {
    const printers = [
      lanPrinter('a', '1.1.1.1', { paper: mm58 }),
      lanPrinter('b', '1.1.1.2', { paper: mm80 }),
      lanPrinter('c', '1.1.1.3', { paper: mm58 }),
    ];
    const queue = makeQueue();

    await makeService(printers, queue).print(PrintKind.Receipt, renderByPaper, TITLE);

    expect(renderByPaper.mock.calls.map(([paper]) => paper.paperSize)).toEqual([PaperSize.Mm58, PaperSize.Mm80]);
    expect(enqueuedOf(queue).map((task) => [task.printerId, task.data])).toEqual([
      ['a', 'png-58'],
      ['b', 'png-80'],
      ['c', 'png-58'],
    ]);
  });
});
