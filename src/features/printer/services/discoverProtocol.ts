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
 * `undefined` cho LAN vì không có scan), trả về candidate list của luật khớp
 * đầu tiên. Luật fallback bắt-tất-cả đảm bảo luôn có kết quả.
 */
export const resolveCandidates = (
  hintText: string | undefined,
  rules: PrinterDetectionRule[] = PRINTER_DETECTION_RULES,
): Protocol[] => {
  const text = hintText ?? '';
  const rule = rules.find((r) => r.vendorMatch.test(text) && (!r.modelMatch || r.modelMatch.test(text)));
  return rule?.candidates ?? ['escpos', 'tspl'];
};

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
      const candidates = resolveCandidates(input.device?.displayName).filter((protocol) => Boolean(registry[protocol]));
      let connectFailures = 0;

      for (const protocol of candidates) {
        if (cancelled) return;
        const driver = registry[protocol];
        const config = buildDraftConfig(input, protocol);
        onEvent({ stage: 'connecting', protocol });
        try {
          await driver.connect(config);
        } catch {
          connectFailures += 1;
          continue;
        }
        if (cancelled) return;
        onEvent({ stage: 'identifying', protocol });
        const deviceInfo = await driver.identify(input.printerId).catch(() => null);
        if (cancelled) return;
        if (deviceInfo) {
          onEvent({ stage: 'identified', protocol, deviceInfo });
          return;
        }
        await driver.disconnect(input.printerId).catch(() => undefined);
      }

      if (cancelled) return;
      if (candidates.length > 0 && connectFailures === candidates.length) {
        onEvent({ stage: 'error', error: { code: 'CONNECTION_ERROR', message: 'Không thể kết nối tới máy in' } });
        return;
      }
      onEvent({ stage: 'unknown_protocol' });
    };

    run();

    return () => {
      cancelled = true;
    };
  };
