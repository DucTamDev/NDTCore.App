import type { IPrinterAdapter, Unsubscribe } from '../adapters/IPrinterAdapter';
import { ConnectionType } from '../models/printer/ConnectionType';
import type { Printer } from '../models/printer/Printer';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import { DeviceErrorCode } from '../errors';
import { DeviceErrorException, errorCodeOf } from '../exceptions';
import { printerLogger } from '../logging/PrinterLogger';
import { ensureBluetoothPermission } from '../permissions/PrinterPermissionService';
import { printerRepository, type PrinterRepository } from '../storage/PrinterRepository';
import { LoggerService } from '../../../services/LoggerService';
import { createPrinterAdapter } from './PrinterAdapterFactory';
import { printerConnectionLock, lockKeyOf, type ResourceLock } from './PrinterConnectionLock';

/** Nơi nhận trạng thái mới của một máy in. */
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
  /** Adapter đang giữ kết nối này. */
  adapter: IPrinterAdapter;

  /** Khoá của máy vật lý mà phiên này đang giữ. */
  lockKey: string;

  /** Huỷ lắng nghe mất kết nối của `adapter`. */
  stopWatchingLost: Unsubscribe;
}

const notConnected = (): DeviceErrorException =>
  new DeviceErrorException({ code: DeviceErrorCode.NOT_CONNECTED, message: 'Máy in chưa kết nối' });

const bluetoothDenied = (): DeviceErrorException =>
  new DeviceErrorException({ code: DeviceErrorCode.PERMISSION_DENIED, message: 'Chưa được cấp quyền Bluetooth' });

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

  /**
   * Lượt kết nối mới nhất theo `printerId`. `connect` nhớ lượt của mình; lượt bị thay (có `connect` mới hơn hoặc
   * `disconnect`) thì không được đổi trạng thái hay giữ kết nối nữa.
   */
  private readonly attempts = new Map<string, number>();

  /** Bộ đếm sinh mã lượt, tăng dần cho mọi máy. */
  private attemptCounter = 0;

  constructor(private readonly deps: PrinterConnectionServiceDeps) {}

  /**
   * Kết nối thất bại thì phiên cũ (nếu có) vẫn giữ nguyên. Lượt đã bị thay (bởi `connect` mới hơn hoặc `disconnect`)
   * thì trả lại kết nối vừa mở và không đổi trạng thái.
   */
  async connect(printer: Printer): Promise<void> {
    const printerId = printer.id;
    const connectionType = printer.connection.type;
    const startedAt = Date.now();
    const attempt = this.beginAttempt(printerId);
    this.setStatus(printerId, PrinterStatus.Connecting);

    try {
      await this.ensurePermission(connectionType);
      const adapter = this.deps.createAdapter();
      await adapter.connect(printer.connection);

      if (!this.isCurrentAttempt(printerId, attempt)) {
        await adapter.disconnect().catch(() => undefined);
        return;
      }

      await this.openSession(printer, adapter);

      if (!this.isCurrentAttempt(printerId, attempt)) {
        return;
      }

      this.setStatus(printerId, PrinterStatus.Connected);
      printerLogger.connectSucceeded({ printerId, connectionType, durationMs: Date.now() - startedAt });
    } catch (error) {
      if (this.isCurrentAttempt(printerId, attempt)) {
        this.setStatus(printerId, PrinterStatus.Error);
      }

      printerLogger.connectFailed({
        printerId,
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
    this.beginAttempt(printerId);
    const session = this.sessions.get(printerId);

    if (!session) {
      this.setStatus(printerId, PrinterStatus.Disconnected);
      return;
    }

    await this.deps.lock.runExclusive(session.lockKey, () => this.closeSession(printerId, session));
  }

  /** Chưa kết nối (hoặc đã mất kết nối) thì báo `NOT_CONNECTED`. */
  async send(printerId: string, bytes: Uint8Array): Promise<void> {
    return this.requireAdapter(printerId).write(bytes);
  }

  /** `null` khi hết `timeoutMs` mà máy in chưa trả lời. */
  async read(printerId: string, timeoutMs: number): Promise<Uint8Array | null> {
    return this.requireAdapter(printerId).read(timeoutMs);
  }

  /** Máy chưa từng kết nối là `Idle`. */
  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? PrinterStatus.Idle;
  }

  /** Chỉ nhận các lần đổi trạng thái sau khi đăng ký, không nhận trạng thái hiện tại. */
  onStatusChange(printerId: string, listener: StatusListener): Unsubscribe {
    const listeners = this.listeners.get(printerId) ?? new Set<StatusListener>();
    listeners.add(listener);
    this.listeners.set(printerId, listeners);

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0 && this.listeners.get(printerId) === listeners) {
        this.listeners.delete(printerId);
      }
    };
  }

  /** Ngắt (bỏ qua lỗi ngắt) rồi kết nối lại bằng cấu hình đã lưu của máy in. */
  async reconnect(printerId: string): Promise<void> {
    await this.disconnect(printerId).catch(() => undefined);
    await this.connect(this.deps.repository.findOrThrow(printerId));
  }

  /** Gọi khi app khởi động: kết nối mọi máy đang bật và cho phép tự kết nối lại; lỗi từng máy bỏ qua. */
  reconnectAutoPrinters(): void {
    this.deps.repository
      .getPrinters()
      .filter((printer) => printer.enabled && printer.autoReconnect)
      .forEach((printer) => {
        this.connect(printer).catch(() => undefined);
      });
  }

  private beginAttempt(printerId: string): number {
    this.attemptCounter += 1;
    this.attempts.set(printerId, this.attemptCounter);
    return this.attemptCounter;
  }

  private isCurrentAttempt(printerId: string, attempt: number): boolean {
    return this.attempts.get(printerId) === attempt;
  }

  /** Một listener lỗi không được làm hỏng việc kết nối đang chạy hay chặn các listener khác. */
  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((listener) => {
      try {
        listener(status);
      } catch (error) {
        LoggerService.warning('printer.connection.status-listener-failed', {
          printerId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
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

  private async openSession(printer: Printer, adapter: IPrinterAdapter): Promise<void> {
    const printerId = printer.id;
    const lockKey = lockKeyOf(printer);
    const previous = this.sessions.get(printerId);
    const stopWatchingLost = adapter.onLost(() => this.handleLost(printerId, adapter));

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

  /**
   * Bỏ phiên ngay để `send`/`read` báo `NOT_CONNECTED` thay vì gọi vào kết nối đã chết. Adapter đã bị thay thì bỏ qua.
   */
  private handleLost(printerId: string, adapter: IPrinterAdapter): void {
    const session = this.sessions.get(printerId);

    if (session?.adapter !== adapter) {
      return;
    }

    this.sessions.delete(printerId);
    this.setStatus(printerId, PrinterStatus.Disconnected);
    this.closeQuietly(printerId, session);
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
