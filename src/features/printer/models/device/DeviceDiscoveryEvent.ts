import type { PrinterFeatureException } from '../../exceptions';
import type { DiscoveredDevice } from './DiscoveredDevice';

/** Loại cập nhật trong lúc tìm thiết bị. */
export const DeviceDiscoveryEventType = { Loading: 'Loading', Found: 'Found', Empty: 'Empty', Error: 'Error' } as const;

export type DeviceDiscoveryEventType = (typeof DeviceDiscoveryEventType)[keyof typeof DeviceDiscoveryEventType];

/** Một cập nhật trong lúc tìm thiết bị. */
export type DeviceDiscoveryEvent =
  | { type: typeof DeviceDiscoveryEventType.Loading }
  | { type: typeof DeviceDiscoveryEventType.Found; devices: DiscoveredDevice[] }
  | { type: typeof DeviceDiscoveryEventType.Empty }
  | { type: typeof DeviceDiscoveryEventType.Error; error: PrinterFeatureException };
