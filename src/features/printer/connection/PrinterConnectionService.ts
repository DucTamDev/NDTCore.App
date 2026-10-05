import type { IPrinterAdapter, Unsubscribe } from '../adapters/IPrinterAdapter';
import { ConnectionType } from '../models/printer/ConnectionType';
import type { Printer } from '../models/printer/Printer';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import { PrinterErrorCode } from '../errors/PrinterErrorCode';
import { PrinterErrorException, errorCodeOf } from '../exceptions/PrinterErrorException';
import { printerLogger } from '../logging/PrinterLogger';
import { ensureBluetoothPermission } from '../permissions/PrinterPermissionService';
import { printerRepository, type PrinterRepository } from '../storage/PrinterRepository';
import { createPrinterAdapter } from './PrinterAdapterFactory';
import { printerConnectionLock, lockKeyOf, type ResourceLock } from './PrinterConnectionLock';

type StatusListener = (status: PrinterStatus) => void;

/** Phụ thuộc của service, tách ra để test thay được. */
export interface PrinterConnectionServiceDeps {
  /** Tạo adapter mới cho mỗi lần kết nối. */
  createAdapter: () => IPrinterAdapter;

  /** `true` khi app đã có quyền Bluetooth. */
  ensureBluetoothPermission: () => Promise<boolean>;

  /** Nguồn máy in đã lưu cho `reconnect` và tự kết nối lại. */
  repository: Pick<PrinterRepository, 'findOrThrow' | 'getPrinters'>;

  /** Khoá dùng chung với tầng in. */
  lock: Pick<ResourceLock, 'runExclusive'>;
}

/** Kết nối đang mở của một máy in. */
interface ConnectionSession {
  adapter: IPrinterAdapter;

  /** Khoá của máy vật lý mà phiên này đang giữ. */
  lockKey: string;

  /** Huỷ lắng nghe mất kết nối của `adapter`. */
  stopWatchingLost: Unsubscribe;
}

const notConnected = (): PrinterErrorException =>
  new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối' });

const bluetoothDenied = (): PrinterErrorException =>
  new PrinterErrorException({
    code: PrinterErrorCode.PRINTER_CONNECTION_FAILED,
    message: 'Chưa được cấp quyền Bluetooth',
  });

/**
 * Kết nối của từng máy in (đã lưu hoặc bản nháp) theo `printerId`: mở, đóng, gửi byte, đọc phản hồi và trạng thái.
 * Không biết ngôn ngữ in; khoá theo máy vật lý do tầng in giữ.
 */
export class PrinterConnectionService {
  /** Phiên đang mở theo `printerId`. */
  private readonly sessions = new Map<string, ConnectionSession>();

  /** Trạng thái theo `printerId`; máy chưa từng kết nối không có mục nào (coi là `Idle`). */
  private readonly statuses = new Map<string, PrinterStatus>();

  /** Nơi nghe đổi trạng thái theo `printerId`. */
  private readonly listeners = new Map<string, Set<StatusListener>>();

  constructor(private readonly deps: PrinterConnectionServiceDeps) {}

  /** Kết nối thất bại thì phiên cũ (nếu có) vẫn giữ nguyên. */
  async connect(printer: Printer): Promise<void> {
    const connectionType = printer.connection.type;
    const startedAt = Date.now();
    this.setStatus(printer.id, PrinterStatus.Connecting);

    try {
      await this.ensurePermission(connectionType);
      const adapter = this.deps.createAdapter();
      await adapter.connect(printer.connection);
      await this.openSession(printer, adapter);
      this.setStatus(printer.id, PrinterStatus.Connected);
      printerLogger.connectSucceeded({ printerId: printer.id, connectionType, durationMs: Date.now() - startedAt });
    } catch (error) {
      this.setStatus(printer.id, PrinterStatus.Error);
      printerLogger.connectFailed({
        printerId: printer.id,
        connectionType,
        errorCode: errorCodeOf(error),
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  /**
   * Chờ lệnh in đang chạy trên cùng máy xong rồi mới trả kết nối. Chỉ ngắt mới khoá: `connect` được `print` gọi
   * bên trong khoá của hàng đợi in và khoá không tái nhập nên khoá ở đó sẽ tự kẹt.
   */
  async disconnect(printerId: string): Promise<void> {
    const session = this.sessions.get(printerId);

    if (!session) {
      this.setStatus(printerId, PrinterStatus.Disconnected);
      return;
    }

    await this.deps.lock.runExclusive(session.lockKey, () => this.closeSession(printerId, session));
  }

  async send(printerId: string, bytes: Uint8Array): Promise<void> {
    return this.requireAdapter(printerId).write(bytes);
  }

  /** `null` khi hết `timeoutMs` mà máy in chưa trả lời. */
  async read(printerId: string, timeoutMs: number): Promise<Uint8Array | null> {
    return this.requireAdapter(printerId).read(timeoutMs);
  }

  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? PrinterStatus.Idle;
  }

  onStatusChange(printerId: string, listener: StatusListener): Unsubscribe {
    if (!this.listeners.has(printerId)) {
      this.listeners.set(printerId, new Set());
    }

    this.listeners.get(printerId)?.add(listener);
    return () => this.listeners.get(printerId)?.delete(listener);
  }

  async reconnect(printerId: string): Promise<void> {
    await this.disconnect(printerId).catch(() => undefined);
    await this.connect(this.deps.repository.findOrThrow(printerId));
  }

  reconnectAutoPrinters(): void {
    this.deps.repository
      .getPrinters()
      .filter((printer) => printer.enabled && printer.autoReconnect)
      .forEach((printer) => {
        this.connect(printer).catch(() => undefined);
      });
  }

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((listener) => listener(status));
  }

  private async ensurePermission(connectionType: ConnectionType): Promise<void> {
    if (connectionType !== ConnectionType.Bluetooth) {
      return;
    }

    if (!(await this.deps.ensureBluetoothPermission())) {
      throw bluetoothDenied();
    }
  }

  /** Lỗi khi trả kết nối cũ không được làm hỏng kết nối mới nên chỉ ghi log. */
  private async closeQuietly(printerId: string, session: ConnectionSession): Promise<void> {
    session.stopWatchingLost();

    try {
      await session.adapter.disconnect();
    } catch (error) {
      printerLogger.disconnectFailed({ printerId, errorCode: errorCodeOf(error) });
    }
  }

  /** Chỉ phiên còn hiệu lực mới được đổi trạng thái; adapter đã bị thay thì bỏ qua. */
  private async openSession(printer: Printer, adapter: IPrinterAdapter): Promise<void> {
    const printerId = printer.id;
    const lockKey = lockKeyOf(printer);
    const previous = this.sessions.get(printerId);
    const stopWatchingLost = adapter.onLost(() => {
      if (this.sessions.get(printerId)?.adapter === adapter) {
        this.setStatus(printerId, PrinterStatus.Disconnected);
      }
    });

    this.sessions.set(printerId, { adapter, lockKey, stopWatchingLost });

    if (!previous) {
      return;
    }

    // Cùng khoá thì người gọi có thể đang giữ chính khoá này (in kết nối bên trong khoá); khoá không tái nhập nên
    // chờ lại sẽ tự kẹt, đành đóng ngay.
    if (previous.lockKey === lockKey) {
      await this.closeQuietly(printerId, previous);
      return;
    }

    await this.deps.lock.runExclusive(previous.lockKey, () => this.closeQuietly(printerId, previous));
  }

  /** Chạy trong khoá của máy; trong lúc chờ khoá, phiên có thể đã bị một lần kết nối mới thay hoặc đã bị ngắt. */
  private async closeSession(printerId: string, session: ConnectionSession): Promise<void> {
    if (this.sessions.get(printerId) !== session) {
      return;
    }

    this.setStatus(printerId, PrinterStatus.Disconnecting);
    this.sessions.delete(printerId);
    session.stopWatchingLost();

    try {
      await session.adapter.disconnect();
    } catch (error) {
      this.setStatus(printerId, PrinterStatus.Error);
      printerLogger.disconnectFailed({ printerId, errorCode: errorCodeOf(error) });
      throw error;
    }

    this.setStatus(printerId, PrinterStatus.Disconnected);
    printerLogger.disconnectSucceeded({ printerId });
  }

  private requireAdapter(printerId: string): IPrinterAdapter {
    const session = this.sessions.get(printerId);

    if (!session) {
      throw notConnected();
    }

    return session.adapter;
  }
}

export const printerConnectionService = new PrinterConnectionService({
  createAdapter: createPrinterAdapter,
  ensureBluetoothPermission,
  repository: printerRepository,
  lock: printerConnectionLock,
});
