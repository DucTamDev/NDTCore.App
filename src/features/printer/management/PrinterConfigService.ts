import type { IPrinterDriver } from '../drivers/IPrinterDriver';
import { PrinterDriverType, PrintRenderMode } from '../models/printer/PrinterDriver';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import type { EscPosRenderMode, TsplFontConfig, TsplInternalFontConfig, TsplRenderMode } from '../models/printer/PrinterDriver';
import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';
import { PrinterErrorException, PrinterErrorCode, errorCodeOf } from '../errors/PrinterError';
import { PrinterLogger } from '../logging/PrinterLogger';
import { LoggerService } from '../../../services/LoggerService';
import { DriverRegistry } from '../drivers/DriverRegistry';
import { PrinterConnectionLock, resourceKeyFor, type createResourceLock } from '../connection/PrinterConnectionLock';
import { PrinterRepository, type createPrinterRepository } from '../storage/PrinterRepository';
import type { TsplDriver } from '../drivers/tspl/TsplDriver';

type ResourceLockLike = ReturnType<typeof createResourceLock>;
type PrinterRepositoryLike = ReturnType<typeof createPrinterRepository>;

/**
 * Cấu hình TSPL/media cho driver của 1 printer ĐÃ LƯU — `installTsplFont`
 * (DOWNLOAD font qua lock) + các setter persist config (`renderMode`,
 * `internalFont`, `media`). Printer draft chưa lưu → no-op ở các setter.
 *
 * TSPL/media config for a saved printer's driver — `installTsplFont` (font
 * DOWNLOAD through the lock) plus config-persisting setters (`renderMode`,
 * `internalFont`, `media`). Unsaved draft → the setters no-op.
 */
export const createPrinterConfigService = (
  registry: Record<PrinterDriverType, IPrinterDriver> = DriverRegistry,
  repository: PrinterRepositoryLike = PrinterRepository,
  lock: ResourceLockLike = PrinterConnectionLock,
) => {
  const getDriver = (type: PrinterDriverType): IPrinterDriver => registry[type];

  /**
   * Rơi về `printerId` nếu chưa lưu (flow thêm máy in mới trong
   * AddPrinterModal gọi installTsplFont trước khi printer có trong storage)
   * — an toàn vì draft printer chưa lưu không thể trùng resource key với
   * printer khác. Cùng pattern với `PrintScheduler.resourceKeyFor`.
   */
  const resourceKeyForTsplPrinterId = (printerId: string): string => {
    const printer = repository.getPrinters().find((p) => p.id === printerId);

    if (!printer) {
      return printerId;
    }

    return resourceKeyFor(printer, PrinterDriverType.tspl);
  };

  /**
   * Passthrough TSPL-riêng — KHÔNG đưa vào `IPrinterDriver` chung vì tính
   * năng này chỉ có nghĩa với TSPL, ESC/POS không có khái niệm font custom.
   * Cast trực tiếp sang `TsplDriver` vì `registry.tspl` luôn là instance đó.
   *
   * Orchestrate trọn lifecycle trong `lock.runExclusive` (DOWNLOAD gửi hàng
   * trăm KB, không được interleave với print job trên cùng resource):
   * connect (chỉ khi CHÍNH hàm này mở) → DOWNLOAD → disconnect (chỉ cái mình
   * mở — "Driver Connect Reuse": modal Add giữ connection từ discovery,
   * không đóng của người khác). Sau lock mới "persist state": chỉ khi printer
   * đã có trong storage; draft chưa lưu do `AddPrinterModal` mang state vào
   * `buildDraftPrinter()` lúc Save.
   */
  const installTsplFont = async (printerId: string, font: TsplFontConfig): Promise<void> => {
    const tsplDriver = getDriver(PrinterDriverType.tspl) as TsplDriver;
    const printer = repository.getPrinters().find((p) => p.id === printerId);
    const tsplEntry = printer?.drivers.find((d) => d.type === PrinterDriverType.tspl);
    // `connectionType` chỉ có khi printer đã lưu; draft (flow AddPrinterModal)
    // chưa có `Printer` object nên để `undefined` — logger nhận optional.
    const connectionType = printer?.connection.type;
    // Đo trọn op DOWNLOAD (kể cả connect/disconnect do chính hàm này mở).
    const startedAt = Date.now();

    LoggerService.debug('installTsplFont: bắt đầu', { printerId, inStorage: Boolean(printer), connectionType, font: { name: font.name, fileName: font.fileName } });
    try {
      await lock.runExclusive(resourceKeyForTsplPrinterId(printerId), async () => {
        const wasConnected = tsplDriver.getStatus(printerId) === PrinterStatus.Connected;
        LoggerService.debug('installTsplFont: trong lock', { wasConnected });
        if (!wasConnected) {
          // Không tìm thấy printer trong storage và driver cũng chưa connected →
          // không tự connect được (thiếu `Printer` object). Draft hợp lệ luôn
          // được modal connect sẵn qua discovery trước khi gọi hàm này.
          if (!printer || !tsplEntry) {
            throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối — kết nối trước khi cài font.' });
          }
          LoggerService.debug('installTsplFont: tự connect');
          await tsplDriver.connect(printer, tsplEntry);
        }
        try {
          LoggerService.debug('installTsplFont: gọi driver.installTsplFont (DOWNLOAD)');
          await tsplDriver.installTsplFont(printerId, font);
          LoggerService.debug('installTsplFont: DOWNLOAD xong');
        } finally {
          // `printer`/`tsplEntry` chắc chắn có ở đây khi `!wasConnected` — nhánh
          // thiếu chúng đã throw trước khi vào try này.
          if (!wasConnected) {
            await tsplDriver.disconnect(printerId).catch(() => undefined);
          }
        }
      });
    } catch (error) {
      // Draft chưa lưu không có `connectionType` — chỉ đính khi có giá trị,
      // không phát `connectionType: undefined` vào log.
      PrinterLogger.fontInstallFailed({
        printerId,
        ...(connectionType ? { connectionType } : {}),
        errorCode: errorCodeOf(error),
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }

    // Persist TRƯỚC khi log success — nếu `savePrinters` ném thì không được để
    // log đã tuyên bố thành công rồi lỗi mới thoát ra không kèm fontInstallFailed.
    if (printer && tsplEntry && tsplEntry.config.type === PrinterDriverType.tspl) {
      repository.savePrinters(
        repository.getPrinters().map((p) =>
          p.id !== printerId
            ? p
            : {
                ...p,
                drivers: p.drivers.map((d) =>
                  d.type !== PrinterDriverType.tspl || d.config.type !== PrinterDriverType.tspl
                    ? d
                    : { ...d, config: { ...d.config, renderMode: PrintRenderMode.truetype, font: { ...font, fontInstalled: true } } },
                ),
              },
        ),
      );
    }

    PrinterLogger.fontInstallSucceeded({
      printerId,
      ...(connectionType ? { connectionType } : {}),
      durationMs: Date.now() - startedAt,
    });
  };

  /**
   * Persist `renderMode` cho TSPL driver của 1 printer ĐÃ LƯU — đối xứng với
   * nhánh persist của `installTsplFont` ("persist state as the last step"
   * đúng theo cả 2 chiều bật/tắt). Printer chưa lưu (draft) → no-op: modal Add
   * mang state vào `buildDraftPrinter()` lúc Save. Khi chuyển về `bitmap` giữ
   * nguyên `config.font` — `fontInstalled` vẫn true nghĩa là font còn trên máy
   * in; routing chọn strategy theo `renderMode`.
   */
  const setTsplRenderMode = (printerId: string, renderMode: TsplRenderMode): void => {
    const printer = repository.getPrinters().find((p) => p.id === printerId);
    const tsplEntry = printer?.drivers.find((d) => d.type === PrinterDriverType.tspl);

    if (!printer || !tsplEntry || tsplEntry.config.type !== PrinterDriverType.tspl) {
      return;
    }

    repository.savePrinters(
      repository.getPrinters().map((p) =>
        p.id !== printerId
          ? p
          : {
              ...p,
              drivers: p.drivers.map((d) =>
                d.type !== PrinterDriverType.tspl || d.config.type !== PrinterDriverType.tspl
                  ? d
                  : { ...d, config: { ...d.config, renderMode } },
              ),
            },
      ),
    );
  };

  /**
   * Persist `renderMode: 'internalfont'` + `internalFont` cho TSPL driver của
   * 1 printer ĐÃ LƯU — không có bước "install" (chỉ 2 tham số config), khác
   * `installTsplFont`. Printer chưa lưu (draft) → no-op: modal Add mang state
   * vào `buildDraftPrinter()` lúc Save. Giữ nguyên `config.font` (nếu từng cài
   * TrueType) để chuyển qua lại giữa các mode không mất cấu hình.
   */
  const setTsplInternalFont = (printerId: string, internalFont: TsplInternalFontConfig): void => {
    const printer = repository.getPrinters().find((p) => p.id === printerId);
    const tsplEntry = printer?.drivers.find((d) => d.type === PrinterDriverType.tspl);

    if (!printer || !tsplEntry || tsplEntry.config.type !== PrinterDriverType.tspl) {
      return;
    }

    repository.savePrinters(
      repository.getPrinters().map((p) =>
        p.id !== printerId
          ? p
          : {
              ...p,
              drivers: p.drivers.map((d) =>
                d.type !== PrinterDriverType.tspl || d.config.type !== PrinterDriverType.tspl
                  ? d
                  : { ...d, config: { ...d.config, renderMode: PrintRenderMode.internalfont, internalFont } },
              ),
            },
      ),
    );
  };

  /**
   * Persist `media` cho 1 driver của printer ĐÃ LƯU (nhận cả escpos lẫn tspl).
   * `!entry` → no-op: printer draft / driver chưa nằm trong storage lúc modal Add
   * đang chạy — modal giữ media trong `drivers` state và `buildDraftPrinter` ghi
   * nó khi Save. Với printer đang SỬA, đây là 1 lần ghi thật ngay → caller phải
   * truyền media ĐÃ MERGE (không phải raw patch) để không lưu media dở dang.
   */
  const setDriverMedia = (printerId: string, driverType: PrinterDriverType, patch: Partial<PrintPaperConfig>): void => {
    const printers = repository.getPrinters();
    const printer = printers.find((p) => p.id === printerId);
    const entry = printer?.drivers.find((d) => d.type === driverType);

    if (!printer || !entry) {
      return;
    }

    repository.savePrinters(
      printers.map((p) =>
        p.id !== printerId ? p : {
          ...p,
          drivers: p.drivers.map((d) =>
            d.type !== driverType ? d : { ...d, config: { ...d.config, media: { ...d.config.media, ...patch } } },
          ),
        },
      ),
    );
  };

  /**
   * Persist `renderMode` cho ESC/POS driver của 1 printer ĐÃ LƯU — đối xứng
   * với `setTsplRenderMode`, nhưng không có bước "install" nào (bitmap
   * ESC/POS không cài gì lên máy in, chỉ đổi cách encode ở JS). Printer chưa
   * lưu (draft) → no-op: modal Add mang state vào `buildDraftPrinter()` lúc
   * Save.
   */
  const setEscPosRenderMode = (printerId: string, renderMode: EscPosRenderMode): void => {
    const printer = repository.getPrinters().find((p) => p.id === printerId);
    const entry = printer?.drivers.find((d) => d.type === PrinterDriverType.escpos);

    if (!printer || !entry || entry.config.type !== PrinterDriverType.escpos) {
      return;
    }

    repository.savePrinters(
      repository.getPrinters().map((p) =>
        p.id !== printerId
          ? p
          : {
              ...p,
              drivers: p.drivers.map((d) =>
                d.type !== PrinterDriverType.escpos || d.config.type !== PrinterDriverType.escpos
                  ? d
                  : { ...d, config: { ...d.config, renderMode } },
              ),
            },
      ),
    );
  };

  return { installTsplFont, setTsplRenderMode, setTsplInternalFont, setEscPosRenderMode, setDriverMedia };
};

export const PrinterConfigService = createPrinterConfigService(DriverRegistry, PrinterRepository, PrinterConnectionLock);
