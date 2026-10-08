import type { IPrinterAdapter } from '../adapters/IPrinterAdapter';
import { NativeAdapter } from '../adapters/native/NativeAdapter';

/** Mọi loại kết nối (USB, Bluetooth, LAN) đều đi qua native module của app. */
export const createPrinterAdapter = (): IPrinterAdapter => new NativeAdapter();
