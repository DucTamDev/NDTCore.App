import { Platform } from 'react-native';
import type { IPrinterDriver, Unsubscribe } from '../IPrinterDriver';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { PrinterStatus } from '../../models/printer/PrinterStatus';
import { DeviceScanEventType } from '../../models/printer/PrinterDevice';
import type { DeviceScanEvent, PrinterDeviceInfo } from '../../models/printer/PrinterDevice';
import type { Printer } from '../../models/printer/Printer';
import { PrinterErrorCode } from '../../errors/PrinterError';
import { ensureBluetoothPermission } from '../../permissions/PrinterPermissionService';
import { PrinterLogger } from '../../logging/PrinterLogger';
import { LoggerService } from '../../../../services/LoggerService';
import { createPrinterAdapter } from '../../connection/createPrinterAdapter';
import { PrinterConnectionService } from '../../connection/PrinterConnectionService';

/** Quét USB/Bluetooth qua native và xác nhận yếu ESC/POS sau khi kết nối. */
export class EscPosDriver implements IPrinterDriver {
  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === ConnectionType.Lan) {
      onEvent({ type: DeviceScanEventType.Empty });
      return () => undefined;
    }

    if (connectionType === ConnectionType.Usb && Platform.OS !== 'android') {
      onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION, message: 'USB chỉ hỗ trợ trên Android' } });
      return () => undefined;
    }

    let cancelled = false;
    onEvent({ type: DeviceScanEventType.Loading });
    const startedAt = Date.now();

    const run = async (): Promise<void> => {
      try {
        if (connectionType === ConnectionType.Bluetooth) {
          const granted = await ensureBluetoothPermission();

          if (cancelled) {
            return;
          }

          if (!granted) {
            onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Chưa được cấp quyền Bluetooth' } });
            return;
          }
        }

        const devices = await createPrinterAdapter().listDevices(connectionType);

        if (cancelled) {
          return;
        }

        LoggerService.debug('EscPosDriver.scan: devices', { connectionType, devices });
        onEvent({ type: devices.length > 0 ? DeviceScanEventType.Found : DeviceScanEventType.Empty, devices });
        PrinterLogger.scanCompleted({ connectionType, deviceCount: devices.length, durationMs: Date.now() - startedAt });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);

        if (/no device found/i.test(message)) {
          onEvent({ type: DeviceScanEventType.Empty });
          PrinterLogger.scanCompleted({ connectionType, deviceCount: 0, durationMs: Date.now() - startedAt });
          return;
        }

        onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message } });
        PrinterLogger.scanFailed({ connectionType, errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED, durationMs: Date.now() - startedAt });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }

  /** ESC/POS không có phản hồi định danh: Bluetooth/LAN kết nối được coi như xác nhận yếu, USB thì không. */
  async identify(printer: Printer): Promise<PrinterDeviceInfo | null> {
    if (printer.connection.type === ConnectionType.Usb) {
      return null;
    }

    return PrinterConnectionService.getStatus(printer.id) === PrinterStatus.Connected ? {} : null;
  }
}
