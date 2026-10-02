# Feature printer: model, ngôn ngữ in, tầng kết nối — Design Spec

## 1. Mục tiêu

Làm sạch feature `src/features/printer` (TS) ở hai việc gắn liền nhau:

1. **Model**: đặt lại tên cho đúng nghĩa, loại bỏ trạng thái vô nghĩa bằng union, tách model thiết bị khỏi model máy in,
   mỗi model và field có summary ngắn.
2. **Vai trò**: "ngôn ngữ in" (ESC/POS, TSPL) chỉ làm đúng một việc là **encode nội dung thành byte**. Quét thiết bị,
   kết nối, trạng thái, gửi byte gom về **một tầng kết nối chung**, không phân theo ngôn ngữ.

Đây là đợt 1 của việc tái cấu trúc feature printer. Đợt 2 (dọn code các vùng còn lại) và các sửa hành vi khác làm sau.

## 2. Nguyên tắc

1. **Một khái niệm, một tên, một nơi.** Không có hai kiểu gần giống nhau cho cùng một thứ; không có tên trùng nghĩa
   trong cùng một ngữ cảnh.
2. **Model chỉ là dữ liệu** và hàm thuần suy ra từ dữ liệu (vd `deviceIdOf`). Không chứa nhãn UI, không import từ
   `languages/`, `connection/`, `printing/`.
3. **Trạng thái vô nghĩa không biểu diễn được.** Dùng discriminated union theo `type` thay cho field tuỳ chọn dùng chung.
4. **Ngôn ngữ in không biết kết nối; tầng kết nối không biết ngôn ngữ.** Chỗ ghép hai thứ là `printing/` và
   `detection/`.
5. **Hành vi giữ nguyên** trừ những điểm ghi rõ ở §11.

## 3. Ngoài phạm vi

- Dòng rác `~!T` khi dò ngôn ngữ máy cắm USB (dò TSPL vẫn chạy trước).
- TS gửi `devicePath` cho native khi kết nối (hai máy USB giống hệt không serial vẫn nhận `AMBIGUOUS_DEVICE`).
- Dọn code các vùng không bị đổi ở đây (đợt 2): dòng dài, tách hàm trong UI, rendering, paper.
- iOS. Đường in iOS cũ (`printTextLegacyIOS` gọi `RNBLEPrinter`/`RNNetPrinter`) bị bỏ cùng `printText`; native iOS
  chưa có `DeviceModule` nên vốn chưa in được.

## 4. Lưu trữ

`printer.storageVersion` lên **8**. Dữ liệu phiên bản khác bị xoá sạch, người dùng thêm lại máy in (chính sách hiện
có, không migrate). Khối comment lịch sử v1–v7 trong `PrinterStorage.ts` rút còn một dòng nói chính sách.

## 5. Model

Quy ước chung: const-object + type cùng tên (không dùng `enum`, theo `CODING_STYLE.md`); mỗi model một file; summary
tiếng Việt một dòng cho model và cho field cần giải thích (ý nghĩa, đơn vị, định dạng, ràng buộc); một dòng trống giữa
các field; không tham chiếu tài liệu trong comment.

### 5.1 Cấu trúc

```text
models/
├── device/                         dùng lúc tìm thiết bị, không lưu
│   ├── DeviceInfo.ts
│   ├── DiscoveredDevice.ts
│   └── DeviceDiscoveryEvent.ts
├── printer/                        lưu xuống bộ nhớ
│   ├── Printer.ts
│   ├── PrintKind.ts
│   ├── ConnectionType.ts
│   ├── PrinterConnection.ts
│   ├── deviceIdOf.ts
│   ├── PrinterLanguage.ts
│   ├── PrinterCapabilities.ts
│   └── PrinterStatus.ts
├── paper/
│   └── PaperOptions.ts
└── printing/
    ├── PrintDocument.ts
    ├── PrintDocuments.ts
    ├── PrintOptions.ts
    └── PrintJob.ts
```

### 5.2 `models/printer/`

```ts
// PrintKind.ts
/** Loại nội dung một máy in đảm nhận. */
export const PrintKind = {
  Receipt: 'Receipt',
  Label: 'Label',
} as const;

export type PrintKind = (typeof PrintKind)[keyof typeof PrintKind];
```

```ts
// ConnectionType.ts
/** Đường truyền tới máy in. */
export const ConnectionType = {
  Usb: 'Usb',
  Bluetooth: 'Bluetooth',
  Lan: 'Lan',
} as const;

export type ConnectionType = (typeof ConnectionType)[keyof typeof ConnectionType];
```

```ts
// PrinterConnection.ts
/** Cách kết nối tới máy in qua USB. */
export interface UsbPrinterConnection {
  type: typeof ConnectionType.Usb;

  vendorId: number;

  productId: number;

  /** Có khi đã được cấp quyền USB; phân biệt hai máy cùng model. */
  serialNumber?: string;
}

/** Cách kết nối tới máy in qua Bluetooth cổ điển (đã ghép đôi). */
export interface BluetoothPrinterConnection {
  type: typeof ConnectionType.Bluetooth;

  /** Địa chỉ MAC viết hoa. */
  mac: string;
}

/** Cách kết nối tới máy in qua mạng TCP. */
export interface LanPrinterConnection {
  type: typeof ConnectionType.Lan;

  host: string;

  port: number;
}

/** Cách kết nối tới một máy in; đủ để kết nối lại mà không cần quét. */
export type PrinterConnection = UsbPrinterConnection | BluetoothPrinterConnection | LanPrinterConnection;
```

```ts
// PrinterLanguage.ts
/** Ngôn ngữ lệnh của máy in. */
export const PrintLanguage = {
  EscPos: 'EscPos',
  Tspl: 'Tspl',
} as const;

export type PrintLanguage = (typeof PrintLanguage)[keyof typeof PrintLanguage];

/** Ngôn ngữ được xác định tự động (dò) hay do người dùng chọn. */
export const LanguageSelection = {
  Auto: 'Auto',
  Manual: 'Manual',
} as const;

export type LanguageSelection = (typeof LanguageSelection)[keyof typeof LanguageSelection];

/** Cách biến nội dung thành lệnh in. */
export const RenderMode = {
  /** Gửi lệnh văn bản của ngôn ngữ; nhanh, phụ thuộc font/codepage của máy. */
  Command: 'Command',

  /** Gửi nội dung dưới dạng ảnh; chậm hơn, đúng trên mọi máy. */
  Raster: 'Raster',
} as const;

export type RenderMode = (typeof RenderMode)[keyof typeof RenderMode];

/** Nguồn tạo ảnh khi in `Raster`. */
export const RasterSource = {
  /** Chụp màn hình bản xem trước. */
  Image: 'Image',

  /** Vẽ trực tiếp từ `PrintDocument` lên canvas, không cần màn hình. */
  Ast: 'Ast',
} as const;

export type RasterSource = (typeof RasterSource)[keyof typeof RasterSource];

/** Cấu hình ngôn ngữ in của một máy in. */
export interface PrinterLanguage {
  /** Ngôn ngữ lệnh mà máy in sử dụng. */
  type: PrintLanguage;

  /** Cách xác định ngôn ngữ; chỉ để hiển thị. */
  selection: LanguageSelection;

  renderMode: RenderMode;

  /** Chỉ có tác dụng khi `renderMode` là `Raster`. */
  rasterSource: RasterSource;
}
```

```ts
// PrinterCapabilities.ts
/** Khả năng phần cứng của máy in; hiện chỉ khai báo, chưa chặn hành vi in. */
export interface PrinterCapabilities {
  /** Có dao cắt giấy. */
  cutter: boolean;

  /** Có cổng mở ngăn kéo tiền. */
  cashDrawer: boolean;

  /** In được màu. */
  color: boolean;

  /** In được ảnh. */
  image: boolean;
}
```

```ts
// PrinterStatus.ts: giữ 7 giá trị hiện có, thêm summary
/** Trạng thái kết nối của một máy in trong phiên chạy hiện tại; không lưu. */
// Idle, Connecting, Connected, Disconnecting, Disconnected, Reconnecting, Error
```

```ts
// Printer.ts
/** Một máy in đã lưu: đúng một kết nối, một ngôn ngữ, một loại nội dung và một cấu hình giấy. */
export interface Printer {
  /** ID của bản ghi, sinh khi tạo, không đổi khi sửa. */
  id: string;

  /**
   * Định danh máy in vật lý, tính từ `connection`, ổn định qua các lần cắm (vd `usb:8137:8214:SN123`). Unique theo
   * cặp (`deviceId`, `kind`). Không so với `DeviceInfo.deviceId`.
   */
  deviceId: string;

  kind: PrintKind;

  /** Tên hiển thị do người dùng đặt. */
  name: string;

  /** Hãng thiết bị, nếu đọc được lúc thêm máy. */
  vendor?: string;

  /** Model thiết bị, nếu đọc được lúc thêm máy. */
  model?: string;

  connection: PrinterConnection;

  language: PrinterLanguage;

  paper: PaperOptions;

  capabilities: PrinterCapabilities;

  /** Tự kết nối lại khi mở app và khi mất kết nối lúc in. */
  autoReconnect: boolean;

  /** Tắt thì không nhận lệnh in nhưng vẫn giữ cấu hình. */
  enabled: boolean;

  /** Thời điểm tạo, ISO 8601 UTC. */
  createdAt: string;

  /** Thời điểm cập nhật, ISO 8601 UTC. */
  updatedAt: string;
}
```

`deviceIdOf(connection: PrinterConnection): string` (đổi tên từ `resolveIdentityKey`, giữ nguyên định dạng:
`usb:<vid>:<pid>[:<serial>]`, `bluetooth:<MAC viết hoa>`, `lan:<host>:<port>`) là nơi duy nhất tính `deviceId`.
`PrinterRepository` luôn tính lại khi lưu, không tin giá trị truyền vào.

### 5.3 `models/device/`

```ts
// DeviceInfo.ts
/** Thông tin cơ bản của một thiết bị tìm thấy khi quét. */
export interface DeviceInfo {
  /** Định danh thiết bị trong lần discovery hiện tại (native trả về), dùng làm key danh sách. */
  deviceId: string;

  /** Tên thiết bị; native không có thì dùng MAC hoặc đường dẫn thiết bị. */
  name: string;

  /** Nhà sản xuất, nếu đọc được (chỉ USB). */
  manufacturer?: string;

  /** Model hoặc tên sản phẩm, nếu đọc được (chỉ USB). */
  model?: string;

  /** App đã được cấp quyền dùng thiết bị chưa; quét không mở hộp thoại xin quyền. */
  hasPermission: boolean;
}
```

```ts
// DiscoveredDevice.ts
/** Một kết quả quét: thiết bị và cách kết nối tới nó. */
export interface DiscoveredDevice {
  device: DeviceInfo;

  /** Chọn máy thì gán thẳng vào `Printer.connection`. */
  connection: PrinterConnection;
}
```

```ts
// DeviceDiscoveryEvent.ts
export const DeviceDiscoveryEventType = { Loading: 'Loading', Found: 'Found', Empty: 'Empty', Error: 'Error' } as const;

/** Một cập nhật trong lúc tìm thiết bị. */
export type DeviceDiscoveryEvent =
  | { type: typeof DeviceDiscoveryEventType.Loading }
  | { type: typeof DeviceDiscoveryEventType.Found; devices: DiscoveredDevice[] }
  | { type: typeof DeviceDiscoveryEventType.Empty }
  | { type: typeof DeviceDiscoveryEventType.Error; error: PrinterError };
```

Ánh xạ từ native (`NativeAdapter`):

| `DiscoveredDevice` | USB (`NativeUsbDeviceInfo`) | Bluetooth (`NativeBluetoothDeviceInfo`) |
|---|---|---|
| `device.deviceId` | `deviceId` | `deviceId` |
| `device.name` | `name` (native đã fallback đường dẫn) | `name ?? address.mac` |
| `device.manufacturer` / `model` | `manufacturerName` / `productName` (`null` → bỏ) | — |
| `device.hasPermission` | `hasPermission` | `true` |
| `connection` | `{ Usb, vendorId, productId, serialNumber? }` (bỏ `devicePath`) | `{ Bluetooth, mac }` |

Quy tắc: muốn biết một kết quả quét có phải máy đã lưu thì so `printer.deviceId === deviceIdOf(discovered.connection)`;
không bao giờ so `Printer.deviceId` với `DeviceInfo.deviceId`.

### 5.4 `models/paper/PaperOptions.ts`

```ts
export const PaperSize = { Mm58: 58, Mm80: 80, Mm100: 100, Mm104: 104 } as const;   // giữ nguyên

/** Giấy cuộn liên tục hay giấy tem rời có khe. */
export const PaperType = { Continuous: 'Continuous', DieCut: 'DieCut' } as const;   // đổi từ PrintPaperType

export const CutterMode = { None: 'None', PerJob: 'PerJob', PerRow: 'PerRow' } as const;   // giữ nguyên

/** Giấy cuộn liên tục. */
export interface ContinuousPaper {
  type: typeof PaperType.Continuous;

  /** Khổ giấy (mm). */
  paperSize: PaperSize;

  /** Thời điểm cắt giấy; mặc định `PerJob`. */
  cutterMode: CutterMode;
}

/** Giấy tem rời; tách bằng răng cưa nên không cắt. */
export interface DieCutPaper {
  type: typeof PaperType.DieCut;

  /** Khổ giấy (mm). */
  paperSize: PaperSize;

  /** Chiều rộng một con tem (mm). */
  itemWidthMm: number;

  /** Chiều cao một con tem (mm). */
  itemHeightMm: number;

  /** Số con tem trên một hàng. */
  columns: number;

  /** Khe giữa hai con tem cạnh nhau (mm). */
  horizontalGapMm: number;

  /** Khe giữa hai hàng tem (mm). */
  verticalGapMm: number;
}

/** Cấu hình giấy của một máy in. */
export type PaperOptions = ContinuousPaper | DieCutPaper;
```

Form thêm/sửa máy in giữ giá trị đang nhập dở bằng `PaperDraft` (mọi field tuỳ chọn, đặt ở `forms/addPrinter/`), chỉ đổi
sang `PaperOptions` khi lưu qua `printerSchema`. `resolveEffectiveCutterMode`, `dieCutRowOverflow`, `dieCutMediaError`
viết lại theo union (không còn kiểm tra field `undefined` với `PaperOptions`; kiểm tra thiếu field chuyển sang
`PaperDraft`).

### 5.5 `models/printing/`

- `PrintDocuments` (`text: PrintDocument`, `image?: string` base64 PNG không tiền tố `data:`) và `PrintOptions`
  (`rows?: number`) chuyển từ `drivers/IPrinterDriver.ts` sang đây, mỗi kiểu một file.
- `PrintJob.printType` → `kind: PrintKind`.
- `PrintTarget` bị xoá (không ai dùng).
- `PRINT_TYPE_LABELS` → `PRINT_KIND_LABELS` trong `utils/printKindLabels.ts` (UI và thông báo lỗi của `PrintService`
  cùng dùng).

## 6. Ngôn ngữ in (`languages/`)

```text
languages/
├── IPrintLanguage.ts
├── getPrintLanguage.ts
├── escpos/
│   ├── EscPosLanguage.ts
│   ├── EscPosTextBuilder.ts         (chuyển từ drivers/escpos)
│   ├── EscPosRasterEncoder.ts       (đổi tên từ EscPosBitmapEncoder)
│   └── EPToolkit.ts, buffer-helper.ts (chuyển từ adapters/native/utils)
└── tspl/
    ├── TsplLanguage.ts
    ├── TsplEncoder.ts               (chuyển từ drivers/tspl)
    └── strategies/                  (TsplCommandStrategy ← TsplTextStrategy, TsplRasterStrategy ← TsplBitmapStrategy)
```

```ts
// IPrintLanguage.ts
/** Lệnh dò để nhận ra máy in nói ngôn ngữ này, và cách đọc phản hồi. */
export interface IdentifyProbe {
  command: Uint8Array;

  matches(response: Uint8Array): boolean;
}

/** Một ngôn ngữ lệnh máy in: chỉ biến nội dung thành byte, không biết kết nối. */
export interface IPrintLanguage {
  /** Kiểm tra rồi encode; nội dung không in được (thiếu ảnh, ảnh quá cao…) ném `PrinterErrorException`. */
  encode(printer: Printer, documents: PrintDocuments, options?: PrintOptions): Uint8Array;

  /** Không có nghĩa là ngôn ngữ này không có lệnh dò (ESC/POS). */
  identifyProbe?: IdentifyProbe;
}
```

- `getPrintLanguage(type: PrintLanguage): IPrintLanguage`: một `switch`, không có registry object.
- `EscPosLanguage.encode`: `Command` → `EscPosTextBuilder` + `EPToolkit` ra byte (bỏ tiền tố khởi tạo y hệt mẹo
  `.replace('G0AcJhxD/xsy', '')` hiện tại, làm trên byte), cắt giấy theo `resolveEffectiveCutterMode`; `Raster` →
  `EscPosRasterEncoder` (giữ các lỗi `IMAGE_REQUIRED`, `IMAGE_INVALID`, `IMAGE_TOO_LARGE`).
- `TsplLanguage.encode`: chọn strategy theo `renderMode`, `validate` rồi `encode` như `TsplDriver.buildBytes` hiện tại;
  `rows` = `options.rows ?? 1`.
- `TsplLanguage.identifyProbe`: `~!T\r\n`, khớp khi phản hồi có ít nhất 1 byte (giữ hành vi hiện tại).
- **Bắt buộc:** byte encode ra giống hệt byte driver hiện tại gửi, cho cùng `Printer` + `PrintDocuments`. Test so sánh
  với kết quả của code cũ (chụp làm fixture trước khi xoá driver).

## 7. Tầng kết nối (`connection/`, `adapters/`)

### 7.1 Adapter

- `IPrinterAdapter` bỏ `printText` và `PrinterPrintTextOptions`; `source` còn `'native' | 'vendor'`; thêm
  `onLost(callback): Unsubscribe` (adapter báo kết nối của chính nó bị mất). `PrinterConnectTarget` bị bỏ:
  `connect(connection: PrinterConnection)`; `listDevices(type)` trả `DiscoveredDevice[]`.
- `NativeAdapter` dùng cho cả USB, Bluetooth, LAN. `onLost` cài bằng `subscribeDeviceDisconnected`, so `connectionId`
  của lease hiện tại.
- `connection/createPrinterAdapter.ts` trả `new NativeAdapter()`; `createPrinterAdapter.web.ts` trả adapter ném
  `PRINTER_UNSUPPORTED_CONNECTION` (thay `DriverRegistry.web.ts`).
- `VendorAdapter` giữ dạng khung, sửa theo interface mới.
- Xoá: `LibraryAdapter`, `adapters/library/`, `transports/` (`BluetoothTransport`, `LanTransport`,
  `transport.config.ts`), `resolvePrinterAdapter.ts`; gỡ `react-native-bluetooth-classic`, `react-native-tcp-socket`
  khỏi `package.json` nếu không còn nơi dùng.

### 7.2 `PrinterConnectionService`

```ts
createPrinterConnectionService(deps: {
  createAdapter: () => IPrinterAdapter;
  ensureBluetoothPermission: () => Promise<boolean>;
})
```

| Hàm | Làm gì |
|---|---|
| `connect(printer: Printer)` | Dùng cho cả máy đã lưu lẫn bản nháp. Bluetooth thì xin quyền trước. Tạo adapter mới, `connect(printer.connection)`; thành công mới thay phiên cũ, rồi trả adapter cũ (lỗi trả chỉ ghi log). Cập nhật trạng thái `Connecting` → `Connected` / `Error` |
| `disconnect(printerId)` | `Disconnecting` → trả adapter → `Disconnected`; chưa kết nối thì chỉ đặt `Disconnected` |
| `send(printerId, bytes)` | Ghi qua adapter của phiên; chưa kết nối → `PRINTER_NOT_CONNECTED` |
| `read(printerId, timeoutMs)` | Đọc phản hồi; `null` khi hết hạn |
| `getStatus(printerId)` / `onStatusChange(printerId, cb)` | Theo phiên trong bộ nhớ, không cần repository |
| `reconnect(printerId)`, `reconnectAutoPrinters()` | Như hiện tại, đọc máy in từ `PrinterRepository` |

- Trạng thái phiên: `Map<printerId, { adapter; status }>`; adapter `onLost` → `Disconnected`.
- Bỏ các biến thể `connectDraft`, `disconnectForDriver`, `getStatusForDriver`, `onStatusChangeForDriver` (lý do tồn
  tại cũ là phải tra driver).
- Không còn `activeByType`: nhiều máy ESC/POS cùng loại kết nối kết nối được cùng lúc.

### 7.3 `PrinterConnectionLock`

Khoá theo máy vật lý: key = `printer.deviceId` (bản nháp: `deviceIdOf(printer.connection)`). Bỏ
`connectionResourceKey`/`resourceKeyFor` theo ngôn ngữ. `createResourceLock` giữ nguyên.

## 8. Tìm thiết bị và dò ngôn ngữ

| Cũ | Mới |
|---|---|
| `discovery/DeviceScanService` (`scanDevices`, `scanForConnectionType`, `discoverDriver`) | `discovery/DeviceDiscoveryService.discover(connectionType, onEvent)` |
| `discovery/PrinterDiscoveryService` (`createDiscoverDriver`) | `detection/LanguageDetectionService.detect({ draftPrinter }, onEvent)` |
| `DiscoveryEvent`, `DiscoveryStage` | `LanguageDetectionEvent`, `LanguageDetectionStage` (`Connecting`, `Identifying`, `Detected`, `Unknown`, `Error`) |
| `discovery/PrinterResolver` (`resolveIdentityKey`, `build*Connection`, `deviceFromConnection`) | `models/printer/deviceIdOf.ts`; bỏ các hàm dựng kết nối và `deviceFromConnection` |
| `hooks/addPrinter/useProtocolDiscovery` | `hooks/addPrinter/useLanguageDetection` |
| `components/DeviceScanList` | `components/DiscoveredDeviceList` |

- `discover`: LAN → `Empty`; Bluetooth → xin quyền rồi `adapter.listDevices`; USB → `adapter.listDevices`. Log
  `__DEV__` hiện có giữ lại theo model mới.
- `detect`: kết nối bản nháp **một lần** qua `PrinterConnectionService.connect`; lần lượt `Tspl`, `EscPos` (lọc bằng
  `canPrintKind(language, draftPrinter.kind)`):
  - ngôn ngữ có `identifyProbe` → `send` lệnh dò, `read` trong `IDENTIFY_TIMEOUT_MS`; `matches` → `Detected`;
  - ngôn ngữ không có lệnh dò (ESC/POS) → `Detected` khi đã kết nối và đường truyền không phải USB (giữ hành vi "xác
    nhận yếu" hiện tại); USB không bao giờ tự xác nhận ESC/POS.
  - Không ngôn ngữ nào khớp → `Unknown` và ngắt kết nối; kết nối thất bại → `Error`. Huỷ giữa chừng → ngắt kết nối.
  - Sự kiện `Detected` trả `PrinterLanguage` dựng bằng `createPrinterDraft`.

## 9. In (`printing/`)

- `PrinterPrintService.print(printerId, documents, options?)`: lấy `Printer`; chưa `Connected` thì
  `PrinterConnectionService.connect`; `bytes = getPrintLanguage(printer.language.type).encode(...)`;
  `PrinterConnectionService.send`. Không tự khoá (được `PrintScheduler` gọi bên trong khoá).
- `testPrint(printer, documents, options?)`: như trên nhưng tự khoá theo `deviceId`.
- `PrintScheduler`: khoá theo `printer.deviceId`.
- `PrintRoutingService`: lọc theo `printer.kind`.
- `PrintService`: `imageDocumentTarget` dùng `printer.language.renderMode === RenderMode.Raster` và `rasterSource`
  (bỏ `usesBitmapRenderMode`).
- Log `PrinterLogger`: tham số `protocol` → `language`; sự kiện quét → `discoveryStarted/discoveryCompleted/
  discoveryFailed`; sự kiện dò → `detectionStarted`, `languageDetected`, `languageUnknown`, `detectionFailed`,
  `detectionCandidateRejected`.

## 10. Phía printer: mặc định và ràng buộc

- `management/createPrinterDraft.ts`: `createPrinterDraft({ id?, kind, connection, language })` trả `Printer` nháp với
  mặc định:

  | Field | ESC/POS | TSPL |
  |---|---|---|
  | `renderMode` | `Command` | `Raster` |
  | `rasterSource` | `Image` | `Image` |
  | `capabilities` | `{ cutter: true, cashDrawer: true, color: false, image: true }` | `{ cutter: false, cashDrawer: false, color: false, image: true }` |
  | `paper` | `{ Continuous, Mm80, cutterMode: PerJob }` | như ESC/POS |

  Mọi nơi tạo máy in (luồng thêm máy, dò ngôn ngữ, chọn ngôn ngữ tay) dùng hàm này.
- `forms/addPrinter/printerRules.ts`: `canPrintKind(language, kind)` (ESC/POS chỉ `Receipt`; TSPL cả hai).
  `printerSchema`, `LanguageDetectionService`, UI chọn ngôn ngữ tay cùng dùng.
- `printerSchema`: `discriminatedUnion` cho `paper` và `connection`; `capabilities` 4 boolean; `language` theo §5.2;
  quy tắc ESC/POS chỉ giấy cuộn và `canPrintKind` giữ như hiện tại.
- Xoá: `drivers/DriverCapabilities.ts`, `drivers/driverConfig.ts` (`DEFAULT_PAPER` vào `createPrinterDraft`).

## 11. Hành vi thay đổi

| # | Trước | Sau | Kiểm tra |
|---|---|---|---|
| 1 | TSPL qua Bluetooth/LAN đi `LibraryAdapter` (thư viện JS) | Đi native `DeviceModule` như ESC/POS | Máy thật |
| 2 | Quét Bluetooth bằng `RNBluetoothClassic.startDiscovery` (cả máy chưa ghép đôi) | `DeviceModule.discover('bluetooth')` (chỉ máy đã ghép đôi) | Máy thật |
| 3 | Một máy ESC/POS mỗi loại kết nối | Không giới hạn | Jest + máy thật |
| 4 | Khoá in theo ngôn ngữ/loại kết nối (`'usb'`, `escpos:bluetooth`) | Theo máy vật lý | Jest + máy thật |
| 5 | Dò ngôn ngữ kết nối lại cho từng ngôn ngữ thử | Kết nối một lần | Jest |
| 6 | Dữ liệu máy in đã lưu (v7) | Bị xoá khi lên v8 | Jest |

## 12. Đổi tên tổng hợp

| Cũ | Mới |
|---|---|
| `PrintType`, `Printer.type`, `PrintJob.printType` | `PrintKind`, `kind` |
| `Printer.identityKey`, `resolveIdentityKey` | `deviceId`, `deviceIdOf` |
| `PrinterConnectionType` | `ConnectionType` |
| `BluetoothPrinterConnection.deviceId`, `.name` | `mac`; bỏ `name` |
| `PrinterDriver`, `Printer.driver`, `PrinterDriverType`, `DriverSource`, `PrinterDriverConfig` | `PrinterLanguage`, `language`, `PrintLanguage`, `LanguageSelection`, (bỏ lớp `config`) |
| `RenderMode.Encoder/Bitmap`, `BitmapSource`, `bitmapSource` | `RenderMode.Command/Raster`, `RasterSource`, `rasterSource` |
| `PrintPaperConfig`, `PrintPaperType` | `PaperOptions`, `PaperType` |
| `PrinterDevice`, `UsbRawDevice`, `PrinterDeviceInfo` | `DiscoveredDevice` + `DeviceInfo`; bỏ hai kiểu kia |
| `DeviceScanEvent(Type)` | `DeviceDiscoveryEvent(Type)` |
| `EscPosDriver`, `TsplDriver`, `IPrinterDriver` | `EscPosLanguage`, `TsplLanguage`, `IPrintLanguage` |
| `useDriverConfig` | `usePrintSettings` |
| `DriverMediaSection`, `DriverRenderModeSection` | `PaperSection`, `RenderModeSection` |
| `PrinterConfigService.setBitmapSource` | `setRasterSource` |

## 13. Quy ước code

Theo `CODING_STYLE.md` của feature, cộng:

1. Summary tiếng Việt một dòng cho mọi model, interface, class, hàm export không hiển nhiên, và field cần giải thích;
   một dòng trống giữa các field và giữa các method.
2. Comment chỉ nói WHY, 1–3 dòng; không kể lịch sử; không tham chiếu tài liệu (số mục spec, tên file tài liệu).
3. Dòng ≤ 120 ký tự (đo bằng Node) ở mọi file mới hoặc bị viết lại; TS nesting ≤ 3; không `any`.
4. Tên đầy đủ, không viết tắt; interface tiền tố `I`.
5. Import module khác qua barrel nếu có.

## 14. Test

- Sửa toàn bộ test hiện có theo tên/model mới; `npx tsc --noEmit`, `npx jest`, `npx eslint src/features/printer`
  xanh sau mỗi bước.
- Mới:
  - `EscPosLanguage`, `TsplLanguage`: byte encode giống fixture chụp từ driver cũ (Command và Raster, giấy cuộn và
    tem, có/không cắt); lỗi ảnh.
  - `PrinterConnectionService`: kết nối/ngắt/trạng thái; kết nối lại trả adapter cũ; `onLost` → `Disconnected`;
    hai máy cùng loại kết nối song song.
  - `LanguageDetectionService`: kết nối một lần; TSPL khớp lệnh dò; ESC/POS xác nhận yếu trừ USB; `Unknown` ngắt
    kết nối; huỷ giữa chừng.
  - `DeviceDiscoveryService`: ánh xạ native → `DiscoveredDevice` theo bảng §5.3.
  - `createPrinterDraft`, `canPrintKind`, `printerSchema` (union giấy/kết nối), `PrinterStorage` v8.
- Kiểm tra trên máy thật: hàng 1–4 bảng §11; thêm máy USB, Bluetooth, LAN; in hoá đơn ESC/POS và tem TSPL.

## 15. Thứ tự triển khai

1. Chụp fixture byte từ `EscPosDriver`/`TsplDriver` hiện tại.
2. Model mới + đổi tên toàn feature + `PaperDraft`, `createPrinterDraft`, `canPrintKind` + storage v8.
3. `languages/` (encode giống fixture).
4. Tầng kết nối: `IPrinterAdapter` mới, `NativeAdapter`, `createPrinterAdapter(.web)`, `PrinterConnectionService`,
   khoá theo `deviceId`.
5. `DeviceDiscoveryService` + `LanguageDetectionService`.
6. `printing/` dùng ngôn ngữ + kết nối; xoá `drivers/`.
7. Xoá `LibraryAdapter`, `transports/`, gỡ thư viện; đổi tên hook/component.
8. Cập nhật `ARCHITECTURE.md` (các mục model, kết nối, driver, adapter, transport, in, discovery, lưu trữ, luồng thêm
   máy, bất biến), `CODING_STYLE.md` (ví dụ tên), `CLAUDE.md`.
9. Kiểm tra trên máy thật.

## 16. Tiêu chí hoàn thành

- Cấu trúc và tên đúng §5–§10, §12; `grep` các tên cũ ở bảng §12 trong `src/` ra rỗng.
- Không còn `drivers/`, `adapters/library/`, `transports/`, `resolvePrinterAdapter`, `DriverRegistry`,
  `DriverCapabilities`, `driverConfig`.
- Model không import từ `languages/`, `connection/`, `printing/`, `components/`.
- Byte encode giống fixture; tsc, jest, eslint xanh.
- Danh sách kiểm tra trên máy thật đã chạy, kết quả ghi trong PR.
