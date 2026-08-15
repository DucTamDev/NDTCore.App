// src/features/printer/services/PrinterService.ts
import { StorageService } from '../../../services/StorageService';
import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type {
  ConnectionType,
  DeviceScanEvent,
  PrinterConfig,
  PrinterStatus,
  Protocol,
} from '../types/printer.types';
import type { PrintDocument } from '../types/printDocument.types';
import { DriverRegistry } from './DriverRegistry';
import { createDiscoverProtocol, type DiscoveryEvent, type DiscoveryInput } from './discoverProtocol';

const PRINTER_LIST_KEY = 'printer.list';
const PRINTER_DEFAULT_KEY = 'printer.defaultId';

export const createPrinterService = (registry: Record<Protocol, IPrinterDriver>) => {
  const getDriver = (protocol: Protocol): IPrinterDriver => registry[protocol];
  const discoverProtocolFn = createDiscoverProtocol(registry);

  const getPrinters = (): PrinterConfig[] =>
    (StorageService.getItem<PrinterConfig[]>(PRINTER_LIST_KEY) ?? []).map((p) => ({
      ...p,
      enabled: p.enabled ?? true,
    }));

  const savePrinters = (printers: PrinterConfig[]): void => {
    StorageService.setItem(PRINTER_LIST_KEY, printers);
  };

  const findOrThrow = (printerId: string): PrinterConfig => {
    const found = getPrinters().find((p) => p.id === printerId);
    if (!found) throw new Error(`Không tìm thấy máy in với id ${printerId}`);
    return found;
  };

  const getDefaultPrinterId = (): string | null => StorageService.getItem<string>(PRINTER_DEFAULT_KEY);

  const addPrinter = (config: PrinterConfig): void => {
    savePrinters([...getPrinters(), config]);
    if (config.isDefault) StorageService.setItem(PRINTER_DEFAULT_KEY, config.id);
  };

  const updatePrinter = (config: PrinterConfig): void => {
    savePrinters(getPrinters().map((p) => (p.id === config.id ? config : p)));
  };

  const removePrinter = (printerId: string): void => {
    savePrinters(getPrinters().filter((p) => p.id !== printerId));
    if (getDefaultPrinterId() === printerId) StorageService.removeItem(PRINTER_DEFAULT_KEY);
  };

  const setDefault = (printerId: string): void => {
    savePrinters(getPrinters().map((p) => ({ ...p, isDefault: p.id === printerId })));
    StorageService.setItem(PRINTER_DEFAULT_KEY, printerId);
  };

  const setEnabled = (printerId: string, enabled: boolean): void => {
    savePrinters(getPrinters().map((p) => (p.id === printerId ? { ...p, enabled } : p)));
  };

  const connect = async (printerId: string): Promise<void> => {
    const config = findOrThrow(printerId);
    await getDriver(config.protocol).connect(config);
  };

  const disconnect = async (printerId: string): Promise<void> => {
    const config = findOrThrow(printerId);
    await getDriver(config.protocol).disconnect(printerId);
  };

  const reconnect = async (printerId: string): Promise<void> => {
    await disconnect(printerId).catch(() => undefined);
    await connect(printerId);
  };

  const testPrint = async (config: PrinterConfig): Promise<void> => {
    await getDriver(config.protocol).testPrint(config);
  };

  /**
   * In tài liệu tuỳ ý — tự động kết nối trước nếu máy in chưa kết nối (cùng
   * cách tiếp cận "connect-if-needed" như `TsplDriver.testPrint()`), vì các
   * driver `print()` (khác với `testPrint()`) đều throw `CONNECTION_ERROR`
   * nếu chưa có kết nối được theo dõi cho `printerId` — nếu không, việc in
   * sẽ luôn thất bại ở phiên làm việc mới cho tới khi người dùng bấm "Kết
   * nối" thủ công từ danh sách máy in.
   */
  const print = async (printerId: string, document: PrintDocument): Promise<void> => {
    const config = findOrThrow(printerId);
    const driver = getDriver(config.protocol);
    if (driver.getStatus(printerId) !== 'connected') {
      await driver.connect(config);
    }
    await driver.print(printerId, document);
  };

  const scanDevices = (
    protocol: Protocol,
    connectionType: ConnectionType,
    onEvent: (event: DeviceScanEvent) => void,
  ): Unsubscribe => getDriver(protocol).scan(connectionType, onEvent);

  /**
   * Scan thiết bị cho wizard TRƯỚC khi biết protocol (mục "Key Architecture
   * Decision" đầu plan): Bluetooth dùng scan tổng quát của TsplDriver
   * (RNBluetoothClassic trực tiếp, không phụ thuộc SDK hãng nào); USB chỉ
   * ThermalReceiptDriver hỗ trợ scan (TsplDriver luôn báo lỗi UNSUPPORTED_CONNECTION
   * cho USB — kiến trúc TSPL-qua-USB chưa được hỗ trợ, Phase 1 §4.3).
   */
  const scanForConnectionType = (
    connectionType: ConnectionType,
    onEvent: (event: DeviceScanEvent) => void,
  ): Unsubscribe => {
    if (connectionType === 'usb') return getDriver('escpos').scan('usb', onEvent);
    if (connectionType === 'bluetooth') return getDriver('tspl').scan('bluetooth', onEvent);
    return getDriver('tspl').scan('lan', onEvent);
  };

  /**
   * Connect thẳng bằng driver ứng với `config.protocol`, KHÔNG đọc/ghi
   * storage — dùng khi wizard đã biết protocol (do người dùng chọn thủ công
   * sau khi discoverProtocol() trả `unknown_protocol`) nhưng máy in chưa
   * được lưu (`addPrinter`/`updatePrinter`) nên `findOrThrow` sẽ không tìm
   * thấy.
   */
  const connectDraft = async (config: PrinterConfig): Promise<void> => {
    await getDriver(config.protocol).connect(config);
  };

  /**
   * Disconnect thẳng bằng driver ứng với `protocol`, KHÔNG đọc storage — dùng
   * khi wizard hủy bỏ (dismiss) một kết nối nháp (`connectDraft`/`discoverProtocol`
   * đã mở) mà chưa lưu, nên `disconnect(printerId)` (storage-backed) sẽ throw.
   */
  const disconnectForProtocol = async (protocol: Protocol, printerId: string): Promise<void> => {
    await getDriver(protocol).disconnect(printerId);
  };

  const getStatus = (printerId: string): PrinterStatus => {
    const config = findOrThrow(printerId);
    return getDriver(config.protocol).getStatus(printerId);
  };

  const onStatusChange = (printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe => {
    const config = findOrThrow(printerId);
    return getDriver(config.protocol).onStatusChange(printerId, callback);
  };

  /**
   * Biến thể của `getStatus`/`onStatusChange` dùng khi `printerId` chưa được
   * lưu vào storage (trong lúc wizard đang chạy) nên không thể tra `protocol`
   * qua `findOrThrow` — protocol đã biết trực tiếp từ `discoverProtocol()`.
   */
  const getStatusForProtocol = (protocol: Protocol, printerId: string): PrinterStatus =>
    getDriver(protocol).getStatus(printerId);

  const onStatusChangeForProtocol = (
    protocol: Protocol,
    printerId: string,
    callback: (status: PrinterStatus) => void,
  ): Unsubscribe => getDriver(protocol).onStatusChange(printerId, callback);

  const discoverProtocol = (input: DiscoveryInput, onEvent: (event: DiscoveryEvent) => void): Unsubscribe =>
    discoverProtocolFn(input, onEvent);

  return {
    getPrinters,
    getDefaultPrinterId,
    addPrinter,
    updatePrinter,
    removePrinter,
    setDefault,
    setEnabled,
    connect,
    disconnect,
    reconnect,
    testPrint,
    print,
    scanDevices,
    scanForConnectionType,
    connectDraft,
    getStatus,
    onStatusChange,
    getStatusForProtocol,
    onStatusChangeForProtocol,
    disconnectForProtocol,
    discoverProtocol,
  };
};

export const PrinterService = createPrinterService(DriverRegistry);
