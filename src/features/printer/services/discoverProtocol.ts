import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type {
  ConnectionType,
  PrinterConfig,
  PrinterDevice,
  PrinterDeviceInfo,
  PrinterLanConfig,
  Protocol,
} from '../types/printer.types';
import type { AppError } from '../../../types/AppError';
import { PRINTER_DETECTION_RULES, type PrinterDetectionRule } from '../constants/printerDetectionRules';
import { PrinterLogger } from './PrinterLogger';

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
export const resolveDetectionRule = (
  hintText: string | undefined,
  rules: PrinterDetectionRule[] = PRINTER_DETECTION_RULES,
): PrinterDetectionRule => {
  const text = hintText ?? '';
  return (
    rules.find((r) => r.vendorMatch.test(text) && (!r.modelMatch || r.modelMatch.test(text))) ?? {
      vendorMatch: /.*/,
      candidates: ['tspl', 'escpos'],
      confidence: 'low',
    }
  );
};

export const resolveCandidates = (
  hintText: string | undefined,
  rules: PrinterDetectionRule[] = PRINTER_DETECTION_RULES,
): Protocol[] => resolveDetectionRule(hintText, rules).candidates;

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
      const rule = resolveDetectionRule(input.device?.displayName);
      if (rule.modelMatch && rule.confidence === 'low' && rule.candidates.length > 1) {
        onEvent({ stage: 'unknown_protocol' });
        PrinterLogger.protocolUnknown({ printerId: input.printerId, connectionType: input.connectionType });
        return;
      }
      const candidates = rule.candidates.filter((protocol) => Boolean(registry[protocol]));
      let connectFailures = 0;

      for (const protocol of candidates) {
        if (cancelled) return;
        const driver = registry[protocol];
        const config = buildDraftConfig(input, protocol);
        const disconnectQuietly = (): Promise<void> => driver.disconnect(input.printerId).catch(() => undefined);
        onEvent({ stage: 'connecting', protocol });
        try {
          await driver.connect(config);
        } catch {
          connectFailures += 1;
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
          PrinterLogger.protocolDetected({ printerId: input.printerId, protocol, connectionType: input.connectionType });
          return;
        }
        await disconnectQuietly();
      }

      if (cancelled) return;
      if (candidates.length > 0 && connectFailures === candidates.length) {
        onEvent({ stage: 'error', error: { code: 'CONNECTION_ERROR', message: 'Không thể kết nối tới máy in' } });
        return;
      }
      onEvent({ stage: 'unknown_protocol' });
      PrinterLogger.protocolUnknown({ printerId: input.printerId, connectionType: input.connectionType });
    };

    run();

    return () => {
      cancelled = true;
    };
  };
