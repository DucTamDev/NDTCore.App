# Thermal Receipt Driver Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `EscPosDriver` (`react-native-esc-pos-printer`, Epson SDK) with `ThermalReceiptDriver` (`@poriyaalar/react-native-thermal-receipt-printer`) as the `escpos` protocol's driver, porting already-designed work from `feat/thermal-receipt-printer-driver` and newly authoring the `print(printerId, document)` method that branch never needed.

**Architecture:** Add `PrinterLogger` (structured tracing over `LoggerService`) and `PrinterPermissionService` (shared Bluetooth runtime permission) as new, dependency-free services first; wire both into the existing `TsplDriver` as a standalone patch; build `ThermalReceiptDriver` against them (ported, then extended with a freshly-designed `print()`); only then cut `DriverRegistry` over and delete `EscPosDriver`, so the tree compiles and all tests pass after every task.

**Tech Stack:** React Native CLI + TypeScript strict, Jest, `@poriyaalar/react-native-thermal-receipt-printer` (already installed, v1.4.2).

**Spec:** `docs/superpowers/specs/2026-08-15-thermal-receipt-driver-migration-design.md`

## Global Constraints

- TypeScript strict, no `any`.
- Toàn bộ text hiển thị cho người dùng: tiếng Việt.
- UI component không bao giờ gọi driver/`DriverRegistry` trực tiếp — luôn qua `PrinterService`/`PrintService` (unaffected by this plan — no UI files touched).
- File logic (services, drivers) có `.test.ts`.
- `PrinterLogger` params limited to `printerId`/`protocol`/`connectionType`/`errorCode`/`durationMs` — never MAC, IP, raw device object, or receipt content.
- No barcode/qrCode/image support in `ThermalReceiptDriver.print()` — throws `ENCODING_FAILED`, matching how `EscPosDriver` already handles a genuinely-unsupported element type.
- No factory, env var, or per-printer provider selection — full replacement, no rollback path kept.

---

### Task 1: `PrinterLogger`

**Files:**
- Create: `src/features/printer/services/PrinterLogger.ts`
- Create: `src/features/printer/services/PrinterLogger.test.ts`

**Interfaces:**
- Consumes: `LoggerService.{info,warning,error}` (existing, `src/services/LoggerService.ts`), `AppErrorCode` (existing, `src/types/AppError.ts`), `ConnectionType`/`Protocol` (existing, `src/features/printer/types/printer.types.ts`).
- Produces: `PrinterLogger.{scanCompleted, scanFailed, connectSucceeded, connectFailed, disconnectSucceeded, testPrintSucceeded, testPrintFailed, permissionDenied, protocolDetected, protocolUnknown, printSucceeded, printFailed}` — every later task in this plan imports `PrinterLogger` from this exact path and calls these exact method names.

- [ ] **Step 1: Write the failing test**

Create `src/features/printer/services/PrinterLogger.test.ts`:

```ts
import { LoggerService } from '../../../services/LoggerService';
import { PrinterLogger } from './PrinterLogger';

jest.mock('../../../services/LoggerService', () => ({
  LoggerService: {
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

describe('PrinterLogger', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('scanCompleted logs an info event with connectionType/deviceCount/durationMs', () => {
    PrinterLogger.scanCompleted({ connectionType: 'bluetooth', deviceCount: 3, durationMs: 120 });
    expect(LoggerService.info).toHaveBeenCalledWith('printer.scan.completed', {
      connectionType: 'bluetooth',
      deviceCount: 3,
      durationMs: 120,
    });
  });

  it('scanFailed logs a warning event with connectionType/errorCode/durationMs', () => {
    PrinterLogger.scanFailed({ connectionType: 'usb', errorCode: 'CONNECTION_ERROR', durationMs: 50 });
    expect(LoggerService.warning).toHaveBeenCalledWith('printer.scan.failed', {
      connectionType: 'usb',
      errorCode: 'CONNECTION_ERROR',
      durationMs: 50,
    });
  });

  it('connectSucceeded logs an info event with printerId/protocol/connectionType/durationMs', () => {
    PrinterLogger.connectSucceeded({ printerId: 'p1', protocol: 'escpos', connectionType: 'lan', durationMs: 200 });
    expect(LoggerService.info).toHaveBeenCalledWith('printer.connect.succeeded', {
      printerId: 'p1',
      protocol: 'escpos',
      connectionType: 'lan',
      durationMs: 200,
    });
  });

  it('connectFailed logs a warning event with printerId/protocol/connectionType/errorCode/durationMs', () => {
    PrinterLogger.connectFailed({
      printerId: 'p1',
      protocol: 'tspl',
      connectionType: 'bluetooth',
      errorCode: 'CONNECTION_ERROR',
      durationMs: 300,
    });
    expect(LoggerService.warning).toHaveBeenCalledWith('printer.connect.failed', {
      printerId: 'p1',
      protocol: 'tspl',
      connectionType: 'bluetooth',
      errorCode: 'CONNECTION_ERROR',
      durationMs: 300,
    });
  });

  it('disconnectSucceeded logs an info event with printerId/protocol', () => {
    PrinterLogger.disconnectSucceeded({ printerId: 'p1', protocol: 'escpos' });
    expect(LoggerService.info).toHaveBeenCalledWith('printer.disconnect.succeeded', {
      printerId: 'p1',
      protocol: 'escpos',
    });
  });

  it('testPrintSucceeded logs an info event with printerId/protocol/durationMs', () => {
    PrinterLogger.testPrintSucceeded({ printerId: 'p1', protocol: 'escpos', durationMs: 400 });
    expect(LoggerService.info).toHaveBeenCalledWith('printer.test-print.succeeded', {
      printerId: 'p1',
      protocol: 'escpos',
      durationMs: 400,
    });
  });

  it('testPrintFailed logs an error event with printerId/protocol/errorCode/durationMs', () => {
    PrinterLogger.testPrintFailed({ printerId: 'p1', protocol: 'escpos', errorCode: 'PRINT_ERROR', durationMs: 500 });
    expect(LoggerService.error).toHaveBeenCalledWith('printer.test-print.failed', {
      printerId: 'p1',
      protocol: 'escpos',
      errorCode: 'PRINT_ERROR',
      durationMs: 500,
    });
  });

  it('permissionDenied logs a warning event with connectionType', () => {
    PrinterLogger.permissionDenied({ connectionType: 'bluetooth' });
    expect(LoggerService.warning).toHaveBeenCalledWith('printer.permission.denied', { connectionType: 'bluetooth' });
  });

  it('protocolDetected logs an info event with printerId/protocol/connectionType', () => {
    PrinterLogger.protocolDetected({ printerId: 'p1', protocol: 'escpos', connectionType: 'lan' });
    expect(LoggerService.info).toHaveBeenCalledWith('printer.protocol.detected', {
      printerId: 'p1',
      protocol: 'escpos',
      connectionType: 'lan',
    });
  });

  it('protocolUnknown logs a warning event with printerId/connectionType', () => {
    PrinterLogger.protocolUnknown({ printerId: 'p1', connectionType: 'usb' });
    expect(LoggerService.warning).toHaveBeenCalledWith('printer.protocol.unknown', {
      printerId: 'p1',
      connectionType: 'usb',
    });
  });

  it('printSucceeded logs an info event with printerId/protocol/durationMs', () => {
    PrinterLogger.printSucceeded({ printerId: 'p1', protocol: 'escpos', durationMs: 250 });
    expect(LoggerService.info).toHaveBeenCalledWith('printer.print.succeeded', {
      printerId: 'p1',
      protocol: 'escpos',
      durationMs: 250,
    });
  });

  it('printFailed logs an error event with printerId/protocol/errorCode/durationMs', () => {
    PrinterLogger.printFailed({ printerId: 'p1', protocol: 'escpos', errorCode: 'ENCODING_FAILED', durationMs: 80 });
    expect(LoggerService.error).toHaveBeenCalledWith('printer.print.failed', {
      printerId: 'p1',
      protocol: 'escpos',
      errorCode: 'ENCODING_FAILED',
      durationMs: 80,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- PrinterLogger.test.ts`
Expected: FAIL — module `./PrinterLogger` does not exist.

- [ ] **Step 3: Implement `PrinterLogger`**

Create `src/features/printer/services/PrinterLogger.ts`:

```ts
import { LoggerService } from '../../../services/LoggerService';
import type { AppErrorCode } from '../../../types/AppError';
import type { ConnectionType, Protocol } from '../types/printer.types';

/**
 * Điểm log chuẩn hoá duy nhất cho printer module — mỗi hàm ứng với đúng 1
 * event name cố định và chỉ nhận field an toàn để log (printerId nội bộ,
 * protocol, connectionType, errorCode, durationMs). Không có tham số nào cho
 * phép truyền MAC/IP/rawDevice/nội dung hoá đơn, để log không bao giờ chứa
 * dữ liệu nhạy cảm dù được ghi ra console hay (sau này) gửi lên server.
 */
export const PrinterLogger = {
  scanCompleted(params: { connectionType: ConnectionType; deviceCount: number; durationMs: number }): void {
    LoggerService.info('printer.scan.completed', params);
  },

  scanFailed(params: { connectionType: ConnectionType; errorCode: AppErrorCode; durationMs: number }): void {
    LoggerService.warning('printer.scan.failed', params);
  },

  connectSucceeded(params: {
    printerId: string;
    protocol: Protocol;
    connectionType: ConnectionType;
    durationMs: number;
  }): void {
    LoggerService.info('printer.connect.succeeded', params);
  },

  connectFailed(params: {
    printerId: string;
    protocol: Protocol;
    connectionType: ConnectionType;
    errorCode: AppErrorCode;
    durationMs: number;
  }): void {
    LoggerService.warning('printer.connect.failed', params);
  },

  disconnectSucceeded(params: { printerId: string; protocol: Protocol }): void {
    LoggerService.info('printer.disconnect.succeeded', params);
  },

  testPrintSucceeded(params: { printerId: string; protocol: Protocol; durationMs: number }): void {
    LoggerService.info('printer.test-print.succeeded', params);
  },

  testPrintFailed(params: {
    printerId: string;
    protocol: Protocol;
    errorCode: AppErrorCode;
    durationMs: number;
  }): void {
    LoggerService.error('printer.test-print.failed', params);
  },

  permissionDenied(params: { connectionType: ConnectionType }): void {
    LoggerService.warning('printer.permission.denied', params);
  },

  protocolDetected(params: { printerId: string; protocol: Protocol; connectionType: ConnectionType }): void {
    LoggerService.info('printer.protocol.detected', params);
  },

  protocolUnknown(params: { printerId: string; connectionType: ConnectionType }): void {
    LoggerService.warning('printer.protocol.unknown', params);
  },

  printSucceeded(params: { printerId: string; protocol: Protocol; durationMs: number }): void {
    LoggerService.info('printer.print.succeeded', params);
  },

  printFailed(params: { printerId: string; protocol: Protocol; errorCode: AppErrorCode; durationMs: number }): void {
    LoggerService.error('printer.print.failed', params);
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PrinterLogger.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/services/PrinterLogger.ts src/features/printer/services/PrinterLogger.test.ts
git commit -m "feat: add PrinterLogger structured tracing for the printer module"
```

---

### Task 2: `PrinterPermissionService` + Android manifest permissions

**Files:**
- Create: `src/features/printer/services/PrinterPermissionService.ts`
- Create: `src/features/printer/services/PrinterPermissionService.test.ts`
- Modify: `android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Consumes: `PrinterLogger.permissionDenied` (Task 1).
- Produces: `ensureBluetoothPermission(): Promise<boolean>` — Tasks 3-5 import this exact name from `../services/PrinterPermissionService`.

- [ ] **Step 1: Write the failing test**

Create `src/features/printer/services/PrinterPermissionService.test.ts`:

```ts
import { PermissionsAndroid, Platform } from 'react-native';
import { ensureBluetoothPermission } from './PrinterPermissionService';
import { PrinterLogger } from './PrinterLogger';

jest.mock('./PrinterLogger', () => ({
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
    expect(PrinterLogger.permissionDenied).toHaveBeenCalledWith({ connectionType: 'bluetooth' });
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
    expect(PrinterLogger.permissionDenied).toHaveBeenCalledWith({ connectionType: 'bluetooth' });
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- PrinterPermissionService.test.ts`
Expected: FAIL — module `./PrinterPermissionService` does not exist.

- [ ] **Step 3: Implement `PrinterPermissionService`**

Create `src/features/printer/services/PrinterPermissionService.ts`:

```ts
import { PermissionsAndroid, Platform } from 'react-native';
import { PrinterLogger } from './PrinterLogger';

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
    PrinterLogger.permissionDenied({ connectionType: 'bluetooth' });
  }
  return granted;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PrinterPermissionService.test.ts`
Expected: PASS

- [ ] **Step 5: Add Android manifest permissions**

In `android/app/src/main/AndroidManifest.xml`, replace:

```xml
    <uses-permission android:name="android.permission.INTERNET" />

    <application
```

with:

```xml
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

    <application
```

- [ ] **Step 6: Verify**

Run: `npm run type-check`
Expected: 0 errors.

Run: `npm test`
Expected: all suites pass.

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/printer/services/PrinterPermissionService.ts src/features/printer/services/PrinterPermissionService.test.ts android/app/src/main/AndroidManifest.xml
git commit -m "feat: add PrinterPermissionService and Bluetooth manifest permissions"
```

---

### Task 3: Wire permission + logging into `TsplDriver`

**Files:**
- Modify: `src/features/printer/drivers/TsplDriver.ts`
- Modify: `src/features/printer/drivers/TsplDriver.test.ts`

**Interfaces:**
- Consumes: `ensureBluetoothPermission` (Task 2), `PrinterLogger.{scanCompleted,scanFailed,connectSucceeded,connectFailed,disconnectSucceeded,testPrintSucceeded,testPrintFailed}` (Task 1).
- No new interfaces produced — `TsplDriver.print()`/`identify()` are untouched by this task (they predate this plan and already satisfy `IPrinterDriver`).

This task does NOT touch `print()` or `identify()` — only `scan`/`connect`/`disconnect`/`testPrint` gain permission checks and logging.

- [ ] **Step 1: Replace `TsplDriver.ts` in full**

Replace all of `src/features/printer/drivers/TsplDriver.ts` with:

```ts
// src/features/printer/drivers/TsplDriver.ts
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type { ConnectionType, DeviceScanEvent, PrinterConfig, PrinterDeviceInfo, PrinterStatus } from '../types/printer.types';
import type { PrintDocument } from '../types/printDocument.types';
import { TsplEncoder } from '../protocols/TsplEncoder';
import { LanTransport } from '../transports/LanTransport';
import { BluetoothTransport } from '../transports/BluetoothTransport';
import { UsbTransport } from '../transports/UsbTransport';
import { AppErrorException, type AppErrorCode } from '../../../types/AppError';
import { ensureBluetoothPermission } from '../services/PrinterPermissionService';
import { PrinterLogger } from '../services/PrinterLogger';

type TsplTransport = LanTransport | BluetoothTransport | UsbTransport;

const IDENTIFY_TIMEOUT_MS = 1000;

const errorCodeOf = (error: unknown): AppErrorCode =>
  error instanceof AppErrorException ? error.code : 'UNKNOWN_ERROR';

/**
 * Mã hoá 1 lệnh TSPL ASCII đơn giản thành byte thô — dùng riêng cho lệnh dò
 * trạng thái trong `identify()`, không qua `TsplEncoder` (vốn dành cho nội
 * dung in thật, không có API gửi lệnh raw).
 */
const encodeAsciiCommand = (text: string): Uint8Array => {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    // eslint-disable-next-line no-bitwise -- intentional single-byte masking, same as TsplEncoder.encode()
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
};

export class TsplDriver implements IPrinterDriver {
  private connections = new Map<string, TsplTransport>();
  private configs = new Map<string, PrinterConfig>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  private createTransport(connectionType: ConnectionType): TsplTransport {
    if (connectionType === 'lan') return new LanTransport();
    if (connectionType === 'bluetooth') return new BluetoothTransport();
    return new UsbTransport();
  }

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
    const startedAt = Date.now();
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
            PrinterLogger.scanCompleted({ connectionType, deviceCount: devices.length, durationMs: Date.now() - startedAt });
          })
          .catch((error: unknown) => {
            if (!cancelled) onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: String(error) } });
            PrinterLogger.scanFailed({ connectionType, errorCode: 'CONNECTION_ERROR', durationMs: Date.now() - startedAt });
          });
      })
      .catch((error: unknown) => {
        if (!cancelled) onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: String(error) } });
        PrinterLogger.scanFailed({ connectionType, errorCode: 'CONNECTION_ERROR', durationMs: Date.now() - startedAt });
      });
    return () => {
      cancelled = true;
      RNBluetoothClassic.cancelDiscovery().catch(() => undefined);
    };
  }

  async connect(config: PrinterConfig): Promise<void> {
    this.setStatus(config.id, 'connecting');
    const startedAt = Date.now();
    try {
      const transport = this.createTransport(config.connectionType);
      if (config.connectionType === 'lan') {
        if (!config.lan) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Thiếu cấu hình IP/Port' });
        await (transport as LanTransport).connect(config.lan.ip, config.lan.port);
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
        await (transport as UsbTransport).connect();
      }
      this.connections.set(config.id, transport);
      this.configs.set(config.id, config);
      this.setStatus(config.id, 'connected');
      PrinterLogger.connectSucceeded({
        printerId: config.id,
        protocol: config.protocol,
        connectionType: config.connectionType,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      this.setStatus(config.id, 'error');
      PrinterLogger.connectFailed({
        printerId: config.id,
        protocol: config.protocol,
        connectionType: config.connectionType,
        errorCode: errorCodeOf(error),
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, 'disconnecting');
    const transport = this.connections.get(printerId);
    await transport?.close();
    this.connections.delete(printerId);
    this.setStatus(printerId, 'disconnected');
    PrinterLogger.disconnectSucceeded({ printerId, protocol: 'tspl' });
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
    if (!this.connections.has(config.id)) {
      await this.connect(config);
    }
    const startedAt = Date.now();
    try {
      const transport = this.connections.get(config.id);
      const bytes = new TsplEncoder()
        .initialize(config.paperSize)
        .text(10, 10, 'NDTCore POS - In thu')
        .cut()
        .encode();
      if (config.connectionType === 'lan') {
        (transport as LanTransport).write(bytes);
      } else if (config.connectionType === 'bluetooth') {
        await (transport as BluetoothTransport).write(bytes);
      }
      PrinterLogger.testPrintSucceeded({ printerId: config.id, protocol: config.protocol, durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.testPrintFailed({
        printerId: config.id,
        protocol: config.protocol,
        errorCode: errorCodeOf(error),
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  /**
   * Mã hoá `PrintDocument` thành lệnh TSPL theo từng loại phần tử rồi gửi
   * qua transport đang kết nối. Ném `ENCODING_FAILED` cho loại phần tử không
   * được hỗ trợ, `CONNECTION_ERROR` nếu máy in chưa kết nối.
   */
  async print(printerId: string, document: PrintDocument): Promise<void> {
    const config = this.configs.get(printerId);
    const transport = this.connections.get(printerId);
    if (!config || !transport) {
      throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Máy in chưa kết nối' });
    }
    const encoder = new TsplEncoder().initialize(config.paperSize);
    for (const element of document.elements) {
      if (element.type === 'text') {
        encoder.text(element.x, element.y, element.content);
      } else if (element.type === 'line') {
        encoder.text(element.x, element.y, '--------------------------------');
      } else if (element.type === 'table') {
        element.rows.forEach((row, i) => encoder.text(element.x, element.y + i * 20, row.join('  ')));
      } else if (element.type === 'image') {
        encoder.image(element.x, element.y, element.data);
      } else if (element.type === 'barcode') {
        encoder.barcode(element.x, element.y, element.content);
      } else if (element.type === 'qrCode') {
        encoder.qrcode(element.x, element.y, element.content);
      } else {
        throw new AppErrorException({
          code: 'ENCODING_FAILED',
          message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}`,
        });
      }
    }
    const bytes = encoder.cut().encode();
    if (config.connectionType === 'lan') {
      (transport as LanTransport).write(bytes);
    } else if (config.connectionType === 'bluetooth') {
      await (transport as BluetoothTransport).write(bytes);
    } else {
      throw new AppErrorException({ code: 'UNSUPPORTED_CONNECTION', message: 'USB chưa được hỗ trợ cho in nội dung tuỳ ý' });
    }
  }

  /**
   * Gửi lệnh trạng thái TSPL ("~!T") và chờ phản hồi trong `IDENTIFY_TIMEOUT_MS`.
   * Nhiều máy in tem giá rẻ không phản hồi lệnh này — trả `null` là kết quả
   * hợp lệ, không phải lỗi.
   */
  async identify(printerId: string): Promise<PrinterDeviceInfo | null> {
    const transport = this.connections.get(printerId);
    if (!transport || !('readOnce' in transport)) return null;
    try {
      const query = encodeAsciiCommand('~!T\r\n');
      await transport.write(query);
      const response = await transport.readOnce(IDENTIFY_TIMEOUT_MS);
      return response && response.length > 0 ? {} : null;
    } catch {
      return null;
    }
  }
}
```

(This replaces the whole file. The only unchanged methods, verbatim, are `print()` and `identify()` — everything else gains permission checks and/or `PrinterLogger` calls.)

- [ ] **Step 2: Run the existing tests to verify they still pass**

Run: `npm test -- TsplDriver.test.ts`
Expected: PASS — Step 1 preserved every existing behavior; this confirms the patch didn't break anything before adding new tests.

- [ ] **Step 3: Add new tests for permission + logging integration**

In `src/features/printer/drivers/TsplDriver.test.ts`, add two `jest.mock()` calls right after the existing `BluetoothTransport` mock (before the `lanConfig` declaration):

```ts
jest.mock('../services/PrinterPermissionService', () => ({
  ensureBluetoothPermission: jest.fn().mockResolvedValue(true),
}));

jest.mock('../services/PrinterLogger', () => ({
  PrinterLogger: {
    scanCompleted: jest.fn(),
    scanFailed: jest.fn(),
    connectSucceeded: jest.fn(),
    connectFailed: jest.fn(),
    disconnectSucceeded: jest.fn(),
    testPrintSucceeded: jest.fn(),
    testPrintFailed: jest.fn(),
  },
}));
```

Add a new fixture right after the existing `usbConfig` declaration:

```ts
const bluetoothConfig: PrinterConfig = {
  ...lanConfig,
  id: 'label-bt',
  connectionType: 'bluetooth',
  device: { deviceId: '00:11:22:33:44:66', displayName: 'Máy in tem BT', rawDevice: {} },
};
```

Add these test cases inside the `describe('TsplDriver', () => { ... })` block, right before its closing `});`:

```ts
  it('connect() over Bluetooth checks permission before connecting', async () => {
    const driver = new TsplDriver();
    await driver.connect(bluetoothConfig);
    const { ensureBluetoothPermission } = jest.requireMock('../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    expect(ensureBluetoothPermission).toHaveBeenCalled();
    expect(driver.getStatus(bluetoothConfig.id)).toBe('connected');
  });

  it('connect() over Bluetooth fails with CONNECTION_ERROR when permission is denied', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockResolvedValueOnce(false);
    const driver = new TsplDriver();
    await expect(driver.connect(bluetoothConfig)).rejects.toMatchObject({ code: 'CONNECTION_ERROR' });
    expect(driver.getStatus(bluetoothConfig.id)).toBe('error');
  });

  it('connect() logs connectSucceeded on success', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanConfig);
    const { PrinterLogger } = jest.requireMock('../services/PrinterLogger') as {
      PrinterLogger: { connectSucceeded: jest.Mock };
    };
    expect(PrinterLogger.connectSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanConfig.id, protocol: 'tspl', connectionType: 'lan' }),
    );
  });

  it('connect() logs connectFailed on failure', async () => {
    const driver = new TsplDriver();
    await expect(driver.connect(usbConfig)).rejects.toMatchObject({ code: 'UNSUPPORTED_CONNECTION' });
    const { PrinterLogger } = jest.requireMock('../services/PrinterLogger') as {
      PrinterLogger: { connectFailed: jest.Mock };
    };
    expect(PrinterLogger.connectFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: usbConfig.id, protocol: 'tspl', connectionType: 'usb' }),
    );
  });

  it('disconnect() logs disconnectSucceeded', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanConfig);
    await driver.disconnect(lanConfig.id);
    const { PrinterLogger } = jest.requireMock('../services/PrinterLogger') as {
      PrinterLogger: { disconnectSucceeded: jest.Mock };
    };
    expect(PrinterLogger.disconnectSucceeded).toHaveBeenCalledWith({ printerId: lanConfig.id, protocol: 'tspl' });
  });

  it('testPrint() logs testPrintSucceeded', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanConfig);
    await driver.testPrint(lanConfig);
    const { PrinterLogger } = jest.requireMock('../services/PrinterLogger') as {
      PrinterLogger: { testPrintSucceeded: jest.Mock };
    };
    expect(PrinterLogger.testPrintSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanConfig.id, protocol: 'tspl' }),
    );
  });

  it('scan("bluetooth") checks permission before calling RNBluetoothClassic.startDiscovery()', async () => {
    const driver = new TsplDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan('bluetooth', (event) => {
        events.push(event.type);
        if (event.type !== 'loading') resolve();
      });
    });
    const { ensureBluetoothPermission } = jest.requireMock('../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    expect(ensureBluetoothPermission).toHaveBeenCalled();
    expect(events).toEqual(['loading', 'empty']);
  });

  it('scan("bluetooth") emits an error and skips startDiscovery when permission is denied', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockResolvedValueOnce(false);
    const RNBluetoothClassic = jest.requireMock('react-native-bluetooth-classic') as {
      default: { startDiscovery: jest.Mock };
    };
    const callsBefore = RNBluetoothClassic.default.startDiscovery.mock.calls.length;
    const driver = new TsplDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan('bluetooth', (event) => {
        events.push(event.type);
        if (event.type !== 'loading') resolve();
      });
    });
    expect(events).toEqual(['loading', 'error']);
    expect(RNBluetoothClassic.default.startDiscovery.mock.calls.length).toBe(callsBefore);
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- TsplDriver.test.ts`
Expected: PASS (all previous + new tests).

- [ ] **Step 5: Verify full suite, type-check, lint**

Run: `npm run type-check`
Expected: 0 errors.

Run: `npm test`
Expected: all suites pass.

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/printer/drivers/TsplDriver.ts src/features/printer/drivers/TsplDriver.test.ts
git commit -m "feat: wire PrinterPermissionService and PrinterLogger into TsplDriver"
```

---

### Task 4: `ThermalReceiptDriver` core (scan/connect/disconnect/status/testPrint/identify)

**Files:**
- Create: `src/features/printer/drivers/ThermalReceiptDriver.ts`
- Create: `src/features/printer/drivers/ThermalReceiptDriver.test.ts`

**Interfaces:**
- Consumes: `ensureBluetoothPermission` (Task 2), `PrinterLogger.{scanCompleted,scanFailed,connectSucceeded,connectFailed,disconnectSucceeded,testPrintSucceeded,testPrintFailed}` (Task 1), `USBPrinter`/`BLEPrinter`/`NetPrinter` from `@poriyaalar/react-native-thermal-receipt-printer` (already installed).
- Produces: `class ThermalReceiptDriver implements IPrinterDriver` — every method except `print()` (added in Task 5). `DriverRegistry` (Task 6) imports this class.

This task does not yet add `print()` — the class is not a complete `IPrinterDriver` implementation until Task 5. It is not wired into `DriverRegistry` until Task 6, so this is safe: nothing else in the app imports this file yet.

- [ ] **Step 1: Create `ThermalReceiptDriver.ts`**

Create `src/features/printer/drivers/ThermalReceiptDriver.ts`:

```ts
// src/features/printer/drivers/ThermalReceiptDriver.ts
import { Platform } from 'react-native';
import { USBPrinter, BLEPrinter, NetPrinter } from '@poriyaalar/react-native-thermal-receipt-printer';
import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type { ConnectionType, DeviceScanEvent, PrinterConfig, PrinterDeviceInfo, PrinterStatus } from '../types/printer.types';
import { AppErrorException, type AppErrorCode } from '../../../types/AppError';
import { ensureBluetoothPermission } from '../services/PrinterPermissionService';
import { PrinterLogger } from '../services/PrinterLogger';

const errorCodeOf = (error: unknown): AppErrorCode =>
  error instanceof AppErrorException ? error.code : 'UNKNOWN_ERROR';

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
 *
 * Lưu ý khác biệt so với README của thư viện (đã kiểm tra `dist/index.d.ts`
 * thật sau khi cài đặt): `connectPrinter()` nhận tham số vị trí riêng cho
 * từng namespace (không phải object `{host, port}`/`{inner_mac_address}`/
 * `{vendorID, productId}`), và `printText()` là API kiểu callback
 * (`cbSuccess`/`cbErr`), không trả về `Promise` — driver bọc nó lại thành
 * `Promise` qua `printTextAsync()`.
 */
export class ThermalReceiptDriver implements IPrinterDriver {
  private connectedTypes = new Map<string, ConnectionType>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();
  private initialized = new Set<ConnectionType>();
  /** `PrinterDeviceInfo` thật lấy từ resolved value của `connectPrinter()` — dùng cho `identify()`. */
  private deviceInfos = new Map<string, PrinterDeviceInfo>();
  /**
   * Thư viện giữ ĐÚNG 1 kết nối native / namespace (USBPrinter/BLEPrinter/
   * NetPrinter là singleton) — connect printer thứ 2 cùng `connectionType` sẽ
   * âm thầm ngắt printer đầu ở tầng native. Map này track printer nào đang
   * thật sự sở hữu kết nối native của từng `connectionType`, để `testPrint()`/
   * `disconnect()`/`print()` không thao tác nhầm lên 1 printer đã bị ngắt
   * ngầm — đây là giới hạn của thư viện, driver chỉ có thể làm cho
   * status/behaviour phản ánh đúng thực tế chứ không giải quyết được tận
   * gốc (không thể giữ 2 kết nối cùng namespace cùng lúc).
   */
  private activeByType = new Map<ConnectionType, string>();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  private async ensureInitialized(connectionType: ConnectionType): Promise<void> {
    if (this.initialized.has(connectionType)) return;
    await namespaceByConnectionType[connectionType].init();
    this.initialized.add(connectionType);
  }

  /**
   * `printText()` của thư viện là API kiểu callback (`cbSuccess`/`cbErr`),
   * không trả `Promise` — bọc lại thành `Promise` để `testPrint()`/`print()`
   * có thể `await` như các driver khác.
   *
   * Bắt buộc phải truyền object `opts` thật (không phải `undefined`): JS
   * layer của thư viện default `opts` thành `{}` khi thiếu, khiến
   * `keepConnection` là `undefined` — giá trị này băng qua bridge thành
   * `Boolean keepConnection` null, và các adapter Android (LAN/BLE) unbox nó
   * mà không kiểm tra null (`Boolean.toString(keepConnection)` /
   * `if (!keepConnection)`), NPE ngay trên native print thread *sau khi* đã
   * flush byte in nhưng *trước khi* gọi success callback — Promise treo mãi
   * mãi, không `resolve`/`reject`. `cut`/`tailingLine: true` còn đảm bảo máy
   * in feed + cắt giấy sau khi in (mặc định của thư viện là `false`).
   */
  private printTextAsync(connectionType: ConnectionType, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      namespaceByConnectionType[connectionType].printText(
        text,
        { keepConnection: true, cut: true, tailingLine: true },
        () => resolve(),
        (error: Error) => reject(error),
      );
    });
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
    const startedAt = Date.now();

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

        if (connectionType === 'bluetooth') {
          const devices = await BLEPrinter.getDeviceList();
          if (cancelled) return;
          onEvent({
            type: devices.length > 0 ? 'found' : 'empty',
            devices: devices.map((device) => ({
              deviceId: device.inner_mac_address,
              displayName: device.device_name,
              rawDevice: device as unknown as Record<string, unknown>,
            })),
          });
          PrinterLogger.scanCompleted({ connectionType, deviceCount: devices.length, durationMs: Date.now() - startedAt });
        } else {
          const devices = await USBPrinter.getDeviceList();
          if (cancelled) return;
          onEvent({
            type: devices.length > 0 ? 'found' : 'empty',
            devices: devices.map((device) => ({
              deviceId: `${device.vendor_id}:${device.product_id}`,
              displayName: device.device_name,
              rawDevice: device as unknown as Record<string, unknown>,
            })),
          });
          PrinterLogger.scanCompleted({ connectionType, deviceCount: devices.length, durationMs: Date.now() - startedAt });
        }
      } catch (error) {
        if (cancelled) return;
        // Trên Android, khi không tìm thấy thiết bị nào, native module gọi
        // error callback với message "No Device Found" thay vì success
        // callback với mảng rỗng (RNBLEPrinterModule.java /
        // RNUSBPrinterModule.java) — Promise từ getDeviceList() reject, nên
        // phải phân biệt trường hợp này với lỗi kết nối thật để báo `empty`
        // thay vì `CONNECTION_ERROR`.
        const message = error instanceof Error ? error.message : String(error);
        if (/no device found/i.test(message)) {
          onEvent({ type: 'empty' });
          PrinterLogger.scanCompleted({ connectionType, deviceCount: 0, durationMs: Date.now() - startedAt });
          return;
        }
        onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message } });
        PrinterLogger.scanFailed({ connectionType, errorCode: 'CONNECTION_ERROR', durationMs: Date.now() - startedAt });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }

  async connect(config: PrinterConfig): Promise<void> {
    this.setStatus(config.id, 'connecting');
    const startedAt = Date.now();
    try {
      if (config.connectionType === 'bluetooth') {
        const granted = await ensureBluetoothPermission();
        if (!granted) {
          throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Chưa được cấp quyền Bluetooth' });
        }
      }
      await this.ensureInitialized(config.connectionType);

      // Namespace này chỉ giữ được 1 kết nối native — printer đang connect sắp
      // thay thế printer cũ (nếu có) của cùng connectionType. Ngắt JS-side
      // status của printer cũ trước, cho khớp với những gì native layer sắp
      // làm (xem comment ở khai báo `activeByType`).
      const previousOwner = this.activeByType.get(config.connectionType);
      if (previousOwner && previousOwner !== config.id) {
        this.setStatus(previousOwner, 'disconnected');
      }

      let deviceName: string | undefined;
      if (config.connectionType === 'lan') {
        if (!config.lan) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Thiếu cấu hình IP/Port' });
        const result = await NetPrinter.connectPrinter(config.lan.ip, config.lan.port);
        deviceName = result?.device_name;
      } else if (config.connectionType === 'bluetooth') {
        if (!config.device) {
          throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Chưa chọn thiết bị Bluetooth' });
        }
        const result = await BLEPrinter.connectPrinter(config.device.deviceId);
        deviceName = result?.device_name;
      } else {
        const raw = config.device?.rawDevice as unknown as UsbRawDevice | undefined;
        if (!raw) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Thiếu thông tin thiết bị USB' });
        // `.d.ts` của thư viện khai `connectPrinter(vendorId: string, productId: string)`
        // nhưng native Android (`RNUSBPrinterModule.connectPrinter`) nhận
        // `Integer vendorId, Integer productId` — JS layer truyền thẳng
        // không convert. Dưới New Architecture bridge, truyền string vào
        // tham số native Integer throw `JavaTurboModuleArgumentConversionException`
        // ngay lập tức. Cast `as unknown as string` chỉ để thoả mãn type sai
        // của `.d.ts`; giá trị runtime thật sự đi qua bridge vẫn là number.
        const result = await USBPrinter.connectPrinter(
          Number(raw.vendor_id) as unknown as string,
          Number(raw.product_id) as unknown as string,
        );
        deviceName = result?.device_name;
      }

      if (deviceName) this.deviceInfos.set(config.id, { deviceName });
      this.connectedTypes.set(config.id, config.connectionType);
      this.activeByType.set(config.connectionType, config.id);
      this.setStatus(config.id, 'connected');
      PrinterLogger.connectSucceeded({
        printerId: config.id,
        protocol: config.protocol,
        connectionType: config.connectionType,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      this.setStatus(config.id, 'error');
      PrinterLogger.connectFailed({
        printerId: config.id,
        protocol: config.protocol,
        connectionType: config.connectionType,
        errorCode: errorCodeOf(error),
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, 'disconnecting');
    const connectionType = this.connectedTypes.get(printerId);
    if (connectionType) {
      // Chỉ gọi closeConn() native nếu printer này thật sự đang sở hữu kết nối
      // của connectionType đó — nếu không, kết nối native đã thuộc về 1
      // printer khác (bị "cướp" theo cách được mô tả ở `activeByType`), gọi
      // closeConn() lúc này sẽ ngắt nhầm printer đang sống, không phải printer
      // này.
      if (this.activeByType.get(connectionType) === printerId) {
        await namespaceByConnectionType[connectionType].closeConn();
        this.activeByType.delete(connectionType);
      }
    }
    this.connectedTypes.delete(printerId);
    this.deviceInfos.delete(printerId);
    this.setStatus(printerId, 'disconnected');
    // Driver này chỉ bao giờ xử lý protocol 'escpos' (DriverRegistry map cố
    // định 'escpos' -> ThermalReceiptDriver) nên không cần lưu thêm map
    // printerId -> protocol.
    PrinterLogger.disconnectSucceeded({ printerId, protocol: 'escpos' });
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
    // Reconnect không chỉ khi chưa từng connect, mà cả khi printer này đã
    // từng connect nhưng không còn là chủ sở hữu hiện tại của kết nối native
    // cùng connectionType (đã bị 1 printer khác "cướp" kết nối ngầm) — nếu
    // không, sẽ in nhầm lên printer đang thực sự chiếm kết nối.
    const isStaleOwner = this.activeByType.get(config.connectionType) !== config.id;
    if (!this.connectedTypes.has(config.id) || isStaleOwner) {
      await this.connect(config);
    }
    const startedAt = Date.now();
    try {
      const connectionType = this.connectedTypes.get(config.id);
      if (!connectionType) return;
      await this.printTextAsync(connectionType, '<C>NDTCore POS - In thu\n</C>');
      PrinterLogger.testPrintSucceeded({
        printerId: config.id,
        protocol: config.protocol,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      PrinterLogger.testPrintFailed({
        printerId: config.id,
        protocol: config.protocol,
        errorCode: errorCodeOf(error),
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  async identify(printerId: string): Promise<PrinterDeviceInfo | null> {
    if (!this.connectedTypes.has(printerId)) return null;
    return this.deviceInfos.get(printerId) ?? {};
  }
}
```

Note: this class does not yet satisfy `IPrinterDriver` (missing `print()`) — `npm run type-check` will report a missing-method error until Task 5. That is expected; this task's own test file below only exercises the methods that exist so far.

- [ ] **Step 2: Create `ThermalReceiptDriver.test.ts`**

Create `src/features/printer/drivers/ThermalReceiptDriver.test.ts`:

```ts
import { ThermalReceiptDriver } from './ThermalReceiptDriver';
import type { PrinterConfig } from '../types/printer.types';

// The library's real dist/index.d.ts (inspected after `npm install`) differs
// from README-only assumptions: `connectPrinter()` takes positional args
// specific to each namespace (not a shared `{host, port}`-style object), and
// `printText()` is callback-based (`cbSuccess`/`cbErr`), not Promise-returning.
// Mocks below reflect the real shapes.
jest.mock('@poriyaalar/react-native-thermal-receipt-printer', () => ({
  USBPrinter: {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue({ device_name: 'USB', vendor_id: '1155', product_id: '22222' }),
    printText: jest.fn((_text: string, _opts: { keepConnection?: boolean; cut?: boolean; tailingLine?: boolean }, cbSuccess?: (msg: string) => void) => cbSuccess?.('ok')),
    closeConn: jest.fn().mockResolvedValue(undefined),
  },
  BLEPrinter: {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue({ device_name: 'BLE', inner_mac_address: '00:11:22:33:44:55' }),
    printText: jest.fn((_text: string, _opts: { keepConnection?: boolean; cut?: boolean; tailingLine?: boolean }, cbSuccess?: (msg: string) => void) => cbSuccess?.('ok')),
    closeConn: jest.fn().mockResolvedValue(undefined),
  },
  NetPrinter: {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue({ device_name: 'Net', host: '192.168.1.50', port: 9100 }),
    printText: jest.fn((_text: string, _opts: { keepConnection?: boolean; cut?: boolean; tailingLine?: boolean }, cbSuccess?: (msg: string) => void) => cbSuccess?.('ok')),
    closeConn: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../services/PrinterPermissionService', () => ({
  ensureBluetoothPermission: jest.fn().mockResolvedValue(true),
}));

jest.mock('../services/PrinterLogger', () => ({
  PrinterLogger: {
    scanCompleted: jest.fn(),
    scanFailed: jest.fn(),
    connectSucceeded: jest.fn(),
    connectFailed: jest.fn(),
    disconnectSucceeded: jest.fn(),
    testPrintSucceeded: jest.fn(),
    testPrintFailed: jest.fn(),
  },
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
  afterEach(() => {
    jest.clearAllMocks();
  });

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
    expect(NetPrinter.connectPrinter).toHaveBeenCalledWith('192.168.1.50', 9100);
  });

  it('connect() over Bluetooth checks permission and connects with the device MAC address', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(bleConfig);
    const { ensureBluetoothPermission } = jest.requireMock('../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    const { BLEPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      BLEPrinter: { connectPrinter: jest.Mock };
    };
    expect(ensureBluetoothPermission).toHaveBeenCalled();
    expect(BLEPrinter.connectPrinter).toHaveBeenCalledWith('00:11:22:33:44:55');
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

  it('connect() over USB reads vendor_id/product_id from the scanned rawDevice as numbers', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(usbConfig);
    const { USBPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      USBPrinter: { connectPrinter: jest.Mock };
    };
    expect(USBPrinter.connectPrinter).toHaveBeenCalledWith(1155, 22222);
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

  it('scan("bluetooth") emits empty (not error) when getDeviceList rejects with "No Device Found"', async () => {
    const { BLEPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      BLEPrinter: { getDeviceList: jest.Mock };
    };
    BLEPrinter.getDeviceList.mockRejectedValueOnce('No Device Found');
    const driver = new ThermalReceiptDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan('bluetooth', (event) => {
        events.push(event.type);
        if (event.type !== 'loading') resolve();
      });
    });
    expect(events).toEqual(['loading', 'empty']);
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
    expect(NetPrinter.printText).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ keepConnection: true, cut: true, tailingLine: true }),
      expect.any(Function),
      expect.any(Function),
    );
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
    expect(result).toEqual({ deviceName: 'Net' });
  });

  it('connecting printer B on the same connectionType as already-connected printer A flips A to disconnected', async () => {
    const driver = new ThermalReceiptDriver();
    const printerA: PrinterConfig = { ...lanConfig, id: 'receipt-lan-a', lan: { ip: '192.168.1.50', port: 9100 } };
    const printerB: PrinterConfig = { ...lanConfig, id: 'receipt-lan-b', lan: { ip: '192.168.1.51', port: 9100 } };

    await driver.connect(printerA);
    expect(driver.getStatus(printerA.id)).toBe('connected');

    await driver.connect(printerB);
    expect(driver.getStatus(printerA.id)).toBe('disconnected');
    expect(driver.getStatus(printerB.id)).toBe('connected');
  });

  it('testPrint() reconnects instead of taking the stale fast path when another printer has taken over the shared connection', async () => {
    const driver = new ThermalReceiptDriver();
    const printerA: PrinterConfig = { ...lanConfig, id: 'receipt-lan-a', lan: { ip: '192.168.1.50', port: 9100 } };
    const printerB: PrinterConfig = { ...lanConfig, id: 'receipt-lan-b', lan: { ip: '192.168.1.51', port: 9100 } };

    await driver.connect(printerA);
    await driver.connect(printerB);

    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { connectPrinter: jest.Mock };
    };
    const callsBeforeTestPrint = NetPrinter.connectPrinter.mock.calls.length;
    await driver.testPrint(printerA);
    expect(NetPrinter.connectPrinter.mock.calls.length).toBe(callsBeforeTestPrint + 1);
    expect(driver.getStatus(printerA.id)).toBe('connected');
  });

  it('connect() logs connectSucceeded on success', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    const { PrinterLogger } = jest.requireMock('../services/PrinterLogger') as {
      PrinterLogger: { connectSucceeded: jest.Mock };
    };
    expect(PrinterLogger.connectSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanConfig.id, protocol: 'escpos', connectionType: 'lan' }),
    );
  });

  it('connect() logs connectFailed on failure', async () => {
    const driver = new ThermalReceiptDriver();
    const badConfig: PrinterConfig = { ...lanConfig, id: 'receipt-bad', lan: undefined };
    await expect(driver.connect(badConfig)).rejects.toThrow();
    const { PrinterLogger } = jest.requireMock('../services/PrinterLogger') as {
      PrinterLogger: { connectFailed: jest.Mock };
    };
    expect(PrinterLogger.connectFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        printerId: badConfig.id,
        protocol: 'escpos',
        connectionType: 'lan',
        errorCode: 'VALIDATION_ERROR',
      }),
    );
  });

  it('disconnect() logs disconnectSucceeded', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    await driver.disconnect(lanConfig.id);
    const { PrinterLogger } = jest.requireMock('../services/PrinterLogger') as {
      PrinterLogger: { disconnectSucceeded: jest.Mock };
    };
    expect(PrinterLogger.disconnectSucceeded).toHaveBeenCalledWith({ printerId: lanConfig.id, protocol: 'escpos' });
  });

  it('scan("bluetooth") logs scanCompleted with the device count on success', async () => {
    const driver = new ThermalReceiptDriver();
    await new Promise<void>((resolve) => {
      driver.scan('bluetooth', (event) => {
        if (event.type !== 'loading') resolve();
      });
    });
    const { PrinterLogger } = jest.requireMock('../services/PrinterLogger') as {
      PrinterLogger: { scanCompleted: jest.Mock };
    };
    expect(PrinterLogger.scanCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ connectionType: 'bluetooth', deviceCount: 0 }),
    );
  });

  it('scan("bluetooth") logs scanFailed on a genuine connection error (not "No Device Found")', async () => {
    const { BLEPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      BLEPrinter: { getDeviceList: jest.Mock };
    };
    BLEPrinter.getDeviceList.mockRejectedValueOnce(new Error('bluetooth adapter off'));
    const driver = new ThermalReceiptDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan('bluetooth', (event) => {
        events.push(event.type);
        if (event.type !== 'loading') resolve();
      });
    });
    expect(events).toEqual(['loading', 'error']);
    const { PrinterLogger } = jest.requireMock('../services/PrinterLogger') as {
      PrinterLogger: { scanFailed: jest.Mock };
    };
    expect(PrinterLogger.scanFailed).toHaveBeenCalledWith(
      expect.objectContaining({ connectionType: 'bluetooth', errorCode: 'CONNECTION_ERROR' }),
    );
  });

  it('testPrint() logs testPrintSucceeded', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    await driver.testPrint(lanConfig);
    const { PrinterLogger } = jest.requireMock('../services/PrinterLogger') as {
      PrinterLogger: { testPrintSucceeded: jest.Mock };
    };
    expect(PrinterLogger.testPrintSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanConfig.id, protocol: 'escpos' }),
    );
  });

  it('testPrint() logs testPrintFailed when printText fails', async () => {
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { printText: jest.Mock };
    };
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    NetPrinter.printText.mockImplementationOnce(
      (_text: string, _opts: unknown, _cbSuccess?: (msg: string) => void, cbErr?: (error: Error) => void) =>
        cbErr?.(new Error('print failed')),
    );
    await expect(driver.testPrint(lanConfig)).rejects.toThrow('print failed');
    const { PrinterLogger } = jest.requireMock('../services/PrinterLogger') as {
      PrinterLogger: { testPrintFailed: jest.Mock };
    };
    expect(PrinterLogger.testPrintFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanConfig.id, protocol: 'escpos', errorCode: 'UNKNOWN_ERROR' }),
    );
  });

  it('disconnect() does not call the native closeConn() for a printer that no longer owns the shared connection', async () => {
    const driver = new ThermalReceiptDriver();
    const printerA: PrinterConfig = { ...lanConfig, id: 'receipt-lan-a', lan: { ip: '192.168.1.50', port: 9100 } };
    const printerB: PrinterConfig = { ...lanConfig, id: 'receipt-lan-b', lan: { ip: '192.168.1.51', port: 9100 } };

    await driver.connect(printerA);
    await driver.connect(printerB);

    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { closeConn: jest.Mock };
    };
    NetPrinter.closeConn.mockClear();

    await driver.disconnect(printerA.id);
    expect(NetPrinter.closeConn).not.toHaveBeenCalled();
    expect(driver.getStatus(printerA.id)).toBe('disconnected');

    await driver.disconnect(printerB.id);
    expect(NetPrinter.closeConn).toHaveBeenCalledTimes(1);
    expect(driver.getStatus(printerB.id)).toBe('disconnected');
  });
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npm test -- ThermalReceiptDriver.test.ts`
Expected: PASS.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all suites pass. Jest's transpilation does not enforce full TypeScript interface compliance, so the full suite is green even though `ThermalReceiptDriver` doesn't yet satisfy `IPrinterDriver`.

Run: `npm run lint`
Expected: 0 errors.

Do NOT run `npm run type-check` yet — it is expected to fail with "Class 'ThermalReceiptDriver' incorrectly implements interface 'IPrinterDriver'. Property 'print' is missing" until Task 5 adds `print()`. This is expected, not a regression to chase down.

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/drivers/ThermalReceiptDriver.ts src/features/printer/drivers/ThermalReceiptDriver.test.ts
git commit -m "feat: add ThermalReceiptDriver (scan/connect/disconnect/testPrint/identify)"
```

---

### Task 5: `ThermalReceiptDriver.print()`

**Files:**
- Modify: `src/features/printer/drivers/ThermalReceiptDriver.ts`
- Modify: `src/features/printer/drivers/ThermalReceiptDriver.test.ts`

**Interfaces:**
- Consumes: `PrinterLogger.printSucceeded`/`printFailed` (Task 1), `PrintDocument`/`PrintElement` (existing, `src/features/printer/types/printDocument.types.ts`).
- Produces: `ThermalReceiptDriver.print(printerId, document): Promise<void>` — completes the `IPrinterDriver` implementation. After this task, `ThermalReceiptDriver` satisfies the full interface.

- [ ] **Step 1: Add the failing test cases**

In `src/features/printer/drivers/ThermalReceiptDriver.test.ts`, add `PrintDocument` to the type-only import at the top:

```ts
import type { PrinterConfig } from '../types/printer.types';
import type { PrintDocument } from '../types/printDocument.types';
```

Add `printSucceeded`/`printFailed` to the existing `jest.mock('../services/PrinterLogger', ...)` block:

```ts
jest.mock('../services/PrinterLogger', () => ({
  PrinterLogger: {
    scanCompleted: jest.fn(),
    scanFailed: jest.fn(),
    connectSucceeded: jest.fn(),
    connectFailed: jest.fn(),
    disconnectSucceeded: jest.fn(),
    testPrintSucceeded: jest.fn(),
    testPrintFailed: jest.fn(),
    printSucceeded: jest.fn(),
    printFailed: jest.fn(),
  },
}));
```

Add these test cases inside `describe('ThermalReceiptDriver', () => { ... })`, right before its closing `});`:

```ts
  it('print() joins text/line/table elements into a single printText call', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { printText: jest.Mock };
    };
    const document: PrintDocument = {
      elements: [
        { type: 'text', content: 'Trà sữa', x: 0, y: 0 },
        { type: 'line', x: 0, y: 10 },
        { type: 'table', rows: [['Trà sữa', '2']], x: 0, y: 20 },
      ],
    };
    await driver.print(lanConfig.id, document);
    expect(NetPrinter.printText).toHaveBeenCalledWith(
      'Trà sữa\n--------------------------------\nTrà sữa  2\n',
      expect.objectContaining({ keepConnection: true, cut: true, tailingLine: true }),
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('print() throws ENCODING_FAILED for a barcode element without calling printText', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { printText: jest.Mock };
    };
    const callsBefore = NetPrinter.printText.mock.calls.length;
    const document: PrintDocument = { elements: [{ type: 'barcode', content: '123', x: 0, y: 0 }] };
    await expect(driver.print(lanConfig.id, document)).rejects.toMatchObject({ code: 'ENCODING_FAILED' });
    expect(NetPrinter.printText.mock.calls.length).toBe(callsBefore);
  });

  it('print() throws ENCODING_FAILED for a qrCode element', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    const document: PrintDocument = { elements: [{ type: 'qrCode', content: 'https://x', x: 0, y: 0 }] };
    await expect(driver.print(lanConfig.id, document)).rejects.toMatchObject({ code: 'ENCODING_FAILED' });
  });

  it('print() throws ENCODING_FAILED for an image element', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    const document: PrintDocument = { elements: [{ type: 'image', data: 'AAAA', x: 0, y: 0 }] };
    await expect(driver.print(lanConfig.id, document)).rejects.toMatchObject({ code: 'ENCODING_FAILED' });
  });

  it('print() validates all elements before sending anything — an unsupported element after valid ones still sends nothing', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { printText: jest.Mock };
    };
    const callsBefore = NetPrinter.printText.mock.calls.length;
    const document: PrintDocument = {
      elements: [
        { type: 'text', content: 'Trà sữa', x: 0, y: 0 },
        { type: 'barcode', content: '123', x: 0, y: 10 },
      ],
    };
    await expect(driver.print(lanConfig.id, document)).rejects.toMatchObject({ code: 'ENCODING_FAILED' });
    expect(NetPrinter.printText.mock.calls.length).toBe(callsBefore);
  });

  it('print() throws CONNECTION_ERROR when not connected', async () => {
    const driver = new ThermalReceiptDriver();
    const document: PrintDocument = { elements: [] };
    await expect(driver.print('never-connected', document)).rejects.toMatchObject({ code: 'CONNECTION_ERROR' });
  });

  it('print() throws CONNECTION_ERROR when the printer is no longer the active owner of the shared connection', async () => {
    const driver = new ThermalReceiptDriver();
    const printerA: PrinterConfig = { ...lanConfig, id: 'receipt-lan-a', lan: { ip: '192.168.1.50', port: 9100 } };
    const printerB: PrinterConfig = { ...lanConfig, id: 'receipt-lan-b', lan: { ip: '192.168.1.51', port: 9100 } };
    await driver.connect(printerA);
    await driver.connect(printerB);
    const document: PrintDocument = { elements: [{ type: 'text', content: 'x', x: 0, y: 0 }] };
    await expect(driver.print(printerA.id, document)).rejects.toMatchObject({ code: 'CONNECTION_ERROR' });
  });

  it('print() logs printSucceeded on success', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    await driver.print(lanConfig.id, { elements: [{ type: 'text', content: 'x', x: 0, y: 0 }] });
    const { PrinterLogger } = jest.requireMock('../services/PrinterLogger') as {
      PrinterLogger: { printSucceeded: jest.Mock };
    };
    expect(PrinterLogger.printSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanConfig.id, protocol: 'escpos' }),
    );
  });

  it('print() logs printFailed when printText fails', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { printText: jest.Mock };
    };
    NetPrinter.printText.mockImplementationOnce(
      (_text: string, _opts: unknown, _cbSuccess?: (msg: string) => void, cbErr?: (error: Error) => void) =>
        cbErr?.(new Error('print failed')),
    );
    await expect(
      driver.print(lanConfig.id, { elements: [{ type: 'text', content: 'x', x: 0, y: 0 }] }),
    ).rejects.toThrow('print failed');
    const { PrinterLogger } = jest.requireMock('../services/PrinterLogger') as {
      PrinterLogger: { printFailed: jest.Mock };
    };
    expect(PrinterLogger.printFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanConfig.id, protocol: 'escpos', errorCode: 'UNKNOWN_ERROR' }),
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ThermalReceiptDriver.test.ts`
Expected: FAIL — `driver.print` is not a function (the class doesn't implement `print()` yet).

- [ ] **Step 3: Implement `print()`**

In `src/features/printer/drivers/ThermalReceiptDriver.ts`, add the import:

```ts
import type { PrintDocument } from '../types/printDocument.types';
```

right after the existing `import { AppErrorException, type AppErrorCode } from '../../../types/AppError';` line.

Add the `print()` method to the class, right after `disconnect()` and before `getStatus()`:

```ts
  /**
   * Dịch `PrintDocument` sang chuỗi cho `printText()` — thư viện không có
   * API mã vạch/QR/ảnh dùng được (chỉ `printImageBase64` cần base64 thật,
   * trong khi `PrintImageElement.data` hiện là URI) nên `image`/`barcode`/
   * `qrCode` ném `ENCODING_FAILED`, giống cách `EscPosDriver` xử lý loại
   * phần tử không hỗ trợ. Validate toàn bộ elements TRƯỚC khi gọi
   * `printTextAsync` — không có buffer nội bộ như SDK Epson (chỉ flush 1 lần
   * lúc `sendData()`), nên phải tự đảm bảo không gửi in dở dang.
   */
  async print(printerId: string, document: PrintDocument): Promise<void> {
    const connectionType = this.connectedTypes.get(printerId);
    if (!connectionType || this.activeByType.get(connectionType) !== printerId) {
      throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Máy in chưa kết nối' });
    }

    const lines: string[] = [];
    for (const element of document.elements) {
      if (element.type === 'text') {
        lines.push(element.content);
      } else if (element.type === 'line') {
        lines.push('--------------------------------');
      } else if (element.type === 'table') {
        for (const row of element.rows) lines.push(row.join('  '));
      } else {
        throw new AppErrorException({
          code: 'ENCODING_FAILED',
          message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}`,
        });
      }
    }

    const startedAt = Date.now();
    try {
      await this.printTextAsync(connectionType, `${lines.join('\n')}\n`);
      PrinterLogger.printSucceeded({ printerId, protocol: 'escpos', durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.printFailed({
        printerId,
        protocol: 'escpos',
        errorCode: errorCodeOf(error),
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- ThermalReceiptDriver.test.ts`
Expected: PASS

- [ ] **Step 5: Verify full suite, type-check, lint**

Run: `npm run type-check`
Expected: 0 errors — `ThermalReceiptDriver` now satisfies `IPrinterDriver` fully.

Run: `npm test`
Expected: all suites pass.

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/printer/drivers/ThermalReceiptDriver.ts src/features/printer/drivers/ThermalReceiptDriver.test.ts
git commit -m "feat: implement ThermalReceiptDriver.print()"
```

---

### Task 6: Cut over `DriverRegistry`, delete `EscPosDriver`, flip fallback order

**Files:**
- Modify: `src/features/printer/services/DriverRegistry.ts`
- Delete: `src/features/printer/drivers/EscPosDriver.ts`
- Delete: `src/features/printer/drivers/EscPosDriver.test.ts`
- Modify: `jest.setup.js`
- Modify: `src/features/printer/constants/printerDetectionRules.ts`
- Modify: `src/features/printer/constants/printerDetectionRules.test.ts`
- Modify: `src/features/printer/services/discoverProtocol.ts`
- Modify: `src/features/printer/services/discoverProtocol.test.ts`
- Modify: `package.json` (+ `package-lock.json` via `npm uninstall`)

**Interfaces:**
- Consumes: `ThermalReceiptDriver` (Task 4-5).
- Produces: nothing new — this task only rewires existing consumers (`DriverRegistry`) and removes dead code. `PrinterService`/`PrintService`/`discoverProtocol` all depend only on `IPrinterDriver`, unaffected beyond the fallback-order edit below.

This is the only task where the tree briefly has BOTH drivers importable, then loses `EscPosDriver` for good — do all these edits in one task so no intermediate commit leaves `DriverRegistry` pointing at a deleted file.

- [ ] **Step 1: Swap `DriverRegistry.ts`**

Replace all of `src/features/printer/services/DriverRegistry.ts` with:

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

- [ ] **Step 2: Delete `EscPosDriver`**

```bash
rm src/features/printer/drivers/EscPosDriver.ts src/features/printer/drivers/EscPosDriver.test.ts
```

- [ ] **Step 3: Swap the global Jest mock**

In `jest.setup.js`, replace the entire `react-native-esc-pos-printer` mock block (the comment starting `// react-native-esc-pos-printer ships an ESM build...` through its closing `}));`) with:

```js
// @poriyaalar/react-native-thermal-receipt-printer ships an ESM build that the
// `react-native` Jest preset does not transform, so any test that transitively
// imports ThermalReceiptDriver.ts — even without exercising it — fails to
// parse unless the module is mocked here. Test files that need finer control
// (e.g. ThermalReceiptDriver.test.ts) override this with their own local
// jest.mock(), which takes precedence.
jest.mock('@poriyaalar/react-native-thermal-receipt-printer', () => {
  const namespace = () => ({
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue(undefined),
    closeConn: jest.fn().mockResolvedValue(undefined),
    printText: jest.fn().mockImplementation((_text, _opts, cbSuccess) => cbSuccess?.('ok')),
    printBill: jest.fn().mockImplementation((_text, _opts, cbSuccess) => cbSuccess?.('ok')),
    printImageBase64: jest.fn().mockImplementation((_data, _opts, cbSuccess) => cbSuccess?.('ok')),
  });
  return {
    USBPrinter: namespace(),
    BLEPrinter: namespace(),
    NetPrinter: namespace(),
  };
});
```

- [ ] **Step 4: Flip the fallback candidate order**

In `src/features/printer/constants/printerDetectionRules.ts`:

Replace the file's doc comment block:

```ts
/**
 * Luật nhận diện thiết bị: cho ra danh sách candidate driver theo thứ tự ưu
 * tiên để `discoverProtocol()` thử — KHÔNG phải kết luận protocol cuối cùng.
 * Xác nhận thật luôn phải qua `IPrinterDriver.identify()` của driver tương ứng.
 */
```

with:

```ts
/**
 * Luật nhận diện thiết bị: cho ra danh sách candidate driver theo thứ tự ưu
 * tiên để `discoverProtocol()` thử — KHÔNG phải kết luận protocol cuối cùng.
 * Xác nhận thật đi qua `IPrinterDriver.identify()` của driver tương ứng —
 * nhưng độ tin cậy của `identify()` khác nhau giữa protocol: `TsplDriver`
 * gửi lệnh dò trạng thái TSPL thật (`~!T`) và chờ phản hồi, nên máy in
 * ESC/POS thật sẽ không trả lời đúng — đây là 1 discriminator thật.
 * `ThermalReceiptDriver` (escpos) thì chỉ có thể xác nhận "đã connect được và
 * (với USB/BLE) nhận được `device_name` thật từ thiết bị", KHÔNG phải bằng
 * chứng thiết bị nói đúng ngôn ngữ ESC/POS — với LAN, `connectPrinter()` chỉ
 * cần mở được TCP socket tới cổng đó (thành công với bất kỳ thiết bị nào đang
 * lắng nghe, kể cả máy in tem TSPL), và `device_name` trả về cho LAN chỉ là
 * chuỗi `host:port` tự thư viện ghép lại, không phải tên thiết bị thật. Vì
 * vậy luật catch-all bên dưới thử `tspl` trước `escpos`.
 */
```

Replace the final line:

```ts
  // Luật fallback bắt-tất-cả — LUÔN đặt cuối danh sách.
  { vendorMatch: /.*/, candidates: ['escpos', 'tspl'], confidence: 'low' },
];
```

with:

```ts
  // Luật fallback bắt-tất-cả — LUÔN đặt cuối danh sách. Thử `tspl` trước
  // `escpos`: `TsplDriver.identify()` là 1 discriminator thật (gửi lệnh dò
  // trạng thái `~!T` và chờ phản hồi), trong khi `escpos`'s `identify()` (sau
  // khi trả `device_name` thật) vẫn chỉ chứng minh được "đã connect thành
  // công", không phải "đúng là máy in ESC/POS" — xem doc comment đầu file.
  { vendorMatch: /.*/, candidates: ['tspl', 'escpos'], confidence: 'low' },
];
```

In `src/features/printer/constants/printerDetectionRules.test.ts`, change:

```ts
    expect(last.candidates).toEqual(['escpos', 'tspl']);
```

to:

```ts
    expect(last.candidates).toEqual(['tspl', 'escpos']);
```

- [ ] **Step 5: Wire `PrinterLogger` into `discoverProtocol.ts` and fix its dead fallback literal**

Per spec §3, `discoverProtocol.ts` should log `protocolDetected`/`protocolUnknown` — this was never added in Tasks 1-5 since none of them touch this file. Also fold in the same fallback-order fix as Step 4 (this file has its own copy of the fallback literal, unreachable in practice since `PRINTER_DETECTION_RULES` always ends with its own catch-all, but should stay consistent).

Replace all of `src/features/printer/services/discoverProtocol.ts` with:

```ts
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
import { PrinterLogger } from './PrinterLogger';

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
 * `undefined` cho LAN vì không có scan), trả về nguyên luật khớp đầu tiên (cần
 * cả `confidence`/`modelMatch` cho cổng dual-mode ở `run()`, không chỉ
 * `candidates`). Luật fallback bắt-tất-cả đảm bảo luôn có kết quả.
 */
export const resolveDetectionRule = (
  hintText: string | undefined,
  rules: PrinterDetectionRule[] = PRINTER_DETECTION_RULES,
): PrinterDetectionRule => {
  const text = hintText ?? '';
  return (
    rules.find((r) => r.vendorMatch.test(text) && (!r.modelMatch || r.modelMatch.test(text))) ?? {
      vendorMatch: /.*/,
      candidates: ['tspl', 'escpos'],
      confidence: 'low',
    }
  );
};

export const resolveCandidates = (
  hintText: string | undefined,
  rules: PrinterDetectionRule[] = PRINTER_DETECTION_RULES,
): Protocol[] => resolveDetectionRule(hintText, rules).candidates;

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
      const rule = resolveDetectionRule(input.device?.displayName);
      if (rule.modelMatch && rule.confidence === 'low' && rule.candidates.length > 1) {
        onEvent({ stage: 'unknown_protocol' });
        PrinterLogger.protocolUnknown({ printerId: input.printerId, connectionType: input.connectionType });
        return;
      }
      const candidates = rule.candidates.filter((protocol) => Boolean(registry[protocol]));
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
          PrinterLogger.protocolDetected({ printerId: input.printerId, protocol, connectionType: input.connectionType });
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
      PrinterLogger.protocolUnknown({ printerId: input.printerId, connectionType: input.connectionType });
    };

    run();

    return () => {
      cancelled = true;
    };
  };
```

In `src/features/printer/services/discoverProtocol.test.ts`, add a `PrinterLogger` mock and import right after the existing imports (before `makeMockDriver`):

```ts
import { PrinterLogger } from './PrinterLogger';

jest.mock('./PrinterLogger', () => ({
  PrinterLogger: {
    protocolDetected: jest.fn(),
    protocolUnknown: jest.fn(),
  },
}));
```

Add `afterEach(() => jest.clearAllMocks());` as the first line inside `describe('discoverProtocol', () => { ... })`, right after the `baseInput` declaration.

Add these test cases inside `describe('discoverProtocol', () => { ... })`, right before its closing `});`:

```ts
  it('logs protocolDetected when identify() succeeds', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'TM-T82' }) });
    const tsplDriver = makeMockDriver();
    await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);
    expect(PrinterLogger.protocolDetected).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: 'p1', protocol: 'escpos', connectionType: 'lan' }),
    );
  });

  it('logs protocolUnknown when every candidate connects but none identifies', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);
    expect(PrinterLogger.protocolUnknown).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: 'p1', connectionType: 'lan' }),
    );
  });

  it('logs protocolUnknown immediately for a low-confidence dual-mode rule', async () => {
    const escposDriver = makeMockDriver();
    const tsplDriver = makeMockDriver();
    const dualModeInput = {
      printerId: 'p1',
      connectionType: 'bluetooth' as const,
      device: { deviceId: 'AA:BB', displayName: 'Xprinter XP-365B', rawDevice: {} },
    };
    await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, dualModeInput);
    expect(PrinterLogger.protocolUnknown).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: 'p1', connectionType: 'bluetooth' }),
    );
  });
```

- [ ] **Step 6: Remove the old dependency**

```bash
npm uninstall react-native-esc-pos-printer
```

This updates `package.json` and `package-lock.json` together (do not hand-edit either).

- [ ] **Step 7: Verify**

Run: `npm run type-check`
Expected: 0 errors.

Run: `npm test`
Expected: all suites pass — `EscPosDriver.test.ts` is gone; every other test that transitively imported `EscPosDriver.ts` now transitively imports `ThermalReceiptDriver.ts` instead, covered by the new global mock from Step 3.

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/features/printer/services/DriverRegistry.ts src/features/printer/drivers/EscPosDriver.ts src/features/printer/drivers/EscPosDriver.test.ts jest.setup.js src/features/printer/constants/printerDetectionRules.ts src/features/printer/constants/printerDetectionRules.test.ts src/features/printer/services/discoverProtocol.ts src/features/printer/services/discoverProtocol.test.ts package.json package-lock.json
git commit -m "feat: cut escpos protocol over to ThermalReceiptDriver, remove EscPosDriver"
```

(`git add` on the deleted `EscPosDriver.ts`/`.test.ts` stages the deletion.)

---

## Post-plan verification

After all 6 tasks:

```bash
npm run verify   # type-check + lint + test
```

Then, per the spec's Hardware Verification checklist (not automatable — needs a human with real devices): USB connect + `testPrint` + `print()` on Android; Bluetooth pairing/permission prompt, connect, `testPrint` + `print()` on Android and iOS; LAN connect + `testPrint` + `print()` on Android and iOS; Vietnamese diacritics through `printText()`; reconnect after app restart; permission-denied path shows an error instead of hanging; connecting a second printer mid-print on the same `connectionType` doesn't misdeliver a receipt to the wrong device.
