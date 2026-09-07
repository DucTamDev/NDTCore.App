# Printer Bridge Callback-to-Promise Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổi `ThermalPrinterModule` (native Android RN module) từ `Callback` pair sang `Promise` cho cả 5 `@ReactMethod`, thêm cấu trúc lỗi (`code` + `message`) qua model `PrinterErrorResult`, và đổi tên 3 method cho rõ nghĩa: `connectPrinter`→`openConnect`, `closeConn`→`disconnect`, `printRawData`→`writeByBase64`.

**Architecture:** `ThermalPrinterModule` nhận `Promise` làm tham số cuối thay vì `Callback successCallback, Callback errorCallback`; mọi catch-block gọi qua `PrinterErrorResult.from(e).rejectTo(promise)` thay vì rải `code.name()`/message string trực tiếp. Phía JS, `PrinterNativeModule.ts` bỏ hết boilerplate `new Promise((resolve, reject) => nativeCall(..., resolve, reject))` — gọi thẳng native method (đã tự trả `Promise` thật) — nhưng **giữ nguyên tên export JS** (`USBPrinter.connectPrinter`, `.closeConn`, `printText`, `printRawDataUsb/Bluetooth/Lan`) nên không phải sửa `NativeAdapter.ts`/`UsbTransport.ts`.

**Tech Stack:** Java 17 (Android, RN 0.86 New Architecture), TypeScript strict, Jest.

**Spec:** `docs/superpowers/specs/2026-09-05-printer-bridge-callback-to-promise-design.md`

## Global Constraints

- Không có Java unit test trong project này — verify Java bằng `compileDebugJavaWithJavac` (từ `android/`, `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"`).
- `PrinterErrorResult` đặt ở package `module/` (KHÔNG phải `error/`) — vì nó import `com.facebook.react.bridge.Promise`, 1 kiểu RN bridge; nguyên tắc kiến trúc là RN bridge type chỉ tồn tại trong package `module/`.
- Tên method native đổi (`connectPrinter`→`openConnect`, `closeConn`→`disconnect`, `printRawData`→`writeByBase64`), nhưng **tên export JS namespace giữ nguyên** (`USBPrinter.connectPrinter`, `.closeConn`, `printText`, `printRawDataUsb`/`printRawDataBluetooth`/`printRawDataLan`) — chỉ đổi implementation bên trong gọi tên native mới.
- Nhánh iOS (`Platform.OS === 'ios'` trong `BLEPrinter.printText`/`NetPrinter.printText`, gọi `NativeModules.RNBLEPrinter`/`RNNetPrinter`) **không đổi tên gọi native** (vẫn `.printRawData(...)`, module khác, ngoài phạm vi) — nhưng PHẢI trả về `Promise` thật (bọc bằng `new Promise` quanh callback hiện có) vì `printText` đổi kiểu trả về thành `Promise<void>` trên toàn bộ 3 namespace.
- Base branch: `refactor/printer-solid-naming` (đã push, chưa merge) — nhánh hiện tại `refactor/printer-bridge-promise` đã rẽ từ đó.

---

### Task 1: Error layer — khôi phục `getCode()` và `INVALID_ARGUMENT`

**Files:**
- Modify: `android/app/src/main/java/com/ndtcorepos/thermalprinter/error/PrinterException.java`
- Modify: `android/app/src/main/java/com/ndtcorepos/thermalprinter/error/PrinterErrorCode.java`

**Interfaces:**
- Produces: `PrinterException.getCode(): PrinterErrorCode` (dùng ở Task 2); `PrinterErrorCode.INVALID_ARGUMENT` (giá trị enum mới, dùng ở Task 3).

- [ ] **Step 1: Thêm `getCode()` vào `PrinterException.java`**

Nội dung đầy đủ file sau khi sửa:

```java
package com.ndtcorepos.thermalprinter.error;

/** Exception nội bộ tầng native — không tự log, layer tạo ra nó chịu trách nhiệm log nếu cần. */
public class PrinterException extends Exception {

    private final PrinterErrorCode code;

    public PrinterException(PrinterErrorCode code, String message) {
        super(message);
        this.code = code;
    }

    public PrinterException(PrinterErrorCode code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public PrinterErrorCode getCode() {
        return code;
    }
}
```

- [ ] **Step 2: Thêm `INVALID_ARGUMENT` vào `PrinterErrorCode.java`**

Nội dung đầy đủ file sau khi sửa:

```java
package com.ndtcorepos.thermalprinter.error;

/** Chỉ giữ code thực sự phát sinh khi port lại logic cũ — không thêm code "phòng khi cần sau này". */
public enum PrinterErrorCode {
    INVALID_ARGUMENT,
    UNSUPPORTED_CONNECTION,

    DEVICE_NOT_FOUND,
    DEVICE_NOT_CONNECTED,

    DISCOVERY_FAILED,
    CONNECTION_FAILED,

    WRITE_FAILED
}
```

- [ ] **Step 3: Verify compiles**

Run (từ `android/`): `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" ./gradlew.bat compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/error
git commit -m "feat: khôi phục PrinterException.getCode() và PrinterErrorCode.INVALID_ARGUMENT"
```

---

### Task 2: `PrinterErrorResult` — model lỗi tập trung

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/module/PrinterErrorResult.java`

**Interfaces:**
- Consumes: `PrinterException.getCode()` (Task 1), `PrinterErrorCode` (Task 1)
- Produces: `PrinterErrorResult(PrinterErrorCode, String)`, `PrinterErrorResult.from(PrinterException): PrinterErrorResult`, `.rejectTo(Promise)` — dùng ở Task 3.

- [ ] **Step 1: Tạo `module/PrinterErrorResult.java`**

```java
package com.ndtcorepos.thermalprinter.module;

import com.facebook.react.bridge.Promise;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;

/**
 * Chuyển PrinterException/PrinterErrorCode thành 1 lần reject(code, message)
 * duy nhất — mọi @ReactMethod trong ThermalPrinterModule dùng chung, không
 * rải string literal riêng lẻ ở từng catch-block.
 */
public final class PrinterErrorResult {

    private final PrinterErrorCode code;
    private final String message;

    public PrinterErrorResult(PrinterErrorCode code, String message) {
        this.code = code;
        this.message = message;
    }

    public static PrinterErrorResult from(PrinterException e) {
        return new PrinterErrorResult(e.getCode(), e.getMessage());
    }

    public void rejectTo(Promise promise) {
        promise.reject(code.name(), message);
    }
}
```

- [ ] **Step 2: Verify compiles**

Run: `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" ./gradlew.bat compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/module/PrinterErrorResult.java
git commit -m "feat: add PrinterErrorResult — centralized error-to-Promise-reject model"
```

---

### Task 3: `ThermalPrinterModule` — Callback → Promise, đổi tên 3 method

**Files:**
- Modify: `android/app/src/main/java/com/ndtcorepos/thermalprinter/module/ThermalPrinterModule.java`

**Interfaces:**
- Consumes: `PrinterErrorResult` (Task 2), `PrinterErrorCode` (Task 1)
- Produces: RN method mới — `init(String, Promise)`, `getDeviceList(String, Promise)`, `openConnect(ReadableMap, Promise)` (cũ `connectPrinter`), `disconnect(String, Promise)` (cũ `closeConn`), `writeByBase64(String, String, Boolean, Promise)` (cũ `printRawData`). Dùng ở Task 4 (JS bridge phải gọi đúng 5 tên này).

- [ ] **Step 1: Viết lại toàn bộ `ThermalPrinterModule.java`**

```java
package com.ndtcorepos.thermalprinter.module;

import android.bluetooth.BluetoothAdapter;
import android.util.Base64;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;

import com.ndtcorepos.thermalprinter.application.PrinterService;
import com.ndtcorepos.thermalprinter.application.PrinterServiceFactory;
import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.model.IPrinterDevice;
import com.ndtcorepos.thermalprinter.model.PrinterConnection;
import com.ndtcorepos.thermalprinter.model.PrinterData;
import com.ndtcorepos.thermalprinter.permission.UsbPermission;

import java.util.List;

/**
 * RN bridge duy nhất cho printer — Promise boundary. Từ PrinterService trở
 * xuống không còn biết React Native tồn tại (return/throw PrinterException).
 */
public class ThermalPrinterModule extends ReactContextBaseJavaModule {

    private final PrinterService printerService;
    private final UsbPermission usbPermission;
    private boolean usbPermissionRegistered = false;

    public ThermalPrinterModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.usbPermission = new UsbPermission(reactContext);
        this.printerService = PrinterServiceFactory.create(reactContext, usbPermission);
    }

    @Override
    public String getName() {
        return "ThermalPrinterModule";
    }

    @ReactMethod
    public void init(String connectionType, Promise promise) {
        try {
            ConnectionType type = ConnectionType.fromWireValue(connectionType);
            if (type == ConnectionType.USB) {
                if (!usbPermissionRegistered) {
                    usbPermission.register();
                    usbPermissionRegistered = true;
                }
            } else if (type == ConnectionType.BLUETOOTH) {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null) {
                    new PrinterErrorResult(PrinterErrorCode.CONNECTION_FAILED, "No bluetooth adapter available").rejectTo(promise);
                    return;
                }
                if (!adapter.isEnabled()) {
                    new PrinterErrorResult(PrinterErrorCode.CONNECTION_FAILED, "bluetooth adapter is not enabled").rejectTo(promise);
                    return;
                }
            }
            promise.resolve(null);
        } catch (IllegalArgumentException e) {
            new PrinterErrorResult(PrinterErrorCode.UNSUPPORTED_CONNECTION, e.getMessage()).rejectTo(promise);
        } catch (Exception e) {
            new PrinterErrorResult(PrinterErrorCode.CONNECTION_FAILED, e.getMessage()).rejectTo(promise);
        }
    }

    @ReactMethod
    public void getDeviceList(String connectionType, Promise promise) {
        try {
            ConnectionType type = ConnectionType.fromWireValue(connectionType);
            List<IPrinterDevice> devices = printerService.discover(type);
            if (devices.isEmpty()) {
                new PrinterErrorResult(PrinterErrorCode.DEVICE_NOT_FOUND, "No Device Found").rejectTo(promise);
                return;
            }
            WritableArray result = Arguments.createArray();
            for (IPrinterDevice device : devices) {
                result.pushMap(device.toWritableMap());
            }
            promise.resolve(result);
        } catch (PrinterException e) {
            PrinterErrorResult.from(e).rejectTo(promise);
        } catch (IllegalArgumentException e) {
            new PrinterErrorResult(PrinterErrorCode.UNSUPPORTED_CONNECTION, e.getMessage()).rejectTo(promise);
        }
    }

    /** RN method name: `openConnect` (cũ: `connectPrinter`). */
    @ReactMethod
    public void openConnect(ReadableMap connection, Promise promise) {
        try {
            printerService.connect(toPrinterConnection(connection));
            promise.resolve(Arguments.createMap());
        } catch (PrinterException e) {
            PrinterErrorResult.from(e).rejectTo(promise);
        } catch (IllegalArgumentException e) {
            new PrinterErrorResult(PrinterErrorCode.UNSUPPORTED_CONNECTION, e.getMessage()).rejectTo(promise);
        }
    }

    /** RN method name: `disconnect` (cũ: `closeConn`). */
    @ReactMethod
    public void disconnect(String connectionType, Promise promise) {
        try {
            printerService.disconnect(ConnectionType.fromWireValue(connectionType));
            promise.resolve(null);
        } catch (PrinterException e) {
            PrinterErrorResult.from(e).rejectTo(promise);
        } catch (IllegalArgumentException e) {
            new PrinterErrorResult(PrinterErrorCode.UNSUPPORTED_CONNECTION, e.getMessage()).rejectTo(promise);
        }
    }

    /** RN method name: `writeByBase64` (cũ: `printRawData`). */
    @ReactMethod
    public void writeByBase64(String connectionType, String base64Data, Boolean keepConnection, Promise promise) {
        ConnectionType type;
        try {
            type = ConnectionType.fromWireValue(connectionType);
        } catch (IllegalArgumentException e) {
            new PrinterErrorResult(PrinterErrorCode.UNSUPPORTED_CONNECTION, e.getMessage()).rejectTo(promise);
            return;
        }
        new Thread(() -> {
            try {
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                printerService.write(type, new PrinterData(bytes), keepConnection);
                promise.resolve("Print SuccessFully");
            } catch (PrinterException e) {
                PrinterErrorResult.from(e).rejectTo(promise);
            } catch (IllegalArgumentException e) {
                new PrinterErrorResult(PrinterErrorCode.INVALID_ARGUMENT, "Invalid base64 data: " + e.getMessage()).rejectTo(promise);
            }
        }).start();
    }

    private PrinterConnection toPrinterConnection(ReadableMap connection) {
        ConnectionType type = ConnectionType.fromWireValue(connection.getString("type"));
        return switch (type) {
            case USB -> new PrinterConnection.Usb(connection.getInt("vendorId"), connection.getInt("productId"));
            case BLUETOOTH -> new PrinterConnection.Bluetooth(connection.getString("innerAddress"));
            case LAN -> new PrinterConnection.Lan(connection.getString("host"), connection.getInt("port"));
        };
    }
}
```

- [ ] **Step 2: Verify compiles**

Run: `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" ./gradlew.bat compileDebugJavaWithJavac`
Expected: BUILD SUCCESSFUL. Nếu lỗi liên quan `Callback`/`Promise` import — kiểm tra đã xoá hết `import com.facebook.react.bridge.Callback;` chưa (không còn dùng).

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/module/ThermalPrinterModule.java
git commit -m "refactor: ThermalPrinterModule Callback -> Promise, đổi tên connectPrinter/closeConn/printRawData"
```

---

### Task 4: JS bridge (`PrinterNativeModule.ts`) — gọi tên native mới, trả Promise thật

**Files:**
- Modify: `src/features/printer/adapters/native/PrinterNativeModule.ts`

**Interfaces:**
- Consumes: `NativeModules.ThermalPrinterModule.{init, getDeviceList, openConnect, disconnect, writeByBase64}` (Task 3) — mỗi hàm giờ tự trả về `Promise` thật (JS không truyền callback/Promise arg).
- Produces: **Không đổi tên export** — `USBPrinter`, `BLEPrinter`, `NetPrinter` (mỗi namespace: `init`, `getDeviceList`, `connectPrinter`, `closeConn`, `printText` — tất cả đổi return type thành `Promise<...>` thay vì `void`), `ThermalPrinterAdapter`, `ensureNativeInitialized`, `ensureUsbInitialized`, `printRawDataUsb`, `printRawDataBluetooth`, `printRawDataLan`. Mọi call site khác (`UsbTransport.ts`, `NativeAdapter.ts`, `useConnectionSetup.ts`, `PrinterResolver.ts`) KHÔNG cần sửa.

- [ ] **Step 1: Viết lại toàn bộ nội dung file**

```typescript
import { NativeModules, Platform } from 'react-native';
import type { ConnectionType } from '../../models/printer/PrinterDevice';
import * as EPToolkit from './utils/EPToolkit';

/**
 * Lớp JS của native module `ThermalPrinterModule`
 * (`com.ndtcorepos.thermalprinter.module`, code ở
 * `android/app/src/main/java/com/ndtcorepos/thermalprinter/`) — chỉ Android.
 * Mỗi lệnh nhận thêm tham số `connectionType` ("usb"/"bluetooth"/"lan") để
 * native route đúng transport. 3 namespace JS (`USBPrinter`/`BLEPrinter`/
 * `NetPrinter`) giữ nguyên tên export để không phải sửa call site khác
 * trong `src/features/printer`.
 *
 * Native dùng `Promise` (không phải Callback pair) — JS gọi thẳng, không
 * cần tự bọc `new Promise(...)`. Tên method native khác tên export JS ở 3
 * chỗ (RN Promise API rõ nghĩa hơn khi không còn ràng buộc theo tên gốc
 * upstream): `connectPrinter` (JS) → `openConnect` (native), `closeConn`
 * (JS) → `disconnect` (native), `printRawData`-liên-quan (JS) →
 * `writeByBase64` (native). Lỗi native reject dạng `(code, message)` —
 * RN tự đóng gói thành JS `Error` có `.code`/`.message`.
 *
 * Gốc: copy từ `@poriyaalar/react-native-thermal-receipt-printer` `dist/index.js`,
 * chuyển sang TS. Pipeline `printText` → `EPToolkit.exchange_text` → base64 →
 * native `writeByBase64`.
 *
 * Lược bỏ so với bản gốc: `NetPrinterEventEmitter` + enum sự kiện scan (app
 * không dùng), `exchange_image` (Jimp không chạy trong RN), `printImageData`/
 * `printQrCode`/`printImageBase64` (dead code, không call site nào dùng —
 * xem docs/superpowers/specs/2026-09-03-native-printer-architecture-refactor-design.md).
 */
const ThermalPrinterModule = NativeModules.ThermalPrinterModule;

/** Tuỳ chọn in văn bản. / Text printing options. */
export interface PrinterOptions {
  beep?: boolean;
  cut?: boolean;
  tailingLine?: boolean;
  encoding?: string;
  keepConnection?: boolean;
}

/** 1 endpoint của USB interface. / One endpoint of a USB interface. */
export interface UsbEndpointInfo {
  address: number;
  number: number;
  direction: 'in' | 'out';
  type: 'control' | 'isochronous' | 'bulk' | 'interrupt' | 'unknown';
  maxPacketSize: number;
  interval: number;
}

/** 1 interface của USB device. / One interface of a USB device. */
export interface UsbInterfaceInfo {
  id: number;
  alternateSetting: number;
  /** USB class code — 7 = Printer. */
  class: number;
  subclass: number;
  /** 2 = bidirectional (IEEE-1284) → đọc được device ID / phản hồi. */
  protocol: number;
  name: string | null;
  endpoints: UsbEndpointInfo[];
}

/**
 * Thiết bị máy in USB — `getDeviceList()` trả TOÀN BỘ descriptor (xem
 * `UsbPrinterDevice.toWritableMap()` tầng native). `vendor_id`/`product_id`
 * là `number` (native `putInt`); các field enrichment optional vì `serialNumber`
 * cần quyền USB (Android 10+) và native cũ hơn có thể chưa build vào.
 *
 * USB printer device — `getDeviceList()` returns the full descriptor.
 */
export interface IUSBPrinter {
  device_name: string;
  device_id?: number;
  vendor_id: number;
  product_id: number;
  manufacturerName?: string | null;
  productName?: string | null;
  serialNumber?: string | null;
  version?: string | null;
  deviceClass?: number;
  deviceSubclass?: number;
  deviceProtocol?: number;
  interfaces?: UsbInterfaceInfo[];
  /** Có bulk-IN endpoint ở BẤT KỲ interface nào → đọc được phản hồi máy in. */
  hasBulkInEndpoint?: boolean;
  hasBulkOutEndpoint?: boolean;
}

/** Thiết bị máy in Bluetooth. / Bluetooth printer device. */
export interface IBLEPrinter {
  device_name: string;
  inner_mac_address: string;
}

/** Thiết bị máy in LAN. / LAN printer device. */
export interface INetPrinter {
  device_name: string;
  host: string;
  port: number;
}

type SuccessCallback = (message?: string) => void;
type ErrorCallback = (error: Error) => void;

const defaultTextOptions: PrinterOptions = { beep: false, cut: false, tailingLine: false, encoding: 'UTF8' };

const textTo64Buffer = (text: string, opts: PrinterOptions): string => {
  const options = { ...defaultTextOptions, ...opts };
  return EPToolkit.exchange_text(text, options).toString('base64').replace('G0AcJhxD/xsy', '');
};

/** Bỏ tag định dạng khi gửi thẳng text sang PrinterSDK (iOS). / Strip tags for iOS PrinterSDK. */
const textPreprocessingIOS = (text: string): { text: string; opts: { beep: boolean; cut: boolean } } => ({
  text: text
    .replace(/<\/?CB>/g, '')
    .replace(/<\/?CM>/g, '')
    .replace(/<\/?CD>/g, '')
    .replace(/<\/?C>/g, '')
    .replace(/<\/?D>/g, '')
    .replace(/<\/?B>/g, '')
    .replace(/<\/?M>/g, ''),
  opts: { beep: true, cut: true },
});

/**
 * Gọi native `writeByBase64`, đồng thời hỗ trợ `cbSuccess`/`cbErr` optional
 * (tương thích call site cũ dùng callback) trong lúc vẫn trả `Promise` thật.
 */
const writeByBase64 = (
  connectionType: 'usb' | 'bluetooth' | 'lan',
  base64Data: string,
  keepConnection: boolean | undefined,
  cbSuccess?: SuccessCallback,
  cbErr?: ErrorCallback,
): Promise<void> => {
  const result: Promise<void> = ThermalPrinterModule.writeByBase64(connectionType, base64Data, keepConnection);
  if (cbSuccess || cbErr) {
    result.then(
      (msg) => cbSuccess?.(msg as unknown as string),
      (error: Error) => cbErr?.(error),
    );
  }
  return result;
};

/** Namespace kết nối + in qua USB. / USB connect + print namespace. */
export const USBPrinter = {
  init: (): Promise<void> => ThermalPrinterModule.init('usb'),

  getDeviceList: (): Promise<IUSBPrinter[]> => ThermalPrinterModule.getDeviceList('usb'),

  connectPrinter: (vendorId: number, productId: number): Promise<IUSBPrinter> =>
    ThermalPrinterModule.openConnect({ type: 'usb', vendorId, productId }),

  closeConn: (): Promise<void> => ThermalPrinterModule.disconnect('usb'),

  printText: (
    text: string,
    opts: PrinterOptions = {},
    cbSuccess?: SuccessCallback,
    cbErr?: ErrorCallback,
  ): Promise<void> => writeByBase64('usb', textTo64Buffer(text, opts), opts?.keepConnection, cbSuccess, cbErr),
};

/** Namespace kết nối + in qua Bluetooth. / Bluetooth connect + print namespace. */
export const BLEPrinter = {
  init: (): Promise<void> => ThermalPrinterModule.init('bluetooth'),

  getDeviceList: (): Promise<IBLEPrinter[]> => ThermalPrinterModule.getDeviceList('bluetooth'),

  connectPrinter: (inner_mac_address: string): Promise<IBLEPrinter> =>
    ThermalPrinterModule.openConnect({ type: 'bluetooth', innerAddress: inner_mac_address }),

  closeConn: (): Promise<void> => ThermalPrinterModule.disconnect('bluetooth'),

  printText: (
    text: string,
    opts: PrinterOptions = {},
    cbSuccess?: SuccessCallback,
    cbErr?: ErrorCallback,
  ): Promise<void> => {
    if (Platform.OS === 'ios') {
      // Native iOS chưa implement (module khác, ngoài phạm vi Android-only
      // refactor này) — giữ nguyên lệnh gọi native cũ, chỉ bọc thêm Promise
      // để chữ ký hàm nhất quán trên mọi platform.
      const processed = textPreprocessingIOS(text);
      return new Promise((resolve, reject) => {
        NativeModules.RNBLEPrinter.printRawData(
          processed.text,
          processed.opts,
          (msg: string) => {
            cbSuccess?.(msg);
            resolve();
          },
          (error: Error) => {
            cbErr?.(error);
            reject(error);
          },
        );
      });
    }
    return writeByBase64('bluetooth', textTo64Buffer(text, opts), opts?.keepConnection, cbSuccess, cbErr);
  },
};

/** Namespace kết nối + in qua LAN. / LAN connect + print namespace. */
export const NetPrinter = {
  init: (): Promise<void> => ThermalPrinterModule.init('lan'),

  getDeviceList: (): Promise<INetPrinter[]> => ThermalPrinterModule.getDeviceList('lan'),

  connectPrinter: (host: string, port: number): Promise<INetPrinter> =>
    ThermalPrinterModule.openConnect({ type: 'lan', host, port }),

  closeConn: (): Promise<void> => ThermalPrinterModule.disconnect('lan'),

  printText: (
    text: string,
    opts: PrinterOptions = {},
    cbSuccess?: SuccessCallback,
    cbErr?: ErrorCallback,
  ): Promise<void> => {
    if (Platform.OS === 'ios') {
      // Native iOS chưa implement — giữ nguyên hành vi cũ (xem BLEPrinter.printText).
      const processed = textPreprocessingIOS(text);
      return new Promise((resolve, reject) => {
        NativeModules.RNNetPrinter.printRawData(
          processed.text,
          processed.opts,
          (msg: string) => {
            cbSuccess?.(msg);
            resolve();
          },
          (error: Error) => {
            cbErr?.(error);
            reject(error);
          },
        );
      });
    }
    return writeByBase64('lan', textTo64Buffer(text, opts), opts?.keepConnection, cbSuccess, cbErr);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// USB lifecycle helpers (app-specific, không có trong upstream) — `ThermalPrinterModule`
// là native module singleton dùng chung `EscPosDriver` + `TsplDriver` (qua
// `UsbTransport`).
// ─────────────────────────────────────────────────────────────────────────────

const initPromises: Partial<Record<ConnectionType, Promise<void>>> = {};

/**
 * `ThermalPrinterModule` là native singleton dùng chung cho mọi connectionType
 * — gọi `init()` 2 lần từ 2 driver/adapter độc lập cho CÙNG 1 connectionType
 * sẽ đăng ký trùng side-effect (vd USB đăng ký lại BroadcastReceiver). Memoize
 * theo connectionType để toàn app chỉ `init()` đúng 1 lần / loại kết nối.
 */
export const ensureNativeInitialized = (connectionType: ConnectionType): Promise<void> => {
  const existing = initPromises[connectionType];
  if (existing) return existing;
  const ns = connectionType === 'usb' ? USBPrinter : connectionType === 'bluetooth' ? BLEPrinter : NetPrinter;
  const promise = ns.init();
  initPromises[connectionType] = promise;
  return promise;
};

/** @deprecated dùng `ensureNativeInitialized('usb')`. */
export const ensureUsbInitialized = (): Promise<void> => ensureNativeInitialized('usb');

/**
 * Ghi byte thô (base64) qua USB — native decode base64 rồi `bulkTransfer()`
 * gửi nguyên byte, KHÔNG qua encode ESC/POS như `printText`. Dùng cho TSPL
 * (giao thức byte thô).
 */
export const printRawDataUsb = (base64Data: string, keepConnection: boolean): Promise<void> =>
  writeByBase64('usb', base64Data, keepConnection);

/** Ghi byte thô (base64) qua Bluetooth — không encode. */
export const printRawDataBluetooth = (base64Data: string, keepConnection: boolean): Promise<void> =>
  writeByBase64('bluetooth', base64Data, keepConnection);

/** Ghi byte thô (base64) qua LAN — không encode. */
export const printRawDataLan = (base64Data: string, keepConnection: boolean): Promise<void> =>
  writeByBase64('lan', base64Data, keepConnection);

// ─────────────────────────────────────────────────────────────────────────────
// Boundary cho `EscPosDriver`: chọn namespace theo connectionType.
// ─────────────────────────────────────────────────────────────────────────────

/** Tuỳ chọn `printText` cho `EscPosDriver`. / `printText` options for `EscPosDriver`. */
export interface ThermalPrinterPrintTextOptions {
  keepConnection: boolean;
  cut: boolean;
  tailingLine: boolean;
  encoding: 'UTF8';
}

interface ThermalPrinterNamespaceMap {
  usb: typeof USBPrinter;
  bluetooth: typeof BLEPrinter;
  lan: typeof NetPrinter;
}

const namespaces: ThermalPrinterNamespaceMap = { usb: USBPrinter, bluetooth: BLEPrinter, lan: NetPrinter };

export const ThermalPrinterAdapter = {
  /**
   * Generic theo `T extends ConnectionType` (thay vì trả union) để caller
   * gọi `namespaceFor('lan').connectPrinter(ip, port)` được TypeScript suy
   * luận đúng overload của từng namespace — 3 namespace có `connectPrinter`
   * khác chữ ký hẳn nhau (LAN: `(host, port)`, BLE: `(mac)`, USB:
   * `(vendorId, productId)`), trả union sẽ làm TS giao (intersect) tham số
   * của cả 3 chữ ký lại thành `never`.
   */
  namespaceFor: <T extends ConnectionType>(connectionType: T): ThermalPrinterNamespaceMap[T] => namespaces[connectionType],

  /** `printText` giờ tự trả `Promise` thật — không cần bọc callback nữa. */
  printTextAsync(connectionType: ConnectionType, text: string, options: ThermalPrinterPrintTextOptions): Promise<void> {
    return ThermalPrinterAdapter.namespaceFor(connectionType).printText(text, options);
  },
};
```

**Lưu ý quan trọng khi implement**: `writeByBase64` (native) `resolve()` bằng string `"Print SuccessFully"`, không phải `undefined` — hàm JS `writeByBase64`/`printRawDataUsb`/`printRawDataBluetooth`/`printRawDataLan`/`printText` khai `Promise<void>` nhưng thực tế resolve với giá trị đó; không ai đọc giá trị resolve ở call site nào (`NativeAdapter.ts`, `UsbTransport.ts` chỉ `await`, không dùng kết quả) nên không cần bọc thêm `.then(() => undefined)` — giữ đơn giản.

- [ ] **Step 2: Run type-check**

Run: `npm run type-check`
Expected: 0 lỗi liên quan file này (lỗi ở file khác nếu có không thuộc phạm vi task).

- [ ] **Step 3: Commit**

```bash
git add src/features/printer/adapters/native/PrinterNativeModule.ts
git commit -m "refactor: PrinterNativeModule gọi ThermalPrinterModule qua Promise, đổi tên method native"
```

---

### Task 5: Cập nhật test JS

**Files:**
- Modify: `jest.setup.js`
- Modify: `src/features/printer/adapters/native/__tests__/PrinterNativeModule.test.ts`

**Interfaces:**
- Consumes: `PrinterNativeModule.ts` exports (Task 4) — không đổi tên, chỉ đổi return type/implementation.

- [ ] **Step 1: Sửa `jest.setup.js`**

Khối `jest.mock('./src/features/printer/adapters/native/PrinterNativeModule', ...)` (dòng ~80-107) — mock ở mức MODULE (namespace `USBPrinter`/`BLEPrinter`/`NetPrinter` giả), không cần đổi shape các key hiện có (`init`/`getDeviceList`/`connectPrinter`/`closeConn`/`printText` — đây là tên EXPORT JS, không đổi ở Task 4). Chỉ xoá key `printBill` (đã là dead code từ trước, sót lại trong mock — `PrinterNativeModule.ts` không còn `printBill` từ đợt refactor trước đó):

```javascript
jest.mock('./src/features/printer/adapters/native/PrinterNativeModule', () => {
  const namespace = () => ({
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue(undefined),
    closeConn: jest.fn().mockResolvedValue(undefined),
    printText: jest.fn().mockResolvedValue(undefined),
  });
  const USBPrinter = namespace();
  const BLEPrinter = namespace();
  const NetPrinter = namespace();
  const namespaces = { usb: USBPrinter, bluetooth: BLEPrinter, lan: NetPrinter };
  return {
    USBPrinter,
    BLEPrinter,
    NetPrinter,
    ThermalPrinterAdapter: {
      namespaceFor: (connectionType) => namespaces[connectionType],
      printTextAsync: jest.fn().mockResolvedValue(undefined),
    },
    ensureUsbInitialized: jest.fn().mockResolvedValue(undefined),
    ensureNativeInitialized: jest.fn().mockResolvedValue(undefined),
    printRawDataUsb: jest.fn().mockResolvedValue(undefined),
    printRawDataBluetooth: jest.fn().mockResolvedValue(undefined),
    printRawDataLan: jest.fn().mockResolvedValue(undefined),
  };
});
```

Lưu ý: đổi `printText: jest.fn().mockImplementation((_text, _opts, cbSuccess) => cbSuccess?.('ok'))` (kiểu callback cũ) → `printText: jest.fn().mockResolvedValue(undefined)` (kiểu Promise mới) — vì `printText` giờ trả `Promise` thật, mock kiểu cũ (gọi callback đồng bộ, không trả gì) sẽ khiến code gọi `.then()`/`await` trên `undefined` bị lỗi runtime trong test.

Khối stub `NativeModules.ThermalPrinterModule` cho `PrinterNativeModule.test.ts` (dòng ~109-118) đổi tên method + kiểu Promise:

```javascript
// PrinterNativeModule.test.ts dùng requireActual để test bản THẬT (ensureUsbInitialized,
// namespace) — cần NativeModules.ThermalPrinterModule tồn tại vì RN jest preset không có.
{
  const { NativeModules } = require('react-native');
  NativeModules.ThermalPrinterModule = {
    ...NativeModules.ThermalPrinterModule,
    init: jest.fn().mockResolvedValue(null),
    writeByBase64: jest.fn().mockResolvedValue('ok'),
  };
}
```

- [ ] **Step 2: Viết lại `PrinterNativeModule.test.ts`**

```typescript
import { NativeModules } from 'react-native';
import { ConnectionType } from '../../../models/printer/PrinterDevice';

// `ThermalPrinterAdapter` sống trong cùng file với 3 namespace, nên không mock
// riêng namespace được — stub `NativeModules.ThermalPrinterModule` rồi lấy bản
// THẬT qua requireActual (bỏ qua mock toàn cục ở jest.setup.js).
const mkNativeModule = () => ({
  init: jest.fn().mockResolvedValue(null),
  getDeviceList: jest.fn().mockResolvedValue([]),
  openConnect: jest.fn().mockResolvedValue({}),
  disconnect: jest.fn().mockResolvedValue(null),
  writeByBase64: jest.fn().mockResolvedValue('Print SuccessFully'),
});

// Nhánh iOS trong BLEPrinter/NetPrinter.printText gọi thẳng
// NativeModules.RNBLEPrinter/RNNetPrinter (native iOS chưa implement — xem
// Global Constraints trong plan). Jest preset RN mặc định Platform.OS='ios'
// nên nhánh này chạy trong test dù app thật chạy Android — giữ stub tối
// thiểu để không throw, KHÔNG đụng tới vì ngoài phạm vi refactor (Android-only).
const mkLegacyIosStub = () => ({
  printRawData: jest.fn((_text: unknown, _opts: unknown, cbOk?: (m: string) => void) => cbOk?.('ok')),
});

const originals = {
  ThermalPrinterModule: NativeModules.ThermalPrinterModule,
  RNBLEPrinter: NativeModules.RNBLEPrinter,
  RNNetPrinter: NativeModules.RNNetPrinter,
};

beforeEach(() => {
  NativeModules.ThermalPrinterModule = mkNativeModule();
  NativeModules.RNBLEPrinter = mkLegacyIosStub();
  NativeModules.RNNetPrinter = mkLegacyIosStub();
});
afterEach(() => {
  Object.assign(NativeModules, originals);
  jest.resetModules();
});

const loadReal = () =>
  jest.requireActual('../PrinterNativeModule') as typeof import('../PrinterNativeModule');

describe('ThermalPrinterAdapter', () => {
  it('namespaceFor returns the namespace matching each connectionType', () => {
    const { ThermalPrinterAdapter, USBPrinter, BLEPrinter, NetPrinter } = loadReal();
    expect(ThermalPrinterAdapter.namespaceFor(ConnectionType.usb)).toBe(USBPrinter);
    expect(ThermalPrinterAdapter.namespaceFor(ConnectionType.bluetooth)).toBe(BLEPrinter);
    expect(ThermalPrinterAdapter.namespaceFor(ConnectionType.lan)).toBe(NetPrinter);
  });

  it('printTextAsync resolves when the native module invokes the success callback', async () => {
    const { ThermalPrinterAdapter } = loadReal();
    await expect(
      ThermalPrinterAdapter.printTextAsync(ConnectionType.lan, 'hello', {
        keepConnection: true,
        cut: true,
        tailingLine: true,
        encoding: 'UTF8',
      }),
    ).resolves.toBeUndefined();
  });

  it('printTextAsync rejects when the native module invokes the error callback', async () => {
    NativeModules.RNNetPrinter.printRawData = jest.fn(
      (_text: unknown, _opts: unknown, _cbOk?: () => void, cbErr?: (e: Error) => void) => cbErr?.(new Error('boom')),
    );
    const { ThermalPrinterAdapter } = loadReal();
    await expect(
      ThermalPrinterAdapter.printTextAsync(ConnectionType.lan, 'hello', {
        keepConnection: true,
        cut: true,
        tailingLine: true,
        encoding: 'UTF8',
      }),
    ).rejects.toThrow('boom');
  });
});

describe('ensureUsbInitialized', () => {
  it('gọi ThermalPrinterModule.init("usb") đúng 1 lần dù được gọi nhiều lần (memoize)', async () => {
    const { ensureUsbInitialized } = loadReal();
    await ensureUsbInitialized();
    await ensureUsbInitialized();
    expect(NativeModules.ThermalPrinterModule.init).toHaveBeenCalledTimes(1);
    expect(NativeModules.ThermalPrinterModule.init).toHaveBeenCalledWith('usb');
  });
});

describe('printRawDataUsb', () => {
  it('resolve khi native resolve thành công, gọi writeByBase64 (không phải printRawData)', async () => {
    const { printRawDataUsb } = loadReal();
    await expect(printRawDataUsb('QUI=', true)).resolves.toBe('Print SuccessFully');
    expect(NativeModules.ThermalPrinterModule.writeByBase64).toHaveBeenCalledWith('usb', 'QUI=', true);
  });

  it('reject với structured error (code + message) khi native reject', async () => {
    const rejection = Object.assign(new Error('USB fail'), { code: 'WRITE_FAILED' });
    NativeModules.ThermalPrinterModule.writeByBase64 = jest.fn().mockRejectedValue(rejection);
    const { printRawDataUsb } = loadReal();
    await expect(printRawDataUsb('QUI=', true)).rejects.toMatchObject({ code: 'WRITE_FAILED', message: 'USB fail' });
  });
});

describe('USBPrinter.connectPrinter', () => {
  it('gọi native openConnect (không phải connectPrinter) với đúng connection map', async () => {
    const { USBPrinter } = loadReal();
    await USBPrinter.connectPrinter(1234, 5678);
    expect(NativeModules.ThermalPrinterModule.openConnect).toHaveBeenCalledWith({
      type: 'usb',
      vendorId: 1234,
      productId: 5678,
    });
  });
});

describe('USBPrinter.closeConn', () => {
  it('gọi native disconnect (không phải closeConn)', async () => {
    const { USBPrinter } = loadReal();
    await USBPrinter.closeConn();
    expect(NativeModules.ThermalPrinterModule.disconnect).toHaveBeenCalledWith('usb');
  });
});
```

- [ ] **Step 3: Run test suite đầy đủ**

Run: `npm test`
Expected: PASS toàn bộ (bao gồm `PrinterNativeModule.test.ts`, `NativeAdapter.test.ts`, `UsbTransport.test.ts` — 2 file sau dùng global mock ở `jest.setup.js`, không cần sửa nhưng phải PASS để xác nhận không bị ảnh hưởng).

- [ ] **Step 4: Run type-check + lint**

Run: `npm run type-check` — Expected: 0 lỗi.
Run: `npm run lint` — Expected: 0 lỗi.

- [ ] **Step 5: Commit**

```bash
git add jest.setup.js src/features/printer/adapters/native/__tests__/PrinterNativeModule.test.ts
git commit -m "test: cập nhật test cho ThermalPrinterModule Promise API + tên method mới"
```

---

## Self-review (đã chạy)

- **Spec coverage**: §4.1 (PrinterErrorResult) → Task 2. §4.2 (khôi phục getCode/INVALID_ARGUMENT) → Task 1. §4.3 (mapping lỗi + đổi tên method) → Task 3. §4.4 (chữ ký 5 method) → Task 3. §4.5 (JS side) → Task 4. §4.6 (test) → Task 5. §5 (behavior giữ nguyên) → ghi chú rải trong Task 3/4. Đủ.
- **Placeholder scan**: không còn "TBD"/"TODO"/mô tả suông không kèm code.
- **Type consistency**: `PrinterErrorResult.rejectTo(Promise)` (Task 2) khớp cách gọi ở Task 3 (`new PrinterErrorResult(...).rejectTo(promise)` / `PrinterErrorResult.from(e).rejectTo(promise)`). Tên method native trong Task 3 (`openConnect`/`disconnect`/`writeByBase64`) khớp chính xác với lệnh gọi trong Task 4 (`ThermalPrinterModule.openConnect(...)`/`.disconnect(...)`/`.writeByBase64(...)`). Tên export JS (`USBPrinter.connectPrinter`/`.closeConn`/`printText`/`printRawDataUsb` etc.) không đổi giữa Task 4 và Task 5's test assertions.
