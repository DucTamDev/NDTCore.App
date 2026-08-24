import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type {
  ConnectionType,
  PrinterConfig,
  PrinterDevice,
  PrinterDeviceInfo,
  PrinterLanConfig,
  Protocol,
} from '../types/printer.types';
import type { AppError } from '../types/AppError';
import { PrinterLogger } from './PrinterLogger';

/**
 * Thử `tspl` trước `escpos`: `TsplDriver.identify()` là 1 discriminator thật
 * (gửi lệnh dò trạng thái `~!T` qua LAN/Bluetooth và chờ phản hồi), trong khi
 * `escpos`'s `identify()` (sau khi trả `device_name` thật) vẫn chỉ chứng minh
 * được "đã connect thành công", không phải "đúng là máy in ESC/POS". Qua USB,
 * cả 2 driver luôn trả `null` (native module không đọc được phản hồi) nên
 * discovery qua USB luôn rơi vào `unknown_protocol`, bắt buộc người dùng chọn
 * thủ công — đây là hành vi cố ý, không phải thiếu rule nhận diện.
 */
const CANDIDATE_ORDER: Protocol[] = ['tspl', 'escpos'];

export type DiscoveryStage = 'connecting' | 'identifying' | 'identified' | 'unknown_protocol' | 'error';

export interface DiscoveryEvent {
  stage: DiscoveryStage;
  protocol?: Protocol;
  deviceInfo?: PrinterDeviceInfo;
  error?: AppError;
}

export interface DiscoveryInput {
  printerId: string;
  connectionType: ConnectionType;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
}

/**
 * Tra `rules` theo `hintText` (tên/model thiết bị đã biết trước khi connect —
 * `undefined` cho LAN vì không có scan), trả về nguyên luật khớp đầu tiên (cần
 * cả `confidence`/`modelMatch` cho cổng dual-mode ở `run()`, không chỉ
 * `candidates`). Luật fallback bắt-tất-cả đảm bảo luôn có kết quả.
 */
const buildDraftConfig = (input: DiscoveryInput, protocol: Protocol): PrinterConfig => ({
  id: input.printerId,
  printerName: input.device?.displayName ?? input.lan?.ip ?? 'Máy in mới',
  protocol,
  protocolSource: 'auto',
  connectionType: input.connectionType,
  paperSize: '80mm',
  autoReconnect: false,
  isDefault: false,
  device: input.device,
  lan: input.lan,
});

export const createDiscoverProtocol =
  (registry: Record<Protocol, IPrinterDriver>) =>
  (input: DiscoveryInput, onEvent: (event: DiscoveryEvent) => void): Unsubscribe => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      const startedAt = Date.now();
      const candidates = CANDIDATE_ORDER.filter((protocol) => Boolean(registry[protocol]));
      const candidatesTried: Protocol[] = [];
      let connectFailures = 0;

      PrinterLogger.discoveryStarted({ printerId: input.printerId, connectionType: input.connectionType, candidates });

      for (const protocol of candidates) {
        if (cancelled) return;
        candidatesTried.push(protocol);
        const driver = registry[protocol];
        const config = buildDraftConfig(input, protocol);
        const disconnectQuietly = (): Promise<void> => driver.disconnect(input.printerId).catch(() => undefined);
        onEvent({ stage: 'connecting', protocol });
        try {
          await driver.connect(config);
        } catch {
          connectFailures += 1;
          PrinterLogger.discoveryCandidateRejected({
            printerId: input.printerId,
            protocol,
            connectionType: input.connectionType,
            reason: 'connect_failed',
          });
          continue;
        }
        // Wizard có thể bị đóng (unsubscribe) trong lúc connect()/identify()
        // đang chạy — connect() ở trên đã thành công nên phải disconnect()
        // trước khi return, nếu không kết nối native sẽ rò vĩnh viễn.
        if (cancelled) {
          await disconnectQuietly();
          return;
        }
        onEvent({ stage: 'identifying', protocol });
        const deviceInfo = await driver.identify(input.printerId).catch(() => null);
        if (cancelled) {
          await disconnectQuietly();
          return;
        }
        if (deviceInfo) {
          onEvent({ stage: 'identified', protocol, deviceInfo });
          PrinterLogger.protocolDetected({
            printerId: input.printerId,
            protocol,
            connectionType: input.connectionType,
            candidatesTried,
            durationMs: Date.now() - startedAt,
          });
          return;
        }
        PrinterLogger.discoveryCandidateRejected({
          printerId: input.printerId,
          protocol,
          connectionType: input.connectionType,
          reason: 'not_confirmed',
        });
        await disconnectQuietly();
      }

      if (cancelled) return;
      if (candidates.length > 0 && connectFailures === candidates.length) {
        onEvent({ stage: 'error', error: { code: 'CONNECTION_ERROR', message: 'Không thể kết nối tới máy in' } });
        PrinterLogger.discoveryFailed({
          printerId: input.printerId,
          connectionType: input.connectionType,
          candidatesTried,
          durationMs: Date.now() - startedAt,
        });
        return;
      }
      onEvent({ stage: 'unknown_protocol' });
      PrinterLogger.protocolUnknown({
        printerId: input.printerId,
        connectionType: input.connectionType,
        candidatesTried,
        durationMs: Date.now() - startedAt,
      });
    };

    run();

    return () => {
      cancelled = true;
    };
  };
