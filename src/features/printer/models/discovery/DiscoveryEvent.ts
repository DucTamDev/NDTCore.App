import type { PrinterFeatureException } from '../../exceptions';
import type { DeviceInfo } from '../device/DeviceInfo';
import type { DiscoveryStatus } from './DiscoveryStatus';

/** Một cập nhật trong lúc tìm thiết bị. */
export type DiscoveryEvent =
  | { status: typeof DiscoveryStatus.Loading }
  | { status: typeof DiscoveryStatus.Found; devices: DeviceInfo[] }
  | { status: typeof DiscoveryStatus.Empty }
  | { status: typeof DiscoveryStatus.Error; error: PrinterFeatureException };
