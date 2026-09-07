# Native Printer Bridge: Callback → Promise — Design

Date: 2026-09-05
Status: Approved for planning
Branch: (mới, tách từ `refactor/printer-solid-naming` sau khi PR đó xong, hoặc branch riêng nếu `refactor/printer-solid-naming` chưa merge — xem §6)

## 1. Goal

`ThermalPrinterModule` hiện dùng cặp `Callback successCallback, Callback errorCallback` cho mọi `@ReactMethod` (trừ `closeConn` vốn `void`, không báo kết quả). Đổi cả 5 method sang `com.facebook.react.bridge.Promise` — cơ chế chuẩn RN khuyến nghị cho code mới, map thẳng sang JS `Promise` thật (không cần JS tự bọc `new Promise(...)` thủ công như hiện tại), có cấu trúc lỗi rõ ràng (`code` + `message`) thay vì chỉ 1 message string. Đợt này cũng đổi tên 3 method native cho rõ nghĩa hơn: `connectPrinter` → `connect`, `closeConn` → `disconnect`, `printRawData` → `writeByBase64`.

## 2. Bối cảnh

Đây là refactor tiếp theo trên chuỗi:
`refactor/native-printer-architecture` (kiến trúc layered, đã push, PR pending) → `refactor/printer-solid-naming` (SOLID cleanup: `PrinterConnection` sealed interface, `IPrinterDevice`, `PrinterServiceFactory`, xoá `TransportResolver`, đã push).

`ThermalPrinterModule` hiện tại (sau các đợt refactor trên) có 5 `@ReactMethod`:
```java
void init(String connectionType, Callback successCallback, Callback errorCallback)
void getDeviceList(String connectionType, Callback successCallback, Callback errorCallback)
void connectPrinter(ReadableMap connection, Callback successCallback, Callback errorCallback)
void closeConn(String connectionType)  // KHÔNG có callback — fire-and-forget
void printRawData(String connectionType, String base64Data, Boolean keepConnection, Callback successCallback, Callback errorCallback)
```

Phía JS (`PrinterNativeModule.ts`), mỗi lệnh gọi native đều tự bọc thủ công:
```ts
init: (): Promise<void> =>
  new Promise((resolve, reject) => ThermalPrinterModule.init('usb', () => resolve(), (e) => reject(e))),
```

## 3. Quyết định thiết kế (đã chốt qua brainstorm)

1. **Cả 5 method chuyển sang `Promise`**, kể cả `closeConn`/`disconnect` (dù `IPrinterTransport.disconnect()` không `throws`, giữ nhất quán pattern với 4 method còn lại thay vì là ngoại lệ `void` duy nhất).
2. **Vẫn dùng `resolve()`/`reject()` chuẩn Promise** (không đổi sang model "luôn resolve, tự chứa success/fail bên trong" — JS `try/catch`/`.catch()` hoạt động tự nhiên).
3. **Lỗi phải có cấu trúc** (`code` + `message`), không phải chỉ 1 string message như hiện tại.
4. **Không rải `promise.reject(code.name(), message)` trực tiếp trong từng method** — tập trung vào 1 model `PrinterErrorResult`, mỗi catch-block chỉ gọi `PrinterErrorResult.from(e).rejectTo(promise)`.
5. **Đổi tên 3 method native cho rõ nghĩa**: `connectPrinter` → `connect`, `closeConn` → `disconnect`, `printRawData` → `writeByBase64` (`init`/`getDeviceList` giữ nguyên tên). Đây là tên method Java (`@ReactMethod`) — cũng là tên JS gọi trực tiếp lên `NativeModules.ThermalPrinterModule`. **Tên namespace JS bên ngoài (`USBPrinter.connectPrinter(...)`, `USBPrinter.closeConn()`, `printText`, `printRawDataUsb`/`Bluetooth`/`Lan`) giữ nguyên** — chỉ phần implementation bên trong các hàm đó đổi sang gọi tên native mới, đúng nguyên tắc "public JS namespace signature không đổi" đã giữ xuyên suốt 2 đợt refactor trước.
6. **Triển khai gộp 1 lần** — cả 5 method + `PrinterNativeModule.ts` sửa cùng 1 đợt, không tách nhỏ theo từng method.

## 4. Thiết kế chi tiết

### 4.1 `PrinterErrorResult` — model lỗi tập trung

**Vị trí file: `module/PrinterErrorResult.java`, KHÔNG phải `error/`.**

Lý do: `PrinterErrorResult` import trực tiếp `com.facebook.react.bridge.Promise` — 1 kiểu RN bridge, giống `Callback`. Nguyên tắc gốc của kiến trúc (đã áp dụng xuyên suốt `refactor/native-printer-architecture`) là **RN bridge type chỉ được tồn tại trong package `module/`** — `error/PrinterException.java` và `error/PrinterErrorCode.java` hiện tại hoàn toàn không biết React Native tồn tại. Đặt `PrinterErrorResult` vào `error/` sẽ làm ô nhiễm package đó bằng 1 RN dependency, phá nguyên tắc "Callback boundary chỉ ở ThermalPrinterModule" (nay mở rộng thành "RN bridge type chỉ ở package `module/`").

```java
package com.ndtcorepos.thermalprinter.module;

import com.facebook.react.bridge.Promise;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;

/**
 * Chuyển PrinterException/PrinterErrorCode thành 1 lần reject(code, message)
 * duy nhất — mọi @ReactMethod dùng chung, không rải string literal.
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

### 4.2 Khôi phục 2 thứ đã xoá ở final review trước — nay có consumer thật

- **`PrinterException.getCode()`**: đã xoá ở fix wave cuối (`95878bb`) vì lúc đó không ai gọi. `PrinterErrorResult.from(e)` gọi lại → thêm lại getter này vào `error/PrinterException.java`. Field `code` hiện đã được giữ lại trong constructor (không bị xoá), chỉ thiếu getter.
- **`PrinterErrorCode.INVALID_ARGUMENT`**: đã xoá ở plan gốc (self-review) vì không ai throw lúc đó. Nay cần cho nhánh `IllegalArgumentException` trong `writeByBase64` (base64 decode lỗi, hoặc `PrinterData` constructor ném `"Printer data must not be empty"`) — không có code nào trong 6 code hiện tại (`UNSUPPORTED_CONNECTION`/`DEVICE_NOT_FOUND`/`DEVICE_NOT_CONNECTED`/`DISCOVERY_FAILED`/`CONNECTION_FAILED`/`WRITE_FAILED`) khớp ngữ nghĩa "input sai định dạng". Thêm lại `INVALID_ARGUMENT` vào `error/PrinterErrorCode.java`.

### 4.3 Mapping lỗi → code cho từng method

| Method (tên mới) | Nguồn lỗi | `PrinterErrorCode` |
|---|---|---|
| `init` | `ConnectionType.fromWireValue()` ném `IllegalArgumentException` (không thể xảy ra thực tế — string luôn literal cố định từ JS, nhưng vẫn catch cho đầy đủ) | `UNSUPPORTED_CONNECTION` |
| `init` (Bluetooth) | Adapter null / chưa bật | `CONNECTION_FAILED` |
| `getDeviceList` | `PrinterException` từ `printerService.discover()` | `e.getCode()` |
| `getDeviceList` | Danh sách rỗng | `DEVICE_NOT_FOUND` |
| `getDeviceList` | `fromWireValue` ném `IllegalArgumentException` | `UNSUPPORTED_CONNECTION` |
| `connect` (cũ: `connectPrinter`) | `PrinterException` từ `printerService.connect()` | `e.getCode()` |
| `connect` (cũ: `connectPrinter`) | `toPrinterConnection()` — `fromWireValue` ném `IllegalArgumentException` | `UNSUPPORTED_CONNECTION` |
| `disconnect` (cũ: `closeConn`) | `PrinterException` từ `printerService.disconnect()` (thực tế không throw vì `IPrinterTransport.disconnect()` không `throws`, nhưng `resolveTransport()` bên trong `PrinterService.disconnect()` có `throws PrinterException`) | `e.getCode()` |
| `disconnect` (cũ: `closeConn`) | `fromWireValue` ném `IllegalArgumentException` | `UNSUPPORTED_CONNECTION` |
| `writeByBase64` (cũ: `printRawData`) | `fromWireValue` ném `IllegalArgumentException` | `UNSUPPORTED_CONNECTION` |
| `writeByBase64` (cũ: `printRawData`) | `PrinterException` từ `printerService.write()` | `e.getCode()` |
| `writeByBase64` (cũ: `printRawData`) | Base64 decode lỗi / `PrinterData` rỗng — `IllegalArgumentException` | `INVALID_ARGUMENT` |

**Lưu ý cấu trúc lại `writeByBase64`**: code cũ (`printRawData`) để `fromWireValue()` chung 1 try-block với base64 decode bên trong `Thread`, nên cả 2 loại lỗi khác nhau (sai connection type vs sai input data) bị gộp chung 1 catch `IllegalArgumentException` — sẽ trả nhầm code nếu không tách. Parse `connectionType` **trước khi** spawn thread (bản thân việc này không cần chạy nền), catch riêng để trả đúng `UNSUPPORTED_CONNECTION`; base64/PrinterData decode vẫn ở trong thread, catch riêng trả `INVALID_ARGUMENT`:

```java
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
```

### 4.4 Chữ ký 5 method sau khi đổi

```java
void init(String connectionType, Promise promise)
void getDeviceList(String connectionType, Promise promise)
void connect(ReadableMap connection, Promise promise)          // cũ: connectPrinter
void disconnect(String connectionType, Promise promise)            // cũ: closeConn
void writeByBase64(String connectionType, String base64Data, Boolean keepConnection, Promise promise)  // cũ: printRawData
```

`writeByBase64` vẫn chạy trong `new Thread(() -> {...}).start()` như cũ (trừ phần parse `connectionType`, xem §4.3) — gọi `promise.resolve()`/`promise.reject()` từ background thread an toàn (RN bridge tự marshal, giống hệt `Callback.invoke()` đã làm trước đây, không đổi đặc tính threading).

### 4.5 JS side (`PrinterNativeModule.ts`)

Xoá toàn bộ boilerplate `new Promise((resolve, reject) => ...)` — Java nhận `Promise` làm tham số cuối thì JS **không truyền tham số đó**, RN tự trả về 1 `Promise` thật. Tên hàm JS export (`connectPrinter`, `closeConn`, `printText`) **giữ nguyên** — chỉ đổi native method được gọi bên trong:

```ts
// USBPrinter
init: (): Promise<void> => ThermalPrinterModule.init('usb'),

getDeviceList: (): Promise<IUSBPrinter[]> => ThermalPrinterModule.getDeviceList('usb'),

connectPrinter: (vendorId: number, productId: number): Promise<IUSBPrinter> =>
  ThermalPrinterModule.connect({ type: 'usb', vendorId, productId }),   // gọi connect, không phải connectPrinter

closeConn: (): Promise<void> => ThermalPrinterModule.disconnect('usb'),     // gọi disconnect, không phải closeConn
```

`printRawDataUsb`/`printRawDataBluetooth`/`printRawDataLan` (tên export JS giữ nguyên) và cả 3 `printText` (USB/BLE/Net) đều cuối cùng gọi `ThermalPrinterModule.writeByBase64(...)` — rút thành 1 helper JS dùng chung thay vì lặp lại 6 lần:

```ts
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
    result.then((msg) => cbSuccess?.(msg as unknown as string), (error: Error) => cbErr?.(error));
  }
  return result;
};
```

`printText` (USB — không có nhánh iOS) gọi thẳng helper trên:

```ts
printText: (text: string, opts: PrinterOptions = {}, cbSuccess?: SuccessCallback, cbErr?: ErrorCallback): Promise<void> =>
  writeByBase64('usb', textTo64Buffer(text, opts), opts?.keepConnection, cbSuccess, cbErr),
```

`printRawDataUsb`/`Bluetooth`/`Lan` cũng gọi thẳng helper, bỏ hết phần `new Promise(...)` thủ công:

```ts
export const printRawDataUsb = (base64Data: string, keepConnection: boolean): Promise<void> =>
  writeByBase64('usb', base64Data, keepConnection);
```

**`printText` của `BLEPrinter`/`NetPrinter` có nhánh iOS — nhánh này giữ nguyên lệnh gọi native (`NativeModules.RNBLEPrinter`/`RNNetPrinter`, method `printRawData`, không đổi tên, module khác ngoài phạm vi) nhưng PHẢI tự bọc `new Promise(...)` quanh callback hiện có**, vì `printText` khai `Promise<void>` áp dụng cho CẢ 2 platform — nếu nhánh iOS không trả gì (như code hiện tại), `await`/`.then()` ở phía gọi sẽ nhận `undefined` thay vì 1 Promise thật trên iOS, vỡ hợp đồng kiểu:

```ts
printText: (text: string, opts: PrinterOptions = {}, cbSuccess?: SuccessCallback, cbErr?: ErrorCallback): Promise<void> => {
  if (Platform.OS === 'ios') {
    const processed = textPreprocessingIOS(text);
    return new Promise((resolve, reject) => {
      NativeModules.RNBLEPrinter.printRawData(
        processed.text,
        processed.opts,
        (msg: string) => { cbSuccess?.(msg); resolve(); },
        (error: Error) => { cbErr?.(error); reject(error); },
      );
    });
  }
  return writeByBase64('bluetooth', textTo64Buffer(text, opts), opts?.keepConnection, cbSuccess, cbErr);
},
```

**Lưu ý giá trị resolve**: native `writeByBase64` `resolve()` bằng string `"Print SuccessFully"`, không phải `undefined` — các hàm JS khai `Promise<void>` nhưng thực tế resolve với giá trị đó. Không call site nào (`NativeAdapter.ts`, `UsbTransport.ts`) đọc giá trị resolve, chỉ `await` để biết hoàn tất — nên không cần bọc thêm `.then(() => undefined)` để "làm sạch" giá trị, giữ đơn giản.

→ **Không cần sửa `NativeAdapter.ts`/`UsbTransport.ts`** (đúng nguyên tắc "public JS namespace signature không đổi" đã giữ xuyên suốt cả 2 đợt refactor trước — chỉ đổi tên method native, không đổi tên export JS).

### 4.6 Test

Có 2 tầng mock khác nhau trong `jest.setup.js`, dễ nhầm lẫn — chỉ tầng thứ 2 mới đổi tên method:

1. **Mock cấp module** (`jest.mock('.../PrinterNativeModule', () => ({ USBPrinter: {...}, ... }))`) — namespace giả mô phỏng đúng **tên export JS** (`init`/`getDeviceList`/`connectPrinter`/`closeConn`/`printText`) — **KHÔNG đổi tên** ở tầng này (export JS không đổi). Chỉ đổi shape return từ callback-style (`jest.fn().mockImplementation((_t, _o, cbSuccess) => cbSuccess?.('ok'))`) sang Promise-style (`jest.fn().mockResolvedValue(...)`), và xoá key `printBill` (dead code sót lại từ trước, `PrinterNativeModule.ts` không còn export này).
2. **Stub `NativeModules.ThermalPrinterModule`** (chỉ dùng cho `PrinterNativeModule.test.ts` qua `requireActual`, mô phỏng NATIVE thật) — đây mới là chỗ đổi tên method: `connectPrinter`/`closeConn`/`printRawData` → `connect`/`disconnect`/`writeByBase64`, và đổi từ callback-invoking (`jest.fn((...args, cbOk) => cbOk(...))`) sang `jest.fn().mockResolvedValue(...)`/`mockRejectedValue(...)`.

`PrinterNativeModule.test.ts`: assertion đổi từ `expect(NativeModules.ThermalPrinterModule.printRawData).toHaveBeenCalledWith('usb', ..., expect.any(Function), expect.any(Function))` sang `expect(NativeModules.ThermalPrinterModule.writeByBase64).toHaveBeenCalledWith('usb', ...)` (không còn callback args, đổi tên method) + `await expect(...).resolves`/`.rejects.toMatchObject({ code: '...' })`. Thêm test mới xác nhận `USBPrinter.connectPrinter(...)` gọi đúng `connect` (không phải `connectPrinter`) và `USBPrinter.closeConn()` gọi đúng `disconnect` (không phải `closeConn`) ở tầng native — đây chính là lớp test bảo vệ cho việc đổi tên, tránh lặp lại kiểu lỗi field-name/method-name từng xảy ra ở refactor trước.

`NativeAdapter.test.ts`/`UsbTransport.test.ts`: không cần sửa (dùng mock cấp module ở trên, tên export JS không đổi — như đã xác nhận ở đợt refactor JS bridge trước).

## 5. Behavior giữ nguyên / ngoài phạm vi

- `connect` (cũ `connectPrinter`) tiếp tục `resolve` bằng map rỗng (không phải thông tin thiết bị thật dù TS khai `Promise<IUSBPrinter>`) — sai lệch có sẵn từ trước khi có refactor này, không sửa (ngoài phạm vi đổi cơ chế bridge).
- iOS branch (`NativeModules.RNBLEPrinter`/`RNNetPrinter`) không đổi — module khác, không liên quan `ThermalPrinterModule`.
- Không đổi threading của `writeByBase64` (vẫn `new Thread(...)`).
- Không đổi logic nghiệp vụ ở `PrinterService`/transport/discovery — chỉ đổi cơ chế báo kết quả qua bridge + tên method.
- Tên namespace JS export (`USBPrinter.connectPrinter`, `USBPrinter.closeConn`, `printRawDataUsb`/`Bluetooth`/`Lan`) không đổi — chỉ đổi tên method native bên trong `ThermalPrinterModule`.

## 6. Rollout

Branch cơ sở: `refactor/printer-solid-naming` đã push nhưng **chưa merge**. Nhánh mới cho việc này nên rẽ từ `refactor/printer-solid-naming` (kế thừa toàn bộ SOLID cleanup) — nếu `refactor/printer-solid-naming` merge trước, rebase nhánh này lên nhánh merge đích.

## 7. Testing / Verify

- `compileDebugJavaWithJavac`: BUILD SUCCESSFUL
- `npm test`: toàn bộ suite pass (không riêng printer)
- `npm run type-check`, `npm run lint`: 0 lỗi
- Không cần test thiết bị thật riêng cho đợt này (không đổi hành vi in ấn/kết nối phần cứng, chỉ đổi cơ chế báo kết quả qua bridge + tên method) — nhưng nên gộp chung với lần test thiết bị thật còn nợ (Task 14 của refactor gốc) khi có điều kiện, vì đổi signature ảnh hưởng toàn bộ luồng gọi.
