import { PermissionsAndroid, Platform } from 'react-native';
import { PrinterLogger } from './PrinterLogger';
import { ConnectionType } from '../types/printer.types';

async function requestModernBluetoothPermissions(): Promise<boolean> {
  const results = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  ]);
  return (
    results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
    results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
  );
}

async function requestLegacyBluetoothPermission(): Promise<boolean> {
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Android 12+ (API 31) dùng model quyền Bluetooth mới (BLUETOOTH_SCAN/
 * BLUETOOTH_CONNECT); dưới đó phải xin ACCESS_FINE_LOCATION vì discovery
 * Bluetooth cổ điển được xem là có thể suy ra vị trí. iOS/web không cần xin
 * qua JS — hệ thống tự hỏi khi API Bluetooth native được gọi lần đầu.
 */
export async function ensureBluetoothPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  const granted =
    Platform.Version >= 31 ? await requestModernBluetoothPermissions() : await requestLegacyBluetoothPermission();
  if (!granted) {
    PrinterLogger.permissionDenied({ connectionType: ConnectionType.bluetooth });
  }
  return granted;
}
