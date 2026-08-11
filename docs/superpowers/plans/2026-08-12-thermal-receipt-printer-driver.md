# Thermal Receipt Printer Driver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `EscPosDriver` (Epson SDK) with a new `ThermalReceiptDriver` backed by `@poriyaalar/react-native-thermal-receipt-printer`, and add Bluetooth runtime permission requests to both Bluetooth-using drivers.

**Architecture:** One new driver class (`ThermalReceiptDriver`) implementing the existing `IPrinterDriver` contract, following `TsplDriver.ts`'s established pattern of branching internally on `ConnectionType`. One new shared service (`PrinterPermissionService`) requests Android Bluetooth runtime permissions, called from both `ThermalReceiptDriver` and the pre-existing `TsplDriver` (which currently has no runtime permission code at all). `DriverRegistry.escpos` is repointed to the new driver; `EscPosDriver` and its dependency are deleted outright — no factory, no per-printer provider choice, no rollback path.

**Tech Stack:** React Native (TypeScript strict), Jest, `@poriyaalar/react-native-thermal-receipt-printer`, `react-native`'s `PermissionsAndroid`.

## Global Constraints

- TypeScript strict, không dùng `any`.
- Toàn bộ text hiển thị cho người dùng: tiếng Việt.
- Chỉ file logic (services, drivers) có test file — không tạo test cho `DriverRegistry.ts` (static wiring, không test theo convention hiện tại) hay `AndroidManifest.xml`.
- Test files colocate cùng thư mục với source file — không dùng `__tests__/`.
- Không polling trạng thái kết nối — chỉ cập nhật theo lifecycle action (connect/disconnect/error), giống `EscPosDriver`/`TsplDriver` hiện tại.
- Không thêm factory/env-based provider selection — thay thế trực tiếp, không giữ đường rollback.
- Không tự claim đã test phần cứng thật — mọi khẳng định "đã verify trên máy in thật" phải đến từ người dùng, không phải từ agent.
- Chạy `npm run verify` (type-check + lint + test) trước khi coi 1 task là xong.

---

### Task 1: `PrinterPermissionService` + Android manifest permissions

**Files:**
- Create: `src/features/printer/services/PrinterPermissionService.ts`
- Create: `src/features/printer/services/PrinterPermissionService.test.ts`
- Modify: `android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Produces: `ensureBluetoothPermission(): Promise<boolean>` — resolves `true` when Bluetooth is usable (iOS/web always, Android after a granted runtime request), `false` when the user denied. Never throws for a denial.

- [ ] **Step 1: Write the failing tests**

Create `src/features/printer/services/PrinterPermissionService.test.ts`:

```ts
import { PermissionsAndroid, Platform } from 'react-native';
import { ensureBluetoothPermission } from './PrinterPermissionService';

describe('ensureBluetoothPermission', () => {
  const originalOS = Platform.OS;
  const originalVersion = Platform.Version;

  afterEach(() => {
    Platform.OS = originalOS;
    Platform.Version = originalVersion;
    jest.restoreAllMocks();
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
    });
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
    });
    const result = await ensureBluetoothPermission();
    expect(result).toBe(false);
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
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/printer/services/PrinterPermissionService.test.ts`
Expected: FAIL — `./PrinterPermissionService` doesn't exist yet (module not found).

- [ ] **Step 3: Create `src/features/printer/services/PrinterPermissionService.ts`**

```ts
import { PermissionsAndroid, Platform } from 'react-native';

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
  return Platform.Version >= 31 ? requestModernBluetoothPermissions() : requestLegacyBluetoothPermission();
}
```

- [ ] **Step 4: Run the tests again to verify they pass**

Run: `npx jest src/features/printer/services/PrinterPermissionService.test.ts`
Expected: PASS (6/6).

- [ ] **Step 5: Add Bluetooth permissions to `AndroidManifest.xml`**

In `android/app/src/main/AndroidManifest.xml`, add these lines right after the existing `<uses-permission android:name="android.permission.INTERNET" />` line:

```xml
    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

- [ ] **Step 6: Type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/printer/services/PrinterPermissionService.ts src/features/printer/services/PrinterPermissionService.test.ts android/app/src/main/AndroidManifest.xml
git commit -m "feat: add PrinterPermissionService for Bluetooth runtime permissions"
```

---

### Task 2: Wire `PrinterPermissionService` into `TsplDriver`'s Bluetooth paths

**Files:**
- Modify: `src/features/printer/drivers/TsplDriver.ts`
- Modify: `src/features/printer/drivers/TsplDriver.test.ts`

**Interfaces:**
- Consumes: `ensureBluetoothPermission(): Promise<boolean>` from `../services/PrinterPermissionService` (Task 1).

`TsplDriver` currently has no runtime Bluetooth permission handling at all — this task adds it to the two places `TsplDriver` touches Bluetooth: `scan('bluetooth')` and the `bluetooth` branch of `connect()`.

- [ ] **Step 1: Write the failing tests**

Add to `src/features/printer/drivers/TsplDriver.test.ts` (keep the existing `jest.mock` calls for `LanTransport`/`BluetoothTransport` at the top of the file, add this new mock alongside them, and add these new `it` blocks inside the existing `describe('TsplDriver', ...)` block):

```ts
jest.mock('../services/PrinterPermissionService', () => ({
  ensureBluetoothPermission: jest.fn().mockResolvedValue(true),
}));
```

```ts
  it('scan() on bluetooth checks Bluetooth permission before starting discovery', () => {
    const driver = new TsplDriver();
    driver.scan('bluetooth', () => undefined);
    const { ensureBluetoothPermission } = jest.requireMock('../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    expect(ensureBluetoothPermission).toHaveBeenCalled();
  });

  it('scan() on bluetooth reports error and does not discover when permission is denied', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockResolvedValueOnce(false);
    const driver = new TsplDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan('bluetooth', (event) => {
        events.push(event.type);
        if (event.type === 'error') resolve();
      });
    });
    expect(events).toEqual(['loading', 'error']);
  });

  it('connect() over bluetooth checks permission before delegating to BluetoothTransport', async () => {
    const btConfig: PrinterConfig = { ...lanConfig, id: 'label-bt', connectionType: 'bluetooth', lan: undefined, device: { deviceId: '00:11:22', displayName: 'Máy in tem BT', rawDevice: {} } };
    const driver = new TsplDriver();
    await driver.connect(btConfig);
    const { ensureBluetoothPermission } = jest.requireMock('../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    expect(ensureBluetoothPermission).toHaveBeenCalled();
    expect(driver.getStatus(btConfig.id)).toBe('connected');
  });

  it('connect() over bluetooth fails with CONNECTION_ERROR when permission is denied', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockResolvedValueOnce(false);
    const btConfig: PrinterConfig = { ...lanConfig, id: 'label-bt-2', connectionType: 'bluetooth', lan: undefined, device: { deviceId: '00:11:22', displayName: 'Máy in tem BT', rawDevice: {} } };
    const driver = new TsplDriver();
    await expect(driver.connect(btConfig)).rejects.toMatchObject({ code: 'CONNECTION_ERROR' });
    expect(driver.getStatus(btConfig.id)).toBe('error');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/printer/drivers/TsplDriver.test.ts`
Expected: FAIL on the 5 new cases — permission is never checked yet, so `ensureBluetoothPermission` is never called and denial is never surfaced.

- [ ] **Step 3: Update `src/features/printer/drivers/TsplDriver.ts`**

Add the import:

```ts
import { ensureBluetoothPermission } from '../services/PrinterPermissionService';
```

Change the start of `scan()`'s bluetooth branch (currently `onEvent({ type: 'loading' }); RNBluetoothClassic.startDiscovery()...`) to gate on permission first:

```ts
  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === 'lan') {
      onEvent({ type: 'empty' });
      return () => undefined;
    }
    if (connectionType === 'usb') {
      onEvent({
        type: 'error',
        error: { code: 'UNSUPPORTED_CONNECTION', message: 'USB chưa được hỗ trợ cho máy in tem' },
      });
      return () => undefined;
    }
    onEvent({ type: 'loading' });
    let cancelled = false;
    ensureBluetoothPermission()
      .then((granted) => {
        if (cancelled) return;
        if (!granted) {
          onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: 'Chưa được cấp quyền Bluetooth' } });
          return;
        }
        RNBluetoothClassic.startDiscovery()
          .then((devices) => {
            if (cancelled) return;
            onEvent({
              type: devices.length > 0 ? 'found' : 'empty',
              devices: devices.map((d) => ({
                deviceId: d.address,
                displayName: d.name ?? d.address,
                rawDevice: d as unknown as Record<string, unknown>,
              })),
            });
          })
          .catch((error: unknown) => {
            if (!cancelled) onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: String(error) } });
          });
      })
      .catch((error: unknown) => {
        if (!cancelled) onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: String(error) } });
      });
    return () => {
      cancelled = true;
      RNBluetoothClassic.cancelDiscovery().catch(() => undefined);
    };
  }
```

Change `connect()`'s bluetooth branch from:

```ts
      } else if (config.connectionType === 'bluetooth') {
        if (!config.device) {
          throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Chưa chọn thiết bị Bluetooth' });
        }
        await (transport as BluetoothTransport).connect(config.device.deviceId);
      } else {
```

to:

```ts
      } else if (config.connectionType === 'bluetooth') {
        if (!config.device) {
          throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Chưa chọn thiết bị Bluetooth' });
        }
        const granted = await ensureBluetoothPermission();
        if (!granted) {
          throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Chưa được cấp quyền Bluetooth' });
        }
        await (transport as BluetoothTransport).connect(config.device.deviceId);
      } else {
```

- [ ] **Step 4: Run the tests again to verify they pass**

Run: `npx jest src/features/printer/drivers/TsplDriver.test.ts`
Expected: PASS, all cases (existing + 5 new).

- [ ] **Step 5: Type-check and run the full test suite**

Run: `npm run type-check && npm test`
Expected: both pass, no regressions elsewhere.

- [ ] **Step 6: Commit**

```bash
git add src/features/printer/drivers/TsplDriver.ts src/features/printer/drivers/TsplDriver.test.ts
git commit -m "feat: check Bluetooth permission before TsplDriver scan/connect"
```

---

### Task 3: `ThermalReceiptDriver`

**Files:**
- Create: `src/features/printer/drivers/ThermalReceiptDriver.ts`
- Create: `src/features/printer/drivers/ThermalReceiptDriver.test.ts`

**Interfaces:**
- Consumes: `ensureBluetoothPermission(): Promise<boolean>` from `../services/PrinterPermissionService` (Task 1). `IPrinterDriver`, `ConnectionType`, `DeviceScanEvent`, `PrinterConfig`, `PrinterDeviceInfo`, `PrinterStatus` from existing `../types/*`. `USBPrinter`, `BLEPrinter`, `NetPrinter` from `@poriyaalar/react-native-thermal-receipt-printer` (added to `package.json` in Task 4 — this task's implementer must run `npm install @poriyaalar/react-native-thermal-receipt-printer` themselves before writing code that imports it, and commit the resulting `package.json`/lockfile change as part of this task, since Task 4 only removes the old dependency and wires the registry).
- Produces: `export class ThermalReceiptDriver implements IPrinterDriver` — consumed by Task 4's `DriverRegistry.ts`.

**A note on the library's actual TypeScript types:** the code below is written from the library's README (no compiled `.d.ts` has been inspected — this plan's author could not install and read the package before writing this plan). Once installed, the real method signatures/return types may differ from what's shown here in ways that don't type-check cleanly (e.g. `getDeviceList()`/`printText()`/`closeConn()` might have per-namespace return/param types that don't unify across `namespaceByConnectionType[connectionType]`'s union call, or the package may ship no types at all). If `npm run type-check` surfaces mismatches after installing, adapt the code to what the package actually exports — including adding a local ambient declaration file (e.g. `src/types/thermal-receipt-printer.d.ts`, following the existing pattern in `src/types/dom.d.ts`/`ttf.d.ts`) if the package ships no types at all — and note the deviation in your report rather than forcing the exact signatures shown here. If the mismatch is large enough that the driver's shape needs to change, stop and report NEEDS_CONTEXT rather than guessing.

- [ ] **Step 1: Install the dependency**

```bash
npm install @poriyaalar/react-native-thermal-receipt-printer
```

- [ ] **Step 2: Write the failing tests**

Create `src/features/printer/drivers/ThermalReceiptDriver.test.ts`:

```ts
import { ThermalReceiptDriver } from './ThermalReceiptDriver';
import type { PrinterConfig } from '../types/printer.types';

jest.mock('@poriyaalar/react-native-thermal-receipt-printer', () => ({
  USBPrinter: {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue(undefined),
    printText: jest.fn().mockResolvedValue(undefined),
    closeConn: jest.fn().mockResolvedValue(undefined),
  },
  BLEPrinter: {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue(undefined),
    printText: jest.fn().mockResolvedValue(undefined),
    closeConn: jest.fn().mockResolvedValue(undefined),
  },
  NetPrinter: {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue(undefined),
    printText: jest.fn().mockResolvedValue(undefined),
    closeConn: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../services/PrinterPermissionService', () => ({
  ensureBluetoothPermission: jest.fn().mockResolvedValue(true),
}));

const lanConfig: PrinterConfig = {
  id: 'receipt-lan',
  printerName: 'Máy in hoá đơn',
  protocol: 'escpos',
  protocolSource: 'auto',
  connectionType: 'lan',
  paperSize: '80mm',
  autoReconnect: false,
  isDefault: false,
  lan: { ip: '192.168.1.50', port: 9100 },
};

const bleConfig: PrinterConfig = {
  ...lanConfig,
  id: 'receipt-ble',
  connectionType: 'bluetooth',
  lan: undefined,
  device: { deviceId: '00:11:22:33:44:55', displayName: 'Máy in BLE', rawDevice: {} },
};

const usbConfig: PrinterConfig = {
  ...lanConfig,
  id: 'receipt-usb',
  connectionType: 'usb',
  lan: undefined,
  device: { deviceId: '1155:22222', displayName: 'Máy in USB', rawDevice: { vendor_id: 1155, product_id: 22222 } },
};

describe('ThermalReceiptDriver', () => {
  it('connect() over LAN transitions status idle -> connecting -> connected', async () => {
    const driver = new ThermalReceiptDriver();
    const statuses: string[] = [];
    driver.onStatusChange(lanConfig.id, (status) => statuses.push(status));
    expect(driver.getStatus(lanConfig.id)).toBe('idle');
    await driver.connect(lanConfig);
    expect(statuses).toEqual(['connecting', 'connected']);
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { connectPrinter: jest.Mock };
    };
    expect(NetPrinter.connectPrinter).toHaveBeenCalledWith({ host: '192.168.1.50', port: 9100 });
  });

  it('connect() over Bluetooth checks permission and connects with inner_mac_address', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(bleConfig);
    const { ensureBluetoothPermission } = jest.requireMock('../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    const { BLEPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      BLEPrinter: { connectPrinter: jest.Mock };
    };
    expect(ensureBluetoothPermission).toHaveBeenCalled();
    expect(BLEPrinter.connectPrinter).toHaveBeenCalledWith({ inner_mac_address: '00:11:22:33:44:55' });
    expect(driver.getStatus(bleConfig.id)).toBe('connected');
  });

  it('connect() over Bluetooth fails with CONNECTION_ERROR when permission is denied', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockResolvedValueOnce(false);
    const driver = new ThermalReceiptDriver();
    await expect(driver.connect(bleConfig)).rejects.toMatchObject({ code: 'CONNECTION_ERROR' });
    expect(driver.getStatus(bleConfig.id)).toBe('error');
  });

  it('connect() over USB reads vendorID/productId from the scanned rawDevice', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(usbConfig);
    const { USBPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      USBPrinter: { connectPrinter: jest.Mock };
    };
    expect(USBPrinter.connectPrinter).toHaveBeenCalledWith({ vendorID: 1155, productId: 22222 });
  });

  it('disconnect() closes the connection and sets status disconnected', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    await driver.disconnect(lanConfig.id);
    expect(driver.getStatus(lanConfig.id)).toBe('disconnected');
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { closeConn: jest.Mock };
    };
    expect(NetPrinter.closeConn).toHaveBeenCalled();
  });

  it('scan("lan") reports empty immediately without calling the library', () => {
    const driver = new ThermalReceiptDriver();
    const events: string[] = [];
    driver.scan('lan', (event) => events.push(event.type));
    expect(events).toEqual(['empty']);
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { getDeviceList: jest.Mock };
    };
    expect(NetPrinter.getDeviceList).not.toHaveBeenCalled();
  });

  it('scan("bluetooth") checks permission before calling BLEPrinter.getDeviceList', async () => {
    const driver = new ThermalReceiptDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan('bluetooth', (event) => {
        events.push(event.type);
        if (event.type !== 'loading') resolve();
      });
    });
    expect(events).toEqual(['loading', 'empty']);
    const { BLEPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      BLEPrinter: { getDeviceList: jest.Mock };
    };
    expect(BLEPrinter.getDeviceList).toHaveBeenCalled();
  });

  it('testPrint() reuses an already-open connection instead of reconnecting', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { connectPrinter: jest.Mock; printText: jest.Mock };
    };
    const callsBeforeTestPrint = NetPrinter.connectPrinter.mock.calls.length;
    await driver.testPrint(lanConfig);
    expect(NetPrinter.connectPrinter.mock.calls.length).toBe(callsBeforeTestPrint);
    expect(NetPrinter.printText).toHaveBeenCalled();
  });

  it('identify() returns null when not connected', async () => {
    const driver = new ThermalReceiptDriver();
    const result = await driver.identify('never-connected');
    expect(result).toBeNull();
  });

  it('identify() returns a non-null PrinterDeviceInfo when connected', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    const result = await driver.identify(lanConfig.id);
    expect(result).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/features/printer/drivers/ThermalReceiptDriver.test.ts`
Expected: FAIL — `./ThermalReceiptDriver` doesn't exist yet.

- [ ] **Step 4: Create `src/features/printer/drivers/ThermalReceiptDriver.ts`**

```ts
import { USBPrinter, BLEPrinter, NetPrinter } from '@poriyaalar/react-native-thermal-receipt-printer';
import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type { ConnectionType, DeviceScanEvent, PrinterConfig, PrinterDeviceInfo, PrinterStatus } from '../types/printer.types';
import { AppErrorException } from '../../../types/AppError';
import { ensureBluetoothPermission } from '../services/PrinterPermissionService';

interface UsbRawDevice {
  vendor_id: number;
  product_id: number;
}

const namespaceByConnectionType = {
  usb: USBPrinter,
  bluetooth: BLEPrinter,
  lan: NetPrinter,
} as const;

/**
 * Driver ESC/POS cho máy in hoá đơn, dùng `@poriyaalar/react-native-thermal-receipt-printer`.
 * Khác với Epson SDK (1 class `Printer` dùng chung mọi connectionType), thư
 * viện này export 3 namespace độc lập (USBPrinter/BLEPrinter/NetPrinter) mỗi
 * cái có API riêng — driver này chọn namespace theo `connectionType`, giống
 * cách `TsplDriver` chọn transport.
 */
export class ThermalReceiptDriver implements IPrinterDriver {
  private connectedTypes = new Map<string, ConnectionType>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();
  private initialized = new Set<ConnectionType>();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  private async ensureInitialized(connectionType: ConnectionType): Promise<void> {
    if (this.initialized.has(connectionType)) return;
    await namespaceByConnectionType[connectionType].init();
    this.initialized.add(connectionType);
  }

  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === 'lan') {
      onEvent({ type: 'empty' });
      return () => undefined;
    }
    if (connectionType === 'usb' && Platform.OS !== 'android') {
      onEvent({
        type: 'error',
        error: { code: 'UNSUPPORTED_CONNECTION', message: 'USB chỉ hỗ trợ trên Android' },
      });
      return () => undefined;
    }

    let cancelled = false;
    onEvent({ type: 'loading' });

    const run = async (): Promise<void> => {
      if (connectionType === 'bluetooth') {
        const granted = await ensureBluetoothPermission();
        if (cancelled) return;
        if (!granted) {
          onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: 'Chưa được cấp quyền Bluetooth' } });
          return;
        }
      }
      try {
        await this.ensureInitialized(connectionType);
        if (cancelled) return;
        const devices = await namespaceByConnectionType[connectionType].getDeviceList();
        if (cancelled) return;
        onEvent({
          type: devices.length > 0 ? 'found' : 'empty',
          devices: devices.map((device: Record<string, unknown>) => ({
            deviceId: String(
              connectionType === 'bluetooth' ? device.inner_mac_address : device.device_id ?? device.vendor_id,
            ),
            displayName: String(device.device_name ?? 'Máy in'),
            rawDevice: device,
          })),
        });
      } catch (error) {
        if (!cancelled) onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: String(error) } });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }

  async connect(config: PrinterConfig): Promise<void> {
    this.setStatus(config.id, 'connecting');
    try {
      if (config.connectionType === 'bluetooth') {
        const granted = await ensureBluetoothPermission();
        if (!granted) {
          throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Chưa được cấp quyền Bluetooth' });
        }
      }
      await this.ensureInitialized(config.connectionType);

      if (config.connectionType === 'lan') {
        if (!config.lan) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Thiếu cấu hình IP/Port' });
        await NetPrinter.connectPrinter({ host: config.lan.ip, port: config.lan.port });
      } else if (config.connectionType === 'bluetooth') {
        if (!config.device) {
          throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Chưa chọn thiết bị Bluetooth' });
        }
        await BLEPrinter.connectPrinter({ inner_mac_address: config.device.deviceId });
      } else {
        const raw = config.device?.rawDevice as unknown as UsbRawDevice | undefined;
        if (!raw) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Thiếu thông tin thiết bị USB' });
        await USBPrinter.connectPrinter({ vendorID: raw.vendor_id, productId: raw.product_id });
      }

      this.connectedTypes.set(config.id, config.connectionType);
      this.setStatus(config.id, 'connected');
    } catch (error) {
      this.setStatus(config.id, 'error');
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, 'disconnecting');
    const connectionType = this.connectedTypes.get(printerId);
    if (connectionType) {
      await namespaceByConnectionType[connectionType].closeConn();
    }
    this.connectedTypes.delete(printerId);
    this.setStatus(printerId, 'disconnected');
  }

  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? 'idle';
  }

  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe {
    if (!this.listeners.has(printerId)) this.listeners.set(printerId, new Set());
    this.listeners.get(printerId)?.add(callback);
    return () => this.listeners.get(printerId)?.delete(callback);
  }

  async testPrint(config: PrinterConfig): Promise<void> {
    if (!this.connectedTypes.has(config.id)) {
      await this.connect(config);
    }
    const connectionType = this.connectedTypes.get(config.id);
    if (!connectionType) return;
    await namespaceByConnectionType[connectionType].printText('<C>NDTCore POS - In thu\n</C>');
  }

  async identify(printerId: string): Promise<PrinterDeviceInfo | null> {
    return this.connectedTypes.has(printerId) ? {} : null;
  }
}
```

Add the missing `Platform` import at the top:

```ts
import { Platform } from 'react-native';
```

- [ ] **Step 5: Run the tests again to verify they pass**

Run: `npx jest src/features/printer/drivers/ThermalReceiptDriver.test.ts`
Expected: PASS (10/10).

- [ ] **Step 6: Type-check and run the full test suite**

Run: `npm run type-check && npm test`
Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/features/printer/drivers/ThermalReceiptDriver.ts src/features/printer/drivers/ThermalReceiptDriver.test.ts
git commit -m "feat: add ThermalReceiptDriver implementing IPrinterDriver"
```

---

### Task 4: Cut over `DriverRegistry` and remove `EscPosDriver`

**Files:**
- Modify: `src/features/printer/services/DriverRegistry.ts`
- Delete: `src/features/printer/drivers/EscPosDriver.ts`
- Delete: `src/features/printer/drivers/EscPosDriver.test.ts`
- Modify: `package.json` (remove `react-native-esc-pos-printer`)

**Interfaces:**
- Consumes: `ThermalReceiptDriver` from `../drivers/ThermalReceiptDriver` (Task 3).

- [ ] **Step 1: Update `src/features/printer/services/DriverRegistry.ts`**

```ts
// src/features/printer/services/DriverRegistry.ts
import type { IPrinterDriver } from '../types/driver.types';
import type { Protocol } from '../types/printer.types';
import { ThermalReceiptDriver } from '../drivers/ThermalReceiptDriver';
import { TsplDriver } from '../drivers/TsplDriver';

export const DriverRegistry: Record<Protocol, IPrinterDriver> = {
  escpos: new ThermalReceiptDriver(),
  tspl: new TsplDriver(),
};
```

- [ ] **Step 2: Delete the old driver and its test**

```bash
git rm src/features/printer/drivers/EscPosDriver.ts src/features/printer/drivers/EscPosDriver.test.ts
```

- [ ] **Step 3: Remove `react-native-esc-pos-printer` from `package.json`**

Remove the `"react-native-esc-pos-printer": "..."` line from the `dependencies` object, then:

```bash
npm install
```

to regenerate `package-lock.json` without it.

- [ ] **Step 4: Confirm nothing else references the removed driver or package**

Run: `grep -rn "EscPosDriver\|react-native-esc-pos-printer" src/ android/ ios/ package.json`
Expected: no output (the grep itself may still find this plan file if run from the repo root without excluding `docs/` — restrict the search to `src/`, `android/`, `ios/`, and `package.json` as shown, not the whole repo).

- [ ] **Step 5: Run the full verify suite**

Run: `npm run verify`
Expected: type-check, lint, and all tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: cut DriverRegistry over to ThermalReceiptDriver, remove EscPosDriver"
```

**Note for the human running this plan on macOS:** this plan is executed in a Windows environment with no Xcode/CocoaPods, so `pod install` for `ios/` cannot be run as part of any task here. After this task lands, run `cd ios && pod install` on a Mac to drop the old Epson pod and link the new package before building for iOS.

---

### Task 5: Hardware acceptance checklist

**Files:**
- Create: `docs/superpowers/specs/2026-08-12-thermal-receipt-printer-hardware-acceptance.md`

This is a written checklist, not code — nothing in this plan can verify it. It exists so the human tester has an exact, unambiguous list instead of "test it and see."

- [ ] **Step 1: Write the checklist**

Create `docs/superpowers/specs/2026-08-12-thermal-receipt-printer-hardware-acceptance.md`:

```markdown
# Thermal Receipt Printer Driver — Hardware Acceptance Checklist

Run against real hardware before treating `feat/thermal-receipt-printer-driver`
as production-ready. None of these have been verified by the agent that wrote
the driver — verify each yourself and record pass/fail + notes.

## Android

- [ ] USB: scan finds a connected USB thermal printer, connect succeeds, test
      print produces readable output.
- [ ] Bluetooth: permission prompt appears on first scan (fresh install),
      scan finds a paired/nearby printer, connect succeeds, test print
      produces readable output.
- [ ] Bluetooth, permission denied: deny the prompt — app shows an error
      state, does not hang or crash.
- [ ] LAN: enter IP/port manually, connect succeeds, test print produces
      readable output.
- [ ] Vietnamese diacritics ("Cà phê sữa đá", "Trà đào cam sả") print
      correctly, not as `?` or mojibake.
- [ ] Reconnect after force-closing and reopening the app, for each
      connection type above.

## iOS

- [ ] Bluetooth: system permission prompt appears, scan finds a
      paired/nearby printer, connect succeeds, test print produces readable
      output.
- [ ] LAN: enter IP/port manually, connect succeeds, test print produces
      readable output.
- [ ] Vietnamese diacritics print correctly.
- [ ] Reconnect after force-closing and reopening the app, for LAN and
      Bluetooth.
- [ ] Confirm USB is correctly reported as unsupported (no crash, a clear
      Vietnamese error message) since the library doesn't support USB on iOS.

## Sign-off

Record the printer model(s), connection type(s), and Android/iOS versions
tested, plus the date and who ran the checklist.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-08-12-thermal-receipt-printer-hardware-acceptance.md
git commit -m "docs: add hardware acceptance checklist for thermal receipt printer driver"
```

---

### Task 6: Final automated verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full verify suite one more time from a clean state**

Run: `npm run verify`
Expected: type-check, lint, and all tests pass, with zero references to `EscPosDriver`/`react-native-esc-pos-printer` remaining anywhere in `src/`.

- [ ] **Step 2: Confirm the web build still compiles**

Run: `npm run build:web` (or `npm run web` and check the compiled output for errors, per this project's established manual-verification pattern for web builds).
Expected: compiles successfully — `DriverRegistry.web.ts` is untouched by this plan, so the web bundle should never attempt to import `@poriyaalar/react-native-thermal-receipt-printer`; this step exists to catch an accidental cross-import.

- [ ] **Step 3: Report status**

Automated verification is complete once Steps 1–2 pass. The hardware acceptance checklist (Task 5) is separate and remains the user's responsibility — do not report this plan as "done" in a way that implies hardware has been verified.

---
