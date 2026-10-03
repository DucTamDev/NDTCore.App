import type { IPrinterAdapter, Unsubscribe } from '../adapters/IPrinterAdapter';
import { ConnectionType } from '../models/printer/ConnectionType';
import type { Printer } from '../models/printer/Printer';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import { PrinterErrorCode, PrinterErrorException, errorCodeOf } from '../errors/PrinterError';
import { PrinterLogger } from '../logging/PrinterLogger';
import { ensureBluetoothPermission } from '../permissions/PrinterPermissionService';
import { PrinterRepository, type createPrinterRepository } from '../storage/PrinterRepository';
import { createPrinterAdapter } from './PrinterAdapterFactory';
import { PrinterConnectionLock, lockKeyOf, type createResourceLock } from './PrinterConnectionLock';

type StatusListener = (status: PrinterStatus) => void;

/** Phụ thuộc của service, tách ra để test thay được. */
export interface PrinterConnectionServiceDeps {
  /** Tạo adapter mới cho mỗi lần kết nối. */
  createAdapter: () => IPrinterAdapter;

  /** `true` khi app đã có quyền Bluetooth. */
  ensureBluetoothPermission: () => Promise<boolean>;

  /** Nguồn máy in đã lưu cho `reconnect` và tự kết nối lại. */
  repository: Pick<ReturnType<typeof createPrinterRepository>, 'findOrThrow' | 'getPrinters'>;

  /** Khoá dùng chung với tầng in. */
  lock: ReturnType<typeof createResourceLock>;
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
export const createPrinterConnectionService = (deps: PrinterConnectionServiceDeps) => {
  const sessions = new Map<string, ConnectionSession>();
  const statuses = new Map<string, PrinterStatus>();
  const listeners = new Map<string, Set<StatusListener>>();

  const setStatus = (printerId: string, status: PrinterStatus): void => {
    statuses.set(printerId, status);
    listeners.get(printerId)?.forEach((listener) => listener(status));
  };

  const ensurePermission = async (connectionType: ConnectionType): Promise<void> => {
    if (connectionType !== ConnectionType.Bluetooth) {
      return;
    }

    if (!(await deps.ensureBluetoothPermission())) {
      throw bluetoothDenied();
    }
  };

  /** Lỗi khi trả kết nối cũ không được làm hỏng kết nối mới nên chỉ ghi log. */
  const closeQuietly = async (printerId: string, session: ConnectionSession): Promise<void> => {
    session.stopWatchingLost();

    try {
      await session.adapter.disconnect();
    } catch (error) {
      PrinterLogger.disconnectFailed({ printerId, errorCode: errorCodeOf(error) });
    }
  };

  /** Chỉ phiên còn hiệu lực mới được đổi trạng thái; adapter đã bị thay thì bỏ qua. */
  const openSession = async (printer: Printer, adapter: IPrinterAdapter): Promise<void> => {
    const printerId = printer.id;
    const lockKey = lockKeyOf(printer);
    const previous = sessions.get(printerId);
    const stopWatchingLost = adapter.onLost(() => {
      if (sessions.get(printerId)?.adapter === adapter) {
        setStatus(printerId, PrinterStatus.Disconnected);
      }
    });

    sessions.set(printerId, { adapter, lockKey, stopWatchingLost });

    if (!previous) {
      return;
    }

    // Cùng khoá thì người gọi có thể đang giữ chính khoá này (in kết nối bên trong khoá); khoá không tái nhập nên
    // chờ lại sẽ tự kẹt, đành đóng ngay.
    if (previous.lockKey === lockKey) {
      await closeQuietly(printerId, previous);
      return;
    }

    await deps.lock.runExclusive(previous.lockKey, () => closeQuietly(printerId, previous));
  };

  const requireAdapter = (printerId: string): IPrinterAdapter => {
    const session = sessions.get(printerId);

    if (!session) {
      throw notConnected();
    }

    return session.adapter;
  };

  /** Kết nối thất bại thì phiên cũ (nếu có) vẫn giữ nguyên. */
  const connect = async (printer: Printer): Promise<void> => {
    const connectionType = printer.connection.type;
    const startedAt = Date.now();
    setStatus(printer.id, PrinterStatus.Connecting);

    try {
      await ensurePermission(connectionType);
      const adapter = deps.createAdapter();
      await adapter.connect(printer.connection);
      await openSession(printer, adapter);
      setStatus(printer.id, PrinterStatus.Connected);
      PrinterLogger.connectSucceeded({ printerId: printer.id, connectionType, durationMs: Date.now() - startedAt });
    } catch (error) {
      setStatus(printer.id, PrinterStatus.Error);
      PrinterLogger.connectFailed({
        printerId: printer.id,
        connectionType,
        errorCode: errorCodeOf(error),
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  };

  /**
   * Chờ lệnh in đang chạy trên cùng máy xong rồi mới trả kết nối. Chỉ ngắt mới khoá: `connect` được `print` gọi
   * bên trong khoá của hàng đợi in và khoá không tái nhập nên khoá ở đó sẽ tự kẹt.
   */
  const disconnect = async (printerId: string): Promise<void> => {
    const session = sessions.get(printerId);

    if (!session) {
      setStatus(printerId, PrinterStatus.Disconnected);
      return;
    }

    await deps.lock.runExclusive(session.lockKey, async () => {
      // Trong lúc chờ khoá, phiên có thể đã bị một lần kết nối mới thay (và đóng) hoặc đã bị ngắt.
      if (sessions.get(printerId) !== session) {
        return;
      }

      setStatus(printerId, PrinterStatus.Disconnecting);
      sessions.delete(printerId);
      session.stopWatchingLost();

      try {
        await session.adapter.disconnect();
      } catch (error) {
        setStatus(printerId, PrinterStatus.Error);
        PrinterLogger.disconnectFailed({ printerId, errorCode: errorCodeOf(error) });
        throw error;
      }

      setStatus(printerId, PrinterStatus.Disconnected);
      PrinterLogger.disconnectSucceeded({ printerId });
    });
  };

  const send = async (printerId: string, bytes: Uint8Array): Promise<void> => requireAdapter(printerId).write(bytes);

  /** `null` khi hết `timeoutMs` mà máy in chưa trả lời. */
  const read = async (printerId: string, timeoutMs: number): Promise<Uint8Array | null> =>
    requireAdapter(printerId).read(timeoutMs);

  const getStatus = (printerId: string): PrinterStatus => statuses.get(printerId) ?? PrinterStatus.Idle;

  const onStatusChange = (printerId: string, listener: StatusListener): Unsubscribe => {
    if (!listeners.has(printerId)) {
      listeners.set(printerId, new Set());
    }

    listeners.get(printerId)?.add(listener);
    return () => listeners.get(printerId)?.delete(listener);
  };

  const reconnect = async (printerId: string): Promise<void> => {
    await disconnect(printerId).catch(() => undefined);
    await connect(deps.repository.findOrThrow(printerId));
  };

  const reconnectAutoPrinters = (): void => {
    deps.repository
      .getPrinters()
      .filter((printer) => printer.enabled && printer.autoReconnect)
      .forEach((printer) => {
        connect(printer).catch(() => undefined);
      });
  };

  return { connect, disconnect, send, read, getStatus, onStatusChange, reconnect, reconnectAutoPrinters };
};

export const PrinterConnectionService = createPrinterConnectionService({
  createAdapter: createPrinterAdapter,
  ensureBluetoothPermission,
  repository: PrinterRepository,
  lock: PrinterConnectionLock,
});
