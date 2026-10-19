import { PrintQueue } from '../PrintQueue';
import type { PrinterService } from '../PrinterService';
import { PrinterConnectionLock } from '../../connection/PrinterConnectionLock';
import { ConnectionType } from '../../models/connections/ConnectionType';
import { PrintKind } from '../../models/printer/PrintKind';
import type { PrintTask } from '../../models/printing/PrintTask';
import type { PrintTaskResult } from '../../models/printing/PrintTaskResult';
import { PrintTaskStatus } from '../../models/printing/PrintTaskStatus';
import { DeviceErrorCode, PrinterErrorCode } from '../../errors';
import { DeviceErrorException, PrinterErrorException } from '../../exceptions';
import { mockOf } from '../../testing/printerServiceTestKit';
import { LoggerService } from '../../../../services/LoggerService';

jest.mock('../../../../services/LoggerService');

const DEVICE_A = 'lan:10.0.0.1:9100';
const DEVICE_B = 'lan:10.0.0.2:9100';

/** Lệnh in giả; `data` dùng luôn làm tên lệnh để biết `print` được gọi cho lệnh nào. */
const makeTask = (name: string, deviceId = DEVICE_A, printerId = 'p1'): PrintTask => ({
  id: name,
  printerId,
  printerName: `Máy ${printerId}`,
  deviceId,
  connectionType: ConnectionType.Lan,
  kind: PrintKind.Receipt,
  data: name,
  title: `Hoá đơn ${name}`,
  createdAt: new Date().toISOString(),
});

const deviceError = (code: DeviceErrorCode): DeviceErrorException =>
  new DeviceErrorException({ code, message: `lỗi ${code}` });

/** Hàng đợi với `print` giả; `behave(tên lệnh, lần gọi thứ mấy)` quyết định lần gọi đó thành công hay ném lỗi. */
const setup = (behave: (name: string, attempt: number) => Promise<void> = async () => undefined) => {
  const calls: string[] = [];
  const results: PrintTaskResult[] = [];
  const print = jest.fn(async (_printerId: string, name: string) => {
    calls.push(name);
    await behave(name, calls.filter((call) => call === name).length);
  });
  const lock = new PrinterConnectionLock();
  const queue = new PrintQueue(mockOf<PrinterService>({ print }), lock);
  queue.onTaskFinished((result) => results.push(result));
  return { queue, lock, print, calls, results };
};

/** Cho đồng hồ giả chạy tới khi nhận đủ `count` kết quả. */
const drain = async (results: PrintTaskResult[], count: number): Promise<void> => {
  for (let step = 0; step < 100 && results.length < count; step += 1) {
    await jest.advanceTimersByTimeAsync(1000);
  }
};

const statusesOf = (results: PrintTaskResult[]): string[] =>
  results.map((result) => `${result.task.data}:${result.status}`);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('PrintQueue thứ tự', () => {
  it('in đúng thứ tự enqueue trên cùng máy, không chạy chồng', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const { queue, calls, results } = setup(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    });

    ['bill1', 'tem1', 'bill2'].forEach((name) => queue.enqueue(makeTask(name)));
    await drain(results, 3);

    expect(calls).toEqual(['bill1', 'tem1', 'bill2']);
    expect(maxInFlight).toBe(1);
  });

  it('máy khác nhau in song song', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const { queue, results } = setup(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    });

    queue.enqueue(makeTask('a1', DEVICE_A));
    queue.enqueue(makeTask('b1', DEVICE_B));
    await drain(results, 2);

    expect(maxInFlight).toBe(2);
  });

  it('hai máy in đã lưu cùng deviceId dùng chung một hàng', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const { queue, results } = setup(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    });

    queue.enqueue(makeTask('bill', DEVICE_A, 'receipt-printer'));
    queue.enqueue(makeTask('tem', DEVICE_A, 'label-printer'));
    await drain(results, 2);

    expect(maxInFlight).toBe(1);
  });

  it('thành công: emit Success một lần rồi xoá khỏi hàng', async () => {
    const { queue, print, results } = setup();

    queue.enqueue(makeTask('a1'));
    await drain(results, 1);
    await jest.advanceTimersByTimeAsync(10000);

    expect(statusesOf(results)).toEqual(['a1:Success']);
    expect(print).toHaveBeenCalledTimes(1);
  });
});

describe('PrintQueue thử lại khi lỗi kết nối', () => {
  it('lỗi kết nối rồi thành công ở lần 2', async () => {
    const { queue, print, results } = setup(async (_name, attempt) => {
      if (attempt === 1) throw deviceError(DeviceErrorCode.CONNECTION_FAILED);
    });

    queue.enqueue(makeTask('a1'));
    await jest.advanceTimersByTimeAsync(1999);
    expect(print).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    expect(print).toHaveBeenCalledTimes(2);
    expect(statusesOf(results)).toEqual(['a1:Success']);
  });

  it('lỗi kết nối cả 3 lần thì Failed và bỏ cả hàng của máy', async () => {
    const { queue, print, calls, results } = setup(async () => {
      throw deviceError(DeviceErrorCode.CONNECTION_FAILED);
    });

    ['a1', 'a2', 'a3'].forEach((name) => queue.enqueue(makeTask(name)));
    await jest.advanceTimersByTimeAsync(0);
    expect(print).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(2000);
    expect(print).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(5000);
    expect(print).toHaveBeenCalledTimes(3);

    await drain(results, 3);
    expect(calls).toEqual(['a1', 'a1', 'a1']);
    expect(statusesOf(results)).toEqual(['a1:Failed', 'a2:Failed', 'a3:Failed']);
    expect(results.map((result) => result.error?.code)).toEqual([
      DeviceErrorCode.CONNECTION_FAILED,
      DeviceErrorCode.CONNECTION_FAILED,
      DeviceErrorCode.CONNECTION_FAILED,
    ]);
  });

  it('trong lúc chờ thử lại, khoá của máy được nhả', async () => {
    const { queue, lock, print } = setup(async () => {
      throw deviceError(DeviceErrorCode.CONNECTION_FAILED);
    });

    queue.enqueue(makeTask('a1'));
    await jest.advanceTimersByTimeAsync(0);
    expect(print).toHaveBeenCalledTimes(1);

    let acquired = false;
    lock.runExclusive(DEVICE_A, async () => {
      acquired = true;
    });
    await jest.advanceTimersByTimeAsync(0);

    expect(acquired).toBe(true);
    expect(print).toHaveBeenCalledTimes(1);
  });
});

describe('PrintQueue lỗi không thử lại', () => {
  it.each([
    DeviceErrorCode.CONNECTION_LOST,
    DeviceErrorCode.NOT_CONNECTED,
    DeviceErrorCode.DEVICE_NOT_FOUND,
    DeviceErrorCode.BLUETOOTH_DISABLED,
    DeviceErrorCode.SERVICE_CLOSED,
    DeviceErrorCode.PERMISSION_DENIED,
  ])('máy không dùng được (%s) thì bỏ hết lệnh của máy, không thử lại', async (code) => {
    const { queue, calls, results } = setup(async () => {
      throw deviceError(code);
    });

    ['a1', 'a2', 'a3'].forEach((name) => queue.enqueue(makeTask(name)));
    await drain(results, 3);

    expect(calls).toEqual(['a1']);
    expect(statusesOf(results)).toEqual(['a1:Failed', 'a2:Failed', 'a3:Failed']);
    expect(results.every((result) => result.error?.code === code)).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([
    deviceError(DeviceErrorCode.WRITE_FAILED),
    deviceError(DeviceErrorCode.WRITE_TIMEOUT),
    new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_FOUND, message: 'đã xoá' }),
  ])('lỗi của riêng lệnh (%p) chỉ bỏ lệnh đó', async (error) => {
    const { queue, calls, results } = setup(async (name) => {
      if (name === 'a1') throw error;
    });

    queue.enqueue(makeTask('a1'));
    queue.enqueue(makeTask('a2'));
    await drain(results, 2);

    expect(calls).toEqual(['a1', 'a2']);
    expect(statusesOf(results)).toEqual(['a1:Failed', 'a2:Success']);
    expect(results[0].error?.code).toBe(error.code);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('PrintQueue listener', () => {
  it('listener ném lỗi không làm dừng hàng đợi', async () => {
    const { queue, calls, results } = setup();
    const received: string[] = [];
    queue.onTaskFinished(() => {
      throw new Error('listener hỏng');
    });
    queue.onTaskFinished((result) => received.push(result.task.data));

    queue.enqueue(makeTask('a1'));
    queue.enqueue(makeTask('a2'));
    await drain(results, 2);

    expect(calls).toEqual(['a1', 'a2']);
    expect(received).toEqual(['a1', 'a2']);
    expect(LoggerService.warning).toHaveBeenCalled();
  });

  it('huỷ đăng ký thì không nhận kết quả nữa', async () => {
    const { queue, results } = setup();
    const received: string[] = [];
    const unsubscribe = queue.onTaskFinished((result) => received.push(result.task.data));

    queue.enqueue(makeTask('a1'));
    await drain(results, 1);
    unsubscribe();
    queue.enqueue(makeTask('a2'));
    await drain(results, 2);

    expect(received).toEqual(['a1']);
    expect(results.map((result) => result.status)).toEqual([PrintTaskStatus.Success, PrintTaskStatus.Success]);
  });
});
