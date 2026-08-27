import { PermissionsAndroid, Platform } from 'react-native';
import { ensureBluetoothPermission } from '../PrinterPermissionService';
import { PrinterLogger } from '../PrinterLogger';
import { ConnectionType } from '../../types/printer.types';

jest.mock('../PrinterLogger', () => ({
  PrinterLogger: {
    permissionDenied: jest.fn(),
  },
}));

jest.mock('react-native', () => ({
  PermissionsAndroid: {
    PERMISSIONS: {
      BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
      BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
    },
    requestMultiple: jest.fn(),
    request: jest.fn(),
  },
  Platform: {
    OS: 'android',
    Version: 30,
  },
}));

describe('ensureBluetoothPermission', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    Platform.OS = 'android';
    Platform.Version = 30;
  });

  it('returns true immediately on iOS without requesting anything', async () => {
    Platform.OS = 'ios';
    const spy = jest.spyOn(PermissionsAndroid, 'requestMultiple');
    const result = await ensureBluetoothPermission();
    expect(result).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns true immediately on web without requesting anything', async () => {
    Platform.OS = 'web';
    const spy = jest.spyOn(PermissionsAndroid, 'requestMultiple');
    const result = await ensureBluetoothPermission();
    expect(result).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('requests BLUETOOTH_SCAN + BLUETOOTH_CONNECT on Android API 31+, returns true when both granted', async () => {
    Platform.OS = 'android';
    Platform.Version = 31;
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
      [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]: PermissionsAndroid.RESULTS.GRANTED,
      [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]: PermissionsAndroid.RESULTS.GRANTED,
    } as unknown as Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>);
    const result = await ensureBluetoothPermission();
    expect(result).toBe(true);
    expect(PermissionsAndroid.requestMultiple).toHaveBeenCalledWith([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
  });

  it('returns false on Android API 31+ when either permission is denied', async () => {
    Platform.OS = 'android';
    Platform.Version = 31;
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
      [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]: PermissionsAndroid.RESULTS.GRANTED,
      [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]: PermissionsAndroid.RESULTS.DENIED,
    } as unknown as Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>);
    const result = await ensureBluetoothPermission();
    expect(result).toBe(false);
    expect(PrinterLogger.permissionDenied).toHaveBeenCalledWith({ connectionType: ConnectionType.bluetooth });
  });

  it('requests ACCESS_FINE_LOCATION on Android below API 31, returns true when granted', async () => {
    Platform.OS = 'android';
    Platform.Version = 30;
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
    const result = await ensureBluetoothPermission();
    expect(result).toBe(true);
    expect(PermissionsAndroid.request).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  });

  it('returns false on Android below API 31 when location is denied', async () => {
    Platform.OS = 'android';
    Platform.Version = 30;
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
    const result = await ensureBluetoothPermission();
    expect(result).toBe(false);
    expect(PrinterLogger.permissionDenied).toHaveBeenCalledWith({ connectionType: ConnectionType.bluetooth });
  });

  it('does not log permissionDenied when permission is granted', async () => {
    Platform.OS = 'android';
    Platform.Version = 31;
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
      [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]: PermissionsAndroid.RESULTS.GRANTED,
      [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]: PermissionsAndroid.RESULTS.GRANTED,
    } as unknown as Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>);
    await ensureBluetoothPermission();
    expect(PrinterLogger.permissionDenied).not.toHaveBeenCalled();
  });
});
