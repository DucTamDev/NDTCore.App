// src/features/printer/printing/PrinterService.ts
import type { IPrinterDriver, PrintDocumentVariants, Unsubscribe } from '../types/driver.types';
import type { ConnectionType, DeviceScanEvent, Printer, PrinterDriver, PrinterDriverType, PrinterStatus, TsplFontConfig } from '../types/printer.types';
import type { PrintType } from '../types/printConfiguration.types';
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
    if (!found) throw new Error(`Không tìm thấy máy in với id ${printerId}`);
    return found;
  };

  const assertNoDuplicateIdentity = (printer: Printer): void => {
    const collision = getPrinters().find((p) => p.id !== printer.id && p.identityKey === printer.identityKey);
    if (collision) {
      throw new Error(`Máy in này đã được thêm với tên "${collision.name}" — dùng "+ Thêm driver" trên máy in đó thay vì thêm mới.`);
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

  const testPrint = async (printer: Printer, driver: PrinterDriver, documents: PrintDocumentVariants, printType?: PrintType): Promise<void> => {
    await lock.runExclusive(resourceKeyFor(printer, driver.type), () => getDriver(driver.type).testPrint(printer, driver, documents, printType));
  };

  const print = async (printerId: string, documents: PrintDocumentVariants, printType?: PrintType): Promise<void> => {
    const printer = findOrThrow(printerId);
    const driverEntry = printer.drivers.find((d) => (printType ? d.contentTypes.includes(printType) : true));
    if (!driverEntry) throw new Error(`Máy in ${printerId} không có driver nào nhận in ${printType ?? '(không rõ loại)'}`);
    const driver = getDriver(driverEntry.type);
    if (driver.getStatus(printerId) !== 'connected') {
      await driver.connect(printer, driverEntry);
    }
    await driver.print(printerId, documents, printType);
  };

  const scanDevices = (type: PrinterDriverType, connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe =>
    getDriver(type).scan(connectionType, onEvent);

  const scanForConnectionType = (connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe => {
    if (connectionType === 'usb') return getDriver('escpos').scan('usb', onEvent);
    if (connectionType === 'bluetooth') return getDriver('tspl').scan('bluetooth', onEvent);
    return getDriver('tspl').scan('lan', onEvent);
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
    return statuses.find((s) => s === 'connected') ?? statuses[0] ?? 'idle';
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
   * Passthrough TSPL-riêng — KHÔNG đưa vào `IPrinterDriver` chung vì tính
   * năng này chỉ có nghĩa với TSPL, ESC/POS không có khái niệm font custom.
   * Cast trực tiếp sang `TsplDriver` vì `registry.tspl` luôn là instance đó.
   */
  const installTsplFont = async (printerId: string, font: TsplFontConfig): Promise<void> => {
    const tsplDriver = getDriver('tspl') as TsplDriver;
    await tsplDriver.installTrueTypeFont(printerId, font);
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
  };
};

export const PrinterService = createPrinterService(DriverRegistry);
