import type { IPrinterDriver } from '../drivers/IPrinterDriver';
import { LanguageSelection, PrintLanguage, RasterSource } from '../models/printer/PrinterLanguage';
import type { PrinterLanguage } from '../models/printer/PrinterLanguage';
import type { Printer } from '../models/printer/Printer';
import type { PrinterDeviceInfo } from '../models/printer/PrinterDevice';
import { PrinterErrorCode, type PrinterError } from '../errors/PrinterError';
import { PrinterLogger } from '../logging/PrinterLogger';
import { getDriverCapabilities } from '../drivers/DriverCapabilities';

/**
 * Thử `Tspl` trước `EscPos`: `TsplDriver.identify()` là 1 discriminator thật
 * (gửi lệnh dò `~!T`), trong khi ESC/POS's `identify()` chỉ chứng minh "đã
 * connect thành công". Qua USB cả 2 driver luôn trả `null` — cố ý.
 */
const CANDIDATE_ORDER: PrintLanguage[] = [PrintLanguage.Tspl, PrintLanguage.EscPos];

export const DiscoveryStage = {
  Connecting: 'Connecting',
  Identifying: 'Identifying',
  Identified: 'Identified',
  UnknownProtocol: 'UnknownProtocol',
  Error: 'Error',
} as const;

export type DiscoveryStage = (typeof DiscoveryStage)[keyof typeof DiscoveryStage];

export interface DiscoveryEvent {
  stage: DiscoveryStage;
  protocol?: PrintLanguage;
  /** Ngôn ngữ đã xác nhận, chỉ có khi `stage === 'Identified'`; nơi gọi gán thẳng vào `printer.language`. */
  language?: PrinterLanguage;
  deviceInfo?: PrinterDeviceInfo;
  error?: PrinterError;
}

export interface DiscoverPrinterInput {
  /**
   * Draft `Printer` ĐẦY ĐỦ (id, connection, type, paper, driver placeholder,
   * v.v.) do caller (`useProtocolDiscovery`) tự dựng — service này KHÔNG tự
   * tổng hợp draft. `draftPrinter.language` là placeholder, bị GHI ĐÈ theo từng
   * candidate lúc thử — chỉ `draftPrinter.type`/`.connection`/`.paper` được
   * dùng nguyên vẹn. Candidate bị lọc theo `getDriverCapabilities(type).contentTypes`
   * có chứa `draftPrinter.type` hay không (vd ESC/POS không được thử khi `type === Label`).
   */
  draftPrinter: Printer;
}

export type Unsubscribe = () => void;

export const createDiscoverDriver =
  (registry: Record<PrintLanguage, IPrinterDriver>) =>
  (input: DiscoverPrinterInput, onEvent: (event: DiscoveryEvent) => void): Unsubscribe => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      const startedAt = Date.now();
      const { draftPrinter } = input;
      const printerId = draftPrinter.id;
      const connectionType = draftPrinter.connection.type;
      const candidates = CANDIDATE_ORDER.filter(
        (type) => Boolean(registry[type]) && getDriverCapabilities(type).contentTypes.includes(draftPrinter.kind),
      );
      const candidatesTried: PrintLanguage[] = [];
      let connectFailures = 0;

      PrinterLogger.discoveryStarted({ printerId, connectionType, candidates });

      for (const type of candidates) {
        if (cancelled) {
          return;
        }

        candidatesTried.push(type);
        const driver = registry[type];
        const attemptLanguage: PrinterLanguage = {
          type,
          selection: LanguageSelection.Auto,
          renderMode: getDriverCapabilities(type).defaultConfig.renderMode,
          rasterSource: RasterSource.Image,
        };
        const attemptPrinter: Printer = { ...draftPrinter, language: attemptLanguage };
        const disconnectQuietly = (): Promise<void> => driver.disconnect(printerId).catch(() => undefined);
        onEvent({ stage: DiscoveryStage.Connecting, protocol: type });

        try {
          await driver.connect(attemptPrinter);
        } catch {
          connectFailures += 1;
          PrinterLogger.discoveryCandidateRejected({ printerId, protocol: type, connectionType, reason: 'connect_failed' });
          continue;
        }

        if (cancelled) {
          await disconnectQuietly();
          return;
        }

        onEvent({ stage: DiscoveryStage.Identifying, protocol: type });
        const deviceInfo = await driver.identify(printerId).catch(() => null);

        if (cancelled) {
          await disconnectQuietly();
          return;
        }

        if (deviceInfo) {
          onEvent({ stage: DiscoveryStage.Identified, protocol: type, language: attemptLanguage, deviceInfo });
          PrinterLogger.protocolDetected({ printerId, protocol: type, connectionType, candidatesTried, durationMs: Date.now() - startedAt });
          return;
        }

        PrinterLogger.discoveryCandidateRejected({ printerId, protocol: type, connectionType, reason: 'not_confirmed' });
        await disconnectQuietly();
      }

      if (cancelled) {
        return;
      }

      if (candidates.length === 0 || connectFailures === candidates.length) {
        onEvent({ stage: DiscoveryStage.Error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Không thể kết nối tới máy in' } });
        PrinterLogger.discoveryFailed({ printerId, connectionType, candidatesTried, durationMs: Date.now() - startedAt });
        return;
      }

      onEvent({ stage: DiscoveryStage.UnknownProtocol });
      PrinterLogger.protocolUnknown({ printerId, connectionType, candidatesTried, durationMs: Date.now() - startedAt });
    };

    run();

    return () => {
      cancelled = true;
    };
  };
