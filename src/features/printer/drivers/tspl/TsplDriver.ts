import RNBluetoothClassic from 'react-native-bluetooth-classic';
import type { IPrinterDriver, Unsubscribe } from '../IPrinterDriver';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { DeviceScanEventType } from '../../models/printer/PrinterDevice';
import type { DeviceScanEvent, PrinterDeviceInfo } from '../../models/printer/PrinterDevice';
import type { Printer } from '../../models/printer/Printer';
import { TsplLanguage } from '../../languages/tspl/TsplLanguage';
import { PrinterConnectionService } from '../../connection/PrinterConnectionService';
import { PrinterErrorCode } from '../../errors/PrinterError';
import { ensureBluetoothPermission } from '../../permissions/PrinterPermissionService';
import { PrinterLogger } from '../../logging/PrinterLogger';

/** Máy TSPL trả lời lệnh dò trong vài trăm mili giây; quá hạn coi như không phải TSPL. */
const IDENTIFY_TIMEOUT_MS = 1000;

/** Quét Bluetooth bằng thư viện và xác nhận TSPL bằng lệnh dò sau khi kết nối. */
export class TsplDriver implements IPrinterDriver {
  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === ConnectionType.Lan) {
      onEvent({ type: DeviceScanEventType.Empty });
      return () => undefined;
    }

    if (connectionType === ConnectionType.Usb) {
      onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION, message: 'TsplDriver không tự quét USB' } });
      return () => undefined;
    }

    onEvent({ type: DeviceScanEventType.Loading });
    let cancelled = false;
    const startedAt = Date.now();

    ensureBluetoothPermission()
      .then((granted) => {
        if (cancelled) {
          return;
        }

        if (!granted) {
          onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Chưa được cấp quyền Bluetooth' } });
          return;
        }

        RNBluetoothClassic.startDiscovery()
          .then((devices) => {
            if (cancelled) {
              return;
            }

            onEvent({
              type: devices.length > 0 ? DeviceScanEventType.Found : DeviceScanEventType.Empty,
              devices: devices.map((d) => ({ deviceId: d.address, displayName: d.name ?? d.address, rawDevice: d as unknown as Record<string, unknown> })),
            });
            PrinterLogger.scanCompleted({ connectionType, deviceCount: devices.length, durationMs: Date.now() - startedAt });
          })
          .catch((error: unknown) => {
            if (cancelled) {
              return;
            }

            onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: String(error) } });
            PrinterLogger.scanFailed({ connectionType, errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED, durationMs: Date.now() - startedAt });
          });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: String(error) } });
        PrinterLogger.scanFailed({ connectionType, errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED, durationMs: Date.now() - startedAt });
      });

    return () => {
      cancelled = true;
      RNBluetoothClassic.cancelDiscovery().catch(() => undefined);
    };
  }

  /** Chưa kết nối hoặc máy không trả lời lệnh dò thì không xác nhận. */
  async identify(printer: Printer): Promise<PrinterDeviceInfo | null> {
    const probe = TsplLanguage.identifyProbe;

    if (!probe) {
      return null;
    }

    try {
      await PrinterConnectionService.send(printer.id, probe.command);
      const response = await PrinterConnectionService.read(printer.id, IDENTIFY_TIMEOUT_MS);
      return response && probe.matches(response) ? {} : null;
    } catch {
      return null;
    }
  }
}
