import type { IPrinterDriver, PrintDocuments, Unsubscribe } from '../types/driver.types';
import { ConnectionType, PrinterDriverType, PrinterStatus, TsplRenderMode } from '../types/printer.types';
import type { DeviceScanEvent, Printer, PrinterDriver, TsplFontConfig } from '../types/printer.types';
import type { PrintType } from '../types/printConfiguration.types';
import { AppErrorException, AppErrorCode, errorCodeOf } from '../types/AppError';
import { PrinterLogger } from '../services/PrinterLogger';
import { DriverRegistry } from './DriverRegistry';
import { PrinterConnectionLock, connectionResourceKey, type createResourceLock } from './PrinterConnectionLock';
import { PrinterStorage } from '../storage/PrinterStorage';
import { resolveIdentityKey } from '../discovery/PrinterResolver';
import { printerSchema } from '../schemas/printerFormSchema';
import { createDiscoverDriver, type DiscoveryEvent, type DiscoveryInput } from '../discovery/PrinterDiscoveryService';
import type { TsplDriver } from '../drivers/tspl/TsplDriver';

type ResourceLockLike = ReturnType<typeof createResourceLock>;

export const createPrinterService = (
  registry: Record<PrinterDriverType, IPrinterDriver>,
  lock: ResourceLockLike = PrinterConnectionLock,
) => {
  const getDriver = (type: PrinterDriverType): IPrinterDriver => registry[type];
  const discoverDriverFn = createDiscoverDriver(registry);

  const getPrinters = (): Printer[] => PrinterStorage.getPrinters();
  const savePrinters = (printers: Printer[]): void => PrinterStorage.savePrinters(printers);

  const findOrThrow = (printerId: string): Printer => {
    const found = getPrinters().find((p) => p.id === printerId);
    if (!found) throw new AppErrorException({ code: AppErrorCode.PRINTER_NOT_FOUND, message: `Không tìm thấy máy in với id ${printerId}` });
    return found;
  };

  const assertNoDuplicateIdentity = (printer: Printer): void => {
    const collision = getPrinters().find((p) => p.id !== printer.id && p.identityKey === printer.identityKey);
    if (collision) {
      throw new AppErrorException({
        code: AppErrorCode.PRINTER_ALREADY_EXISTS,
        message: `Máy in này đã được thêm với tên "${collision.name}" — dùng "+ Thêm driver" trên máy in đó thay vì thêm mới.`,
      });
    }
  };

  /**
   * Tính lại `identityKey` từ chính `connectionType`/`device`/`lan` của
   * printer — KHÔNG tin thẳng giá trị caller truyền vào (defense-in-depth,
   * cùng triết lý với `printerSchema.parse()` bên dưới: UI đã tự tính đúng,
   * đây là lưới an toàn ở service layer, không phải nguồn sự thật duy nhất).
   */
  const withRecomputedIdentity = (printer: Printer): Printer => ({
    ...printer,
    identityKey: resolveIdentityKey({ connectionType: printer.connectionType, device: printer.device, lan: printer.lan }),
  });

  const addPrinter = (printer: Printer): void => {
    const withIdentity = withRecomputedIdentity(printer);
    printerSchema.parse(withIdentity);
    assertNoDuplicateIdentity(withIdentity);
    savePrinters([...getPrinters(), withIdentity]);
  };

  const updatePrinter = (printer: Printer): void => {
    const withIdentity = withRecomputedIdentity(printer);
    printerSchema.parse(withIdentity);
    assertNoDuplicateIdentity(withIdentity);
    savePrinters(getPrinters().map((p) => (p.id === withIdentity.id ? withIdentity : p)));
  };

  const removePrinter = (printerId: string): void => {
    savePrinters(getPrinters().filter((p) => p.id !== printerId));
  };

  const setEnabled = (printerId: string, enabled: boolean): void => {
    savePrinters(getPrinters().map((p) => (p.id === printerId ? { ...p, enabled } : p)));
  };

  const resourceKeyFor = (printer: Printer, driverType: PrinterDriverType): string =>
    connectionResourceKey({ driverType, connectionType: printer.connectionType, device: printer.device, lan: printer.lan });

  /**
   * Kết nối TẤT CẢ driver của printer, qua khoá tài nguyên riêng cho từng
   * driver (§9) — 1 driver lỗi không chặn driver còn lại (`Promise.allSettled`).
   * LAN/Bluetooth: mỗi driver là 1 kết nối native độc lập. USB: cả 2 driver
   * dùng chung 1 channel — connect driver B sau khi A đã sống sẽ "cướp" kênh
   * (giới hạn đã biết của thư viện, không giải quyết ở đây, xem spec §9).
   */
  const connect = async (printerId: string): Promise<void> => {
    const printer = findOrThrow(printerId);
    await Promise.allSettled(
      printer.drivers.map((driver) =>
        lock.runExclusive(resourceKeyFor(printer, driver.type), () => getDriver(driver.type).connect(printer, driver)),
      ),
    );
  };

  const disconnect = async (printerId: string): Promise<void> => {
    const printer = findOrThrow(printerId);
    await Promise.allSettled(
      printer.drivers.map((driver) =>
        lock.runExclusive(resourceKeyFor(printer, driver.type), () => getDriver(driver.type).disconnect(printerId)),
      ),
    );
  };

  const reconnect = async (printerId: string): Promise<void> => {
    await disconnect(printerId).catch(() => undefined);
    await connect(printerId);
  };

  const reconnectAutoPrinters = (): void => {
    getPrinters()
      .filter((p) => p.enabled && p.autoReconnect)
      .forEach((p) => {
        connect(p.id).catch(() => undefined);
      });
  };

  const testPrint = async (printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType): Promise<void> => {
    await lock.runExclusive(resourceKeyFor(printer, driver.type), () => getDriver(driver.type).testPrint(printer, driver, documents, printType));
  };

  const print = async (printerId: string, documents: PrintDocuments, printType: PrintType): Promise<void> => {
    const printer = findOrThrow(printerId);
    const driverEntry = printer.drivers.find((d) => d.contentTypes.includes(printType));
    if (!driverEntry) {
      throw new AppErrorException({
        code: AppErrorCode.NO_AVAILABLE_PRINTER,
        message: `Máy in ${printerId} không có driver nào nhận in ${printType}`,
      });
    }
    const driver = getDriver(driverEntry.type);
    if (driver.getStatus(printerId) !== PrinterStatus.connected) {
      await driver.connect(printer, driverEntry);
    }
    await driver.print(printerId, documents, printType);
  };

  const scanDevices = (type: PrinterDriverType, connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe =>
    getDriver(type).scan(connectionType, onEvent);

  const scanForConnectionType = (connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe => {
    if (connectionType === ConnectionType.usb) return getDriver(PrinterDriverType.escpos).scan(ConnectionType.usb, onEvent);
    if (connectionType === ConnectionType.bluetooth) return getDriver(PrinterDriverType.tspl).scan(ConnectionType.bluetooth, onEvent);
    return getDriver(PrinterDriverType.tspl).scan(ConnectionType.lan, onEvent);
  };

  const connectDraft = async (printer: Printer, driver: PrinterDriver): Promise<void> => {
    await getDriver(driver.type).connect(printer, driver);
  };

  const disconnectForDriver = async (type: PrinterDriverType, printerId: string): Promise<void> => {
    await getDriver(type).disconnect(printerId);
  };

  /** Connected nếu BẤT KỲ driver nào của printer đang connected, ngược lại fallback driver đầu tiên — 1 badge/1 printer dù có thể có 2 driver (thiết kế cho task này, xem đầu Task 17). */
  const getStatus = (printerId: string): PrinterStatus => {
    const printer = findOrThrow(printerId);
    const statuses = printer.drivers.map((d) => getDriver(d.type).getStatus(printerId));
    return statuses.find((s) => s === PrinterStatus.connected) ?? statuses[0] ?? PrinterStatus.idle;
  };

  const onStatusChange = (printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe => {
    const printer = findOrThrow(printerId);
    const unsubscribes = printer.drivers.map((d) => getDriver(d.type).onStatusChange(printerId, () => callback(getStatus(printerId))));
    return () => unsubscribes.forEach((unsub) => unsub());
  };

  const getStatusForDriver = (type: PrinterDriverType, printerId: string): PrinterStatus => getDriver(type).getStatus(printerId);

  const onStatusChangeForDriver = (type: PrinterDriverType, printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe =>
    getDriver(type).onStatusChange(printerId, callback);

  const discoverDriver = (input: DiscoveryInput, onEvent: (event: DiscoveryEvent) => void): Unsubscribe => discoverDriverFn(input, onEvent);

  /**
   * Rơi về `printerId` nếu chưa lưu (flow thêm máy in mới trong
   * AddPrinterModal gọi installTsplFont trước khi printer có trong storage)
   * — an toàn vì draft printer chưa lưu không thể trùng resource key với
   * printer khác. Cùng pattern với `PrintScheduler.resourceKeyFor`.
   */
  const resourceKeyForTsplPrinterId = (printerId: string): string => {
    const printer = getPrinters().find((p) => p.id === printerId);
    if (!printer) return printerId;
    return resourceKeyFor(printer, PrinterDriverType.tspl);
  };

  /**
   * Passthrough TSPL-riêng — KHÔNG đưa vào `IPrinterDriver` chung vì tính
   * năng này chỉ có nghĩa với TSPL, ESC/POS không có khái niệm font custom.
   * Cast trực tiếp sang `TsplDriver` vì `registry.tspl` luôn là instance đó.
   *
   * Orchestrate trọn lifecycle §46/§126 trong `lock.runExclusive` (DOWNLOAD
   * gửi hàng trăm KB, không được interleave với print job trên cùng resource):
   * connect (chỉ khi CHÍNH hàm này mở) → DOWNLOAD → disconnect (chỉ cái mình
   * mở — §95 "Driver Connect Reuse": modal Add giữ connection từ discovery,
   * không đóng của người khác). Sau lock mới "persist state": chỉ khi printer
   * đã có trong storage; draft chưa lưu do `AddPrinterModal` mang state vào
   * `buildDraftPrinter()` lúc Save (§8.4, §12.3).
   */
  const installTsplFont = async (printerId: string, font: TsplFontConfig): Promise<void> => {
    const tsplDriver = getDriver(PrinterDriverType.tspl) as TsplDriver;
    const printer = getPrinters().find((p) => p.id === printerId);
    const tsplEntry = printer?.drivers.find((d) => d.type === PrinterDriverType.tspl);
    // `connectionType` chỉ có khi printer đã lưu; draft (flow AddPrinterModal)
    // chưa có `Printer` object nên để `undefined` — logger nhận optional.
    const connectionType = printer?.connectionType;
    // Đo trọn op DOWNLOAD (kể cả connect/disconnect do chính hàm này mở).
    const startedAt = Date.now();

    try {
      await lock.runExclusive(resourceKeyForTsplPrinterId(printerId), async () => {
        const wasConnected = tsplDriver.getStatus(printerId) === PrinterStatus.connected;
        if (!wasConnected) {
          // Không tìm thấy printer trong storage và driver cũng chưa connected →
          // không tự connect được (thiếu `Printer` object). Draft hợp lệ luôn
          // được modal connect sẵn qua discovery trước khi gọi hàm này.
          if (!printer || !tsplEntry) {
            throw new AppErrorException({ code: AppErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối — kết nối trước khi cài font.' });
          }
          await tsplDriver.connect(printer, tsplEntry);
        }
        try {
          await tsplDriver.installTsplFont(printerId, font);
        } finally {
          // `printer`/`tsplEntry` chắc chắn có ở đây khi `!wasConnected` — nhánh
          // thiếu chúng đã throw trước khi vào try này (§95).
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
      savePrinters(
        getPrinters().map((p) =>
          p.id !== printerId
            ? p
            : {
                ...p,
                drivers: p.drivers.map((d) =>
                  d.type !== PrinterDriverType.tspl || d.config.type !== PrinterDriverType.tspl
                    ? d
                    : { ...d, config: { ...d.config, renderMode: TsplRenderMode.truetype, font: { ...font, fontInstalled: true } } },
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
   * nhánh persist của `installTsplFont` (§46 "persist state as the last step"
   * đúng theo cả 2 chiều bật/tắt). Printer chưa lưu (draft) → no-op: modal Add
   * mang state vào `buildDraftPrinter()` lúc Save. Khi chuyển về `bitmap` giữ
   * nguyên `config.font` — `fontInstalled` vẫn true nghĩa là font còn trên máy
   * in; routing chọn strategy theo `renderMode` (Task 7).
   */
  const setTsplRenderMode = (printerId: string, renderMode: TsplRenderMode): void => {
    const printer = getPrinters().find((p) => p.id === printerId);
    const tsplEntry = printer?.drivers.find((d) => d.type === PrinterDriverType.tspl);
    if (!printer || !tsplEntry || tsplEntry.config.type !== PrinterDriverType.tspl) return;
    savePrinters(
      getPrinters().map((p) =>
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

  return {
    getPrinters,
    addPrinter,
    updatePrinter,
    removePrinter,
    setEnabled,
    connect,
    disconnect,
    reconnect,
    reconnectAutoPrinters,
    testPrint,
    print,
    scanDevices,
    scanForConnectionType,
    connectDraft,
    getStatus,
    onStatusChange,
    getStatusForDriver,
    onStatusChangeForDriver,
    disconnectForDriver,
    discoverDriver,
    installTsplFont,
    setTsplRenderMode,
  };
};

export const PrinterService = createPrinterService(DriverRegistry);
