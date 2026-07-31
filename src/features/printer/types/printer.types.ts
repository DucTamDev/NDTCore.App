import type { AppError } from '../../../types/AppError';

export type Protocol = 'escpos' | 'tspl';
export type ConnectionType = 'usb' | 'bluetooth' | 'lan';
export type PaperSize = '58mm' | '80mm';
export type ProtocolSource = 'auto' | 'manual';

export type PrinterStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

export interface PrinterDevice {
  deviceId: string;
  displayName: string;
  rawDevice: Record<string, unknown>;
}

export interface PrinterLanConfig {
  ip: string;
  port: number;
}

export interface PrinterDeviceInfo {
  deviceName?: string;
  vendor?: string;
  model?: string;
}

export interface PrinterConfig {
  id: string;
  printerName: string;
  protocol: Protocol;
  protocolSource: ProtocolSource;
  connectionType: ConnectionType;
  paperSize: PaperSize;
  autoReconnect: boolean;
  isDefault: boolean;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
  deviceInfo?: PrinterDeviceInfo;
}

export type DeviceScanEventType = 'loading' | 'found' | 'empty' | 'error';

export interface DeviceScanEvent {
  type: DeviceScanEventType;
  devices?: PrinterDevice[];
  error?: AppError;
}
