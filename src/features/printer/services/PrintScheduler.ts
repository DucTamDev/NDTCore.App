import { AppErrorException, type AppError } from '../types/AppError';
import { PrinterService } from './PrinterService';
import { PrinterConnectionLock, connectionResourceKey, type createResourceLock } from './PrinterConnectionLock';
import type { PrintJob } from '../types/printJob.types';

type PrinterServiceLike = Pick<typeof PrinterService, 'print' | 'getPrinters'>;
type ResourceLockLike = ReturnType<typeof createResourceLock>;

export const createPrintScheduler = (
  printerService: PrinterServiceLike,
  lock: ResourceLockLike = PrinterConnectionLock,
) => {
  const toAppError = (error: unknown): AppError =>
    error instanceof AppErrorException
      ? { code: error.code, message: error.message }
      : { code: 'PRINT_ERROR', message: String(error) };

  /**
   * Khoá tài nguyên dùng để tuần tự hoá job — theo `protocol`+`connectionType`
   * chứ không phải `printerId`, vì một số driver (vd `ThermalReceiptDriver`)
   * chỉ giữ được 1 kết nối native cho mỗi `connectionType` (giới hạn của thư
   * viện, không phải lỗi driver): 2 máy in cùng loại kết nối in song song có
   * thể khiến máy in sau "cướp" kết nối của máy in trước giữa chừng, làm mất
   * đơn in mà không có cảnh báo gì. Rơi về `printerId` nếu không tìm thấy
   * cấu hình máy in (không nên xảy ra trong thực tế). Dùng chung
   * `PrinterConnectionLock` với `PrinterService.testPrint()` để 2 đường gọi
   * đều loại trừ lẫn nhau trên cùng 1 kết nối native.
   */
  const resourceKeyFor = (printerId: string): string => {
    const config = printerService.getPrinters().find((p) => p.id === printerId);
    return config ? connectionResourceKey(config.protocol, config.connectionType) : printerId;
  };

  const enqueue = (job: PrintJob): Promise<PrintJob> =>
    lock
      .runExclusive(resourceKeyFor(job.printerId), async () => {
        job.status = 'printing';
        job.startedAt = new Date().toISOString();
        try {
          await printerService.print(job.printerId, job.document);
          job.status = 'success';
        } catch (error) {
          job.status = 'failed';
          job.error = toAppError(error);
        }
        job.completedAt = new Date().toISOString();
      })
      .then(() => job);

  const retry = (job: PrintJob): Promise<PrintJob> => {
    job.retryCount += 1;
    job.status = 'pending';
    job.error = undefined;
    return enqueue(job);
  };

  return { enqueue, retry };
};

export const PrintScheduler = createPrintScheduler(PrinterService);
