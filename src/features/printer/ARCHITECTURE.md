# Printer Feature — Target Architecture

**Loại tài liệu:** Kiến trúc lý tưởng (target), không phải nhật ký thay đổi.
**Phạm vi:** `src/features/printer/` và các feature dùng printer (`cart`,
`application`).
**Protocol:** ESC/POS, TSPL. **Kết nối:** USB, Bluetooth, LAN.
**Coding style:** [`CODING_STYLE.md`](CODING_STYLE.md) (riêng cho feature này,
mở rộng [`docs/CODING_STANDARDS_TS.md`](../../../docs/CODING_STANDARDS_TS.md)).

Tài liệu này mô tả feature printer *nên* trông như thế nào khi hoàn thiện —
không ràng buộc bởi lịch sử từng bản refactor đã qua. Nếu code hiện tại
chưa khớp 100% một phần nào đó, đó là việc còn lại cần làm, không phải lỗi
tài liệu. Không tra cứu spec cũ để hiểu tài liệu này — nó tự đầy đủ.

---

## 1. Mục tiêu và giới hạn

Feature printer cung cấp **duy nhất 1 khả năng** cho phần còn lại của app:
in nội dung (hoá đơn, tem) lên máy in nhiệt qua USB/Bluetooth/LAN, hỗ trợ 2
họ lệnh máy in (ESC/POS, TSPL), với tiếng Việt hiển thị đúng bất kể máy in
có hỗ trợ đúng codepage hay không.

**Không chịu trách nhiệm:** payment, order, cart, business calculation,
kitchen rule, inventory. Feature khác gọi vào qua đúng 2 entry point ở §4,
không được biết gì về USB/Bluetooth/TSPL/ESC-POS bên trong.

**Nguyên tắc cốt lõi, giữ xuyên suốt mọi quyết định thiết kế:**

1. **Không fallback âm thầm.** Cấu hình render (`renderMode`) là hợp đồng
   cứng — thất bại thì báo lỗi rõ ràng, không tự đổi sang cách khác.
2. **Không đoán protocol theo vendor/model.** Chỉ có 2 nguồn sự thật:
   `identify()` thật, hoặc user tự chọn thủ công.
3. **DOWNLOAD font tách biệt hoàn toàn khỏi print.** Cài font là 1 thao tác
   tường minh riêng, không bao giờ tự chạy trong `print()`/`testPrint()`/
   `reconnect()`.
4. **1 giấy vật lý = 1 cấu hình `PrintMedia`.** Máy in tại 1 thời điểm chỉ
   nạp 1 loại giấy — cấu hình khổ giấy/die-cut/cutter thuộc về `Printer`,
   không thuộc về driver nào đang dùng để nói chuyện với nó.
5. **Transport chỉ chuyển byte.** Không lớp nào dưới driver được hiểu
   `TEXT`/`BITMAP`/font/renderMode.

---

## 2. Cấu trúc thư mục

```text
src/features/printer/
├── ARCHITECTURE.md
├── CODING_STYLE.md
│
├── models/
│   ├── printer/          # Printer, PrinterConnection, PrinterDevice,
│   │                      # PrinterDriver, PrinterCapabilities, PrinterStatus
│   ├── printing/         # PrintType, PrintDocument, PrintJob, PrintTarget
│   └── media/            # PrintMedia, PrintMediaType, CutterMode, PaperSize
│
├── errors/                # PrinterError, PrinterErrorCode, errorCodeOf
│
├── drivers/
│   ├── IPrinterDriver.ts
│   ├── DriverRegistry.ts (+ .web.ts)
│   ├── DriverCapabilities.ts
│   ├── driverConfig.ts    # mediaOf/paperSizeOf(printer), renderMode accessors
│   ├── escpos/
│   │   ├── EscPosDriver.ts
│   │   ├── EscPosTextBuilder.ts     # renderMode: 'text'
│   │   └── EscPosBitmapEncoder.ts   # renderMode: 'bitmap' (GS v 0)
│   └── tspl/
│       ├── TsplDriver.ts
│       ├── TsplEncoder.ts
│       ├── TsplFontManager.ts
│       ├── TsplStrategyRegistry.ts
│       └── strategies/    # Bitmap / TrueType / InternalFont
│
├── adapters/
│   ├── IPrinterAdapter.ts
│   ├── resolvePrinterAdapter.ts
│   ├── native/            # NativeAdapter, PrinterNativeModule, EPToolkit
│   ├── library/            # LibraryAdapter
│   ├── vendor/             # VendorAdapter (skeleton)
│   └── testing/            # MockPrinterAdapter
│
├── transports/             # UsbTransport, BluetoothTransport, LanTransport
│
├── discovery/
│   ├── DeviceScanService.ts
│   ├── NetworkInfoService.ts
│   ├── PrinterDiscoveryService.ts
│   └── PrinterResolver.ts
│
├── printing/
│   ├── PrintService.ts          # entry point cho production printing
│   ├── PrintRoutingService.ts   # resolve targets
│   ├── PrintScheduler.ts        # queue + lock
│   └── PrinterPrintService.ts   # print()/testPrint() cho 1 printer
│
├── connection/
│   ├── PrinterConnectionService.ts  # connect/disconnect/reconnect/status
│   └── PrinterConnectionLock.ts     # resource concurrency
│
├── permissions/
│   └── PrinterPermissionService.ts
│
├── management/
│   └── PrinterConfigService.ts   # renderMode/font/media configuration
│
├── logging/
│   └── PrinterLogger.ts
│
├── storage/
│   ├── PrinterRepository.ts
│   ├── PrinterStorage.ts
│   └── PrinterWriteInput.ts
│
├── media/
│   ├── paperSpec.ts       # PAPER_SIZE_SPECS, DOTS_PER_MM, CONTINUOUS_HEIGHT_MM
│   ├── cutter.ts
│   └── validation.ts
│
├── components/
├── hooks/
├── forms/
├── store/
├── utils/
│
└── testing/                # fixture/mock dùng chung — KHÔNG có đuôi `.test.`
    ├── printerFixtures.ts
    └── printerServiceTestKit.ts
```

File logic có test đặt trong `__tests__/` cùng cấp file đó (Jest tự nhận
diện, không cấu hình thêm) — không gom về 1 cây test tập trung.

---

## 3. File Responsibility Matrix

| File | Chịu trách nhiệm | KHÔNG chịu trách nhiệm |
|---|---|---|
| `models/printer/Printer.ts` | `Printer`, `PrinterConnection` (data contract) | Validate, I/O |
| `models/printer/PrinterDevice.ts` | `ConnectionType`, `PrinterDevice`, `PrinterLanConfig`, `DeviceScanEvent` | — |
| `models/printer/PrinterDriver.ts` | `PrinterDriverType`, `DriverSource`, `TsplRenderMode`, `EscPosRenderMode`, `*DriverConfig` | — |
| `models/printer/PrinterCapabilities.ts` | `PrinterCapabilities` | — |
| `models/media/PrintMedia.ts` | `PrintMedia`, `PrintMediaType`, `CutterMode`, `PaperSize` | — |
| `models/printing/PrintDocument.ts` | `PrintElement` (union), `PrintDocument` | — |
| `models/printing/PrintJob.ts` | `PrintJob`, `PrintJobStatus`, `PrintResult` | Scheduling logic |
| `models/printing/PrintTarget.ts` | `PrintTarget` | — |
| `errors/PrinterError.ts` | `PrinterErrorCode`, `PrinterErrorException`, `errorCodeOf` | — |
| `drivers/IPrinterDriver.ts` | Contract mọi driver phải implement | — |
| `drivers/DriverRegistry.ts` | `protocol → driver` (map tĩnh) | Routing, discovery |
| `drivers/DriverCapabilities.ts` | `contentTypes`/`defaultConfig` tĩnh theo protocol | — |
| `drivers/driverConfig.ts` | Accessor thuần: `mediaOf(printer)`, `paperSizeOf(printer)`, `tsplRenderModeOf`/`escPosRenderModeOf`/`usesBitmapRenderMode(driver)` | Side effect |
| `drivers/escpos/EscPosDriver.ts` | Vòng đời + orchestrate render mode cho ESC/POS | Rendering thật (uỷ quyền builder) |
| `drivers/escpos/EscPosTextBuilder.ts` | `PrintDocument` → chuỗi text ESC/POS (renderMode `text`) | Native, connect |
| `drivers/escpos/EscPosBitmapEncoder.ts` | `MonochromeBitmap` → lệnh `GS v 0` (renderMode `bitmap`) | Capture ảnh, decode PNG |
| `drivers/tspl/TsplDriver.ts` | Vòng đời + orchestrate strategy cho TSPL | Rendering thật (uỷ quyền strategy) |
| `drivers/tspl/TsplEncoder.ts` | Builder lệnh TSPL cấp thấp (`SIZE`/`TEXT`/`BITMAP`/`BARCODE`/`QRCODE`/`PRINT`) | Connect, storage |
| `drivers/tspl/TsplFontManager.ts` | TTF asset → lệnh `DOWNLOAD` | Print path, routing |
| `drivers/tspl/TsplStrategyRegistry.ts` | `renderMode → strategy` (map tĩnh) | Rendering thật |
| `drivers/tspl/strategies/*.ts` | `document → TSPL bytes` cho đúng 1 renderMode | Connect, native, storage |
| `adapters/IPrinterAdapter.ts` | Contract `listDevices`/`connect`/`write`/`printText`/`read`/`disconnect` + `toConnectTarget()` | — |
| `adapters/resolvePrinterAdapter.ts` | `(driverType, connectionType) → adapter instance` | — |
| `adapters/native/NativeAdapter.ts` | Adapter qua `PrinterNativeModule` | TSPL/ESC-POS syntax |
| `adapters/library/LibraryAdapter.ts` | Adapter qua `tcp-socket`/`bluetooth-classic` | — |
| `adapters/vendor/VendorAdapter.ts` | Skeleton SDK hãng (chưa tích hợp) | — |
| `transports/UsbTransport.ts` | Chunk + gửi byte qua `PrinterNativeModule` (USB) | Protocol |
| `transports/BluetoothTransport.ts` / `LanTransport.ts` | Gửi/nhận byte qua thư viện tương ứng | Protocol |
| `discovery/DeviceScanService.ts` | Quét thiết bị theo connectionType, log dev | Kết nối, in |
| `discovery/NetworkInfoService.ts` | Lấy IP WiFi hiện tại (gợi ý nhập IP LAN) | Discovery protocol |
| `discovery/PrinterDiscoveryService.ts` | Thử lần lượt driver, xác nhận qua `identify()` | UI, storage |
| `discovery/PrinterResolver.ts` | `resolveIdentityKey(connection)` | Duplicate check (ở `PrinterRepository`) |
| `printing/PrintService.ts` | Entry point production printing | Encode, transport |
| `printing/PrintRoutingService.ts` | `printType → PrintTarget[]` | Print, connect |
| `printing/PrintScheduler.ts` | Queue, lock, gọi `PrinterPrintService` | Encode |
| `printing/PrinterPrintService.ts` | `print()`/`testPrint()` cho 1 printer cụ thể | Connection lifecycle khác |
| `connection/PrinterConnectionService.ts` | `connect`/`disconnect`/`reconnect`/`getStatus`/`onStatusChange`/`connectDraft` | Print dispatch |
| `connection/PrinterConnectionLock.ts` | Mutex theo `resourceKey` | Business logic |
| `permissions/PrinterPermissionService.ts` | Xin quyền runtime (Bluetooth/location) trước scan | Scan thật |
| `management/PrinterConfigService.ts` | `installTsplFont`/`setTsplRenderMode`/`setEscPosRenderMode`/`setPrinterMedia` | Print, discovery |
| `logging/PrinterLogger.ts` | Điểm log chuẩn hoá duy nhất | Business logic |
| `storage/PrinterRepository.ts` | CRUD + identity dedup + `printerSchema.parse()` | Validate business rule ngoài identity |
| `storage/PrinterStorage.ts` | MMKV read/write thô + storage version reset | Identity, validate |
| `media/paperSpec.ts` | Hằng số vật lý: khổ giấy, dot density, ngưỡng an toàn continuous | TSPL/ESC-POS syntax |
| `media/cutter.ts` | `resolveEffectiveCutterMode(media)` | — |
| `media/validation.ts` | Lỗi cấu hình die-cut hiển thị cho UI | Lưu trữ |

---

## 4. Hai entry point duy nhất

```text
Quản lý máy in (scan, connect, config, test print)
    UI → PrinterService-family (connection/, management/, discovery/)

In sản xuất (từ Cart/Order)
    Cart/Order → printing/PrintService
```

Không feature nào ngoài printer được import bất cứ thứ gì từ `drivers/`,
`adapters/`, `transports/` trực tiếp.

---

## 5. Domain Model

### 5.1 `Printer` — 1 giấy vật lý, 1 identity, 1..2 driver

```ts
export interface Printer {
  id: string;
  name: string;
  vendor?: string;
  model?: string;

  connection: PrinterConnection;

  /** Giấy vật lý đang nạp — thuộc Printer, KHÔNG thuộc driver nào (§7). */
  media: PrintMedia;

  capabilities: PrinterCapabilities;

  /** 1..2 phần tử — tối đa 1 ESC/POS + 1 TSPL, enforce ở schema. */
  drivers: PrinterDriver[];

  identityKey: string;
  autoReconnect: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

`identityKey` định danh **physical printer** — chỉ phụ thuộc `connection`,
không phụ thuộc driver/protocol/renderMode/font. Đổi driver không đổi
identity; 2 printer khác driver nhưng cùng connection là 1 printer trùng
lặp, phải bị chặn lúc lưu (`PrinterRepository`).

### 5.2 `PrinterConnection` — discriminated union, không cho phép invalid state

```ts
export interface PrinterDevice {
  deviceId: string;
  displayName: string;
  rawDevice: Record<string, unknown>;
}

export interface PrinterLanConfig {
  ip: string;
  port: number;
}

export type PrinterConnection =
  | { type: 'usb'; device: PrinterDevice }
  | { type: 'bluetooth'; device: PrinterDevice }
  | { type: 'lan'; lan: PrinterLanConfig };
```

TypeScript tự chặn state vô lý (`type: 'lan'` kèm `device`, hay `type: 'usb'`
kèm `lan`) ở compile-time. Zod schema dùng `z.discriminatedUnion('type', ...)`
tương ứng để validate dữ liệu đọc từ storage (không qua type-check).

### 5.3 `PrintMedia` — cấu hình giấy, KHÔNG phải capability

```ts
export interface PrintMedia {
  type: 'continuous' | 'die_cut';
  paperSize: 58 | 80 | 100 | 104;
  itemWidthMm?: number;   // bắt buộc khi die_cut
  itemHeightMm?: number;  // bắt buộc khi die_cut
  columns?: number;       // bắt buộc khi die_cut
  horizontalGapMm?: number;
  verticalGapMm?: number;
  cutterMode?: 'none' | 'per_job' | 'per_row';
}

export interface PrinterCapabilities {
  /** Máy in có dao cắt (phần cứng). */
  cutter: boolean;
}
```

Phân biệt bắt buộc với `PrinterCapabilities`:

```text
PrintMedia         "Job này cần in trên giấy 80mm, die-cut, 2 cột..."
                    → cấu hình, đổi được mỗi khi thay giấy vật lý

PrinterCapabilities "Máy in này có dao cắt / hỗ trợ ảnh hay không"
                    → khả năng phần cứng, cố định theo model máy
```

Ràng buộc: nếu `Printer.drivers` có driver ESC/POS, `media.type` phải là
`continuous` (ESC/POS không có khái niệm khai báo khổ giấy die-cut).

### 5.4 `PrinterDriver` — 1 protocol, 1 render mode riêng

```ts
export interface PrinterDriver {
  type: 'escpos' | 'tspl';
  source: 'auto' | 'manual';
  /** Tập con content type driver này đang phục vụ; không giao với driver kia trên cùng Printer. */
  contentTypes: ('Receipt' | 'Label')[];
  config: EscPosDriverConfig | TsplDriverConfig;
}

export interface EscPosDriverConfig {
  type: 'escpos';
  /** `undefined` ⇒ 'text'. */
  renderMode?: 'text' | 'bitmap';
}

export interface TsplFontConfig {
  name: string;         // định danh dùng chung cho DOWNLOAD lẫn TEXT
  fileName: string;     // tên file .ttf trong assets
  fontInstalled: boolean;
}

export interface TsplInternalFontConfig {
  codepage: 'UTF-8' | '1258' | '1252';
  fontName: string;     // font resident của firmware, vd '3', 'TSS24.BF2'
}

export interface TsplDriverConfig {
  type: 'tspl';
  renderMode: 'bitmap' | 'truetype' | 'internalfont';
  font?: TsplFontConfig;               // chỉ có ý nghĩa khi renderMode từng là 'truetype'
  internalFont?: TsplInternalFontConfig; // chỉ có ý nghĩa khi renderMode từng là 'internalfont'
}
```

`renderMode` **thuộc driver**, không thuộc `Printer` — 2 driver trên cùng
máy in hoàn toàn có thể chọn cách encode khác nhau (vd ESC/POS dùng `text`,
TSPL dùng `bitmap`), vì đây là lựa chọn *cách gửi lệnh*, không phải *giấy
nào đang nạp*.

### 5.5 Print-time model

```ts
export interface PrintDocument {
  elements: PrintElement[]; // union: text | line | table | row | barcode | qrCode
}

export interface PrintDocuments {
  /** Bắt buộc — mọi flow đều có document text. */
  text: PrintDocument;
  /** Base64 PNG (không tiền tố `data:`) — nguồn cho bitmap rendering (§9.4). */
  image?: string;
}

export interface PrintTarget {
  printer: Printer;
  driver: PrinterDriver;
}

export interface PrintJob {
  id: string;
  requestId: string;    // gộp các job multi-target sinh từ 1 lệnh PrintService.print
  printerId: string;
  printType: 'Receipt' | 'Label';
  documents: PrintDocuments;
  status: 'pending' | 'printing' | 'success' | 'failed' | 'cancelled';
  retryCount: number;
  error?: PrinterError;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface PrintResult {
  status: 'success' | 'partial-failure' | 'failed' | 'no-available-printer';
  jobs: PrintJob[];
  error?: PrinterError;
}
```

`driverType` **không** lưu trên `PrintJob` — `PrintScheduler` tự tra driver
từ `printer + printType`, thêm field là trùng nguồn sự thật.

---

## 6. Naming Conventions

| Hậu tố/vị trí | Ý nghĩa | Ví dụ |
|---|---|---|
| `*Props` | Input của 1 component | `PrinterInfoCardProps` |
| `*Input` (hook/hàm) | Tham số 1 hàm/hook | `UseConnectionSetupInput`, `DiscoverPrinterInput` |
| `*Values` | State form RHF trước khi lưu | `LanConnectionValues` |
| Không hậu tố, ở `models/` | Domain model đã lưu — vừa là input khi ghi vừa là output khi đọc | `Printer`, `PrintMedia` |
| `*WriteInput` | Input để tạo/sửa 1 model, khác model ở đúng field cần nới lỏng | `PrinterWriteInput` |
| `*Result` | Giá trị trả về thật của 1 operation | `PrintResult` |
| `*Event` | Event/callback stream | `DeviceScanEvent`, `DiscoveryEvent` |
| `I` + tên | Contract có ≥ 1 implementation thay thế được | `IPrinterDriver`, `IPrinterAdapter` |
| `create*` (factory function) | Hàm dựng service từ dependency, trả object method | `createPrinterConfigService` |

Chi tiết rule đặt tên/comment/class-design xem [`CODING_STYLE.md`](CODING_STYLE.md).

---

## 7. Nguyên tắc phân chia: Media vs Protocol vs Render Mode

Đây là ranh giới hay bị nhầm nhất, nêu tường minh:

| Khái niệm | Thuộc về | Vì sao |
|---|---|---|
| `PrintMedia` (khổ giấy, die-cut, cutter) | `Printer` | Thuộc tính giấy vật lý — tại 1 thời điểm chỉ có 1 loại giấy nạp trong máy, không phân biệt driver nào đang in |
| `PrinterCapabilities` (có dao cắt, hỗ trợ ảnh...) | `Printer` | Thuộc tính phần cứng cố định của máy in, độc lập protocol |
| `renderMode` (text/bitmap/truetype/internalfont) | `PrinterDriverConfig` | Cách 1 driver cụ thể mã hoá nội dung — 2 driver trên cùng máy chọn độc lập |
| `PrintType`/content type (Receipt/Label) | `PrinterDriver.contentTypes` | Loại nội dung 1 driver được gán xử lý — độc lập hoàn toàn với protocol (§8) |

---

## 8. PrintType độc lập với Protocol

```text
Không hard-code:  Receipt = ESC/POS, Label = TSPL

Được phép:        ESC/POS → Receipt
                   ESC/POS → Label
                   TSPL    → Receipt
                   TSPL    → Label
```

Routing (`PrintRoutingService`) chỉ dựa vào `driver.contentTypes.includes(type)`,
không có rule bảng cứng nào theo protocol.

---

## 9. Driver Layer

### 9.1 Contract

```ts
export interface IPrinterDriver {
  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe;
  connect(printer: Printer, driver: PrinterDriver): Promise<void>;
  disconnect(printerId: string): Promise<void>;
  getStatus(printerId: string): PrinterStatus;
  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe;
  identify(printerId: string): Promise<PrinterDeviceInfo | null>;
  print(printerId: string, documents: PrintDocuments, printType: PrintType): Promise<void>;
  testPrint(printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType, options?: PrintOptions): Promise<void>;
}
```

`scan` là stream (`Unsubscribe`, không phải `Promise<PrinterDevice[]>`) —
Bluetooth discovery chạy ~12s, phải huỷ được giữa chừng.

### 9.2 ESC/POS Driver — 2 render mode

```text
PrintDocuments
      │
      ├── renderMode: 'text'   → EscPosTextBuilder → EPToolkit → bytes
      └── renderMode: 'bitmap' → capture ảnh → decode/resize/threshold
                                  → EscPosBitmapEncoder (GS v 0) → bytes
      │
      ▼
adapter.write(bytes) / adapter.printText(text)
```

`text` là mặc định (nhanh, không tốn chi phí render) — dùng khi máy in hỗ
trợ đúng codepage tiếng Việt. `bitmap` là lựa chọn khi máy không hỗ trợ,
đánh đổi lấy hiển thị đúng 100% do app tự kiểm soát font.

### 9.3 TSPL Driver — Strategy Pattern, 3 render mode

```text
TsplDriver
      ↓
TsplStrategyRegistry (renderMode → strategy, KHÔNG switch trong Driver)
      │
      ├── bitmap        → TsplBitmapStrategy       → ảnh → BITMAP
      ├── truetype       → TsplTrueTypeStrategy      → text + DOWNLOAD font riêng → TEXT
      └── internalfont    → TsplInternalFontStrategy  → text + CODEPAGE máy in     → TEXT
```

```ts
export interface ITsplPrintStrategy {
  readonly mode: TsplRenderMode;
  validate(context: TsplStrategyContext): void;
  encode(context: TsplStrategyContext): Uint8Array;
}

export interface TsplStrategyContext {
  printer: Printer;
  driver: PrinterDriver;   // config.type === 'tspl' — TsplDriver narrow trước khi tạo context
  documents: PrintDocuments;
  printType: PrintType;
  media: PrintMedia;       // = mediaOf(printer) — nguồn cho SIZE/GAP/SET CUTTER/layout cột
  rows: number;            // số hàng die-cut cần in (>= 1); continuous = số bản sao
}
```

Strategy **không** connect, không đọc storage, không cài font — thuần
`document → bytes`. `TsplDriver` chỉ orchestrate: validate → resolve
strategy → encode → gửi qua adapter.

**Không fallback giữa các mode** — `bitmap` thiếu ảnh, `truetype` chưa cài
font, `internalfont` thiếu cấu hình đều là hard failure (`IMAGE_REQUIRED`,
`TSPL_FONT_NOT_INSTALLED`...), không tự chuyển sang mode khác.

### 9.4 Bitmap Rendering — dùng chung giữa 2 protocol

```text
PrintDocument (text elements)
      ↓
BillImagePreview render vào 1 View ẩn (React Native)
      ↓
react-native-view-shot capture → PNG base64
      ↓
upng-js decode → RGBA → resize theo targetWidthPx (paper size)
      ↓
threshold luminance → MonochromeBitmap (1-bit, MSB-first)
      │
      ├── TsplEncoder.image()         → lệnh BITMAP
      └── EscPosBitmapEncoder         → lệnh GS v 0
```

Toàn bộ pipeline capture→decode→threshold (`useBillImageCapture`,
`pngToMonochrome`, `monochromeBitmap`) là **protocol-agnostic**, dùng chung
100% — chỉ bước cuối (đóng gói lệnh) khác nhau theo protocol.

---

## 10. Adapter & Transport Layer

```text
EscPosDriver              TsplDriver
      │                        │
      └───────────┬────────────┘
                   ▼
   resolvePrinterAdapter(driverType, connectionType)
                   │
      ┌────────────┼────────────────┐
      ▼            ▼                ▼
NativeAdapter  LibraryAdapter   VendorAdapter
      │            │             (skeleton, mọi I/O
      ▼            ▼              throw UNSUPPORTED)
PrinterNativeModule  tcp-socket / bluetooth-classic
      │              (LanTransport/BluetoothTransport)
      ▼
   Native (Android)
```

Quy tắc resolve: ESC/POS → luôn `NativeAdapter`; TSPL/USB → `NativeAdapter`;
TSPL/Bluetooth-LAN → `LibraryAdapter`.

```ts
export interface IPrinterAdapter {
  readonly source: 'native' | 'library' | 'vendor';
  readonly canRead: boolean;   // false = không được ghi lệnh dò rồi chờ đọc
  listDevices(connectionType: ConnectionType): Promise<PrinterDevice[]>;
  connect(target: PrinterConnectTarget): Promise<void>;
  write(bytes: Uint8Array): Promise<void>;
  printText(text: string, options: PrinterPrintTextOptions): Promise<void>;
  read(timeoutMs: number): Promise<Uint8Array | null>;
  disconnect(): Promise<void>;
}
```

Chỉ `NativeAdapter`/`PrinterNativeModule`/`transports/*Transport` được phép
biết native. Tầng trên (driver, service, UI) không import native module.

---

## 11. Discovery & Protocol Detection

```text
User chọn connection + thiết bị → connect
      ↓
Thử TSPL trước: connect() + identify() thật (gửi `~!T`, đọc phản hồi)
      ↓ (fail hoặc không xác nhận được)
Thử ESC/POS: connect() (không có discriminator thật — "weak confirm")
      ↓ (fail)
unknown_protocol → user chọn thủ công "Printer Language"
```

**Không có bảng vendor/model → protocol.** Từng có, đã bị gỡ vì không đáng
tin — vendor/model chỉ là metadata hiển thị. USB không đọc được phản hồi
(`identify()` luôn `null`) nên **luôn** cần chọn thủ công qua USB.

---

## 12. Print Pipeline (production)

```text
Cart/Order
      ↓
PrintService.print(printType, documents)
      ↓
PrintRoutingService.resolveTargets(printType) → { printer, driver }[]
      ↓
Với mỗi target cần bitmap (usesBitmapRenderMode(driver) — kiểm tra CẢ 2
protocol, không hardcode riêng TSPL): capture ảnh 1 lần, gắn vào documents.image
      ↓
PrintScheduler.enqueue(job) — mỗi target 1 job độc lập
      ↓
lock.runExclusive(resourceKey) — serialize theo đúng ranh giới native thật
      ↓
PrinterPrintService.print(printerId, documents, printType)
      ↓
driver.print() → Strategy/Builder → Encoder → adapter.write()/printText()
      ↓
Transport → Native → Printer
```

**Failure isolation:** N target trong 1 lần in là N job độc lập
(`requestId` chung để nhóm lại) — 1 printer lỗi không huỷ kết quả của
printer khác.

---

## 13. Connection Management vs Print Dispatch

Đây là 2 trách nhiệm **cố tình tách riêng**, dễ nhầm vì cùng thao tác trên
"1 printer cụ thể":

```ts
// connection/PrinterConnectionService.ts
export interface PrinterConnectionServiceApi {
  connect(printerId: string): Promise<void>;
  disconnect(printerId: string): Promise<void>;
  reconnect(printerId: string): Promise<void>;
  reconnectAutoPrinters(): void;               // gọi 1 lần lúc app mount
  connectDraft(printer: Printer, driver: PrinterDriver): Promise<void>;
  disconnectForDriver(type: PrinterDriverType, printerId: string): Promise<void>;
  getStatus(printerId: string): PrinterStatus;
  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe;
  getStatusForDriver(type: PrinterDriverType, printerId: string): PrinterStatus;
  onStatusChangeForDriver(type: PrinterDriverType, printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe;
}

// printing/PrinterPrintService.ts
export interface PrinterPrintServiceApi {
  print(printerId: string, documents: PrintDocuments, printType: PrintType): Promise<void>;
  testPrint(printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType, options?: PrintOptions): Promise<void>;
}
```

Cả 2 dùng chung 3 primitive (`DriverRegistry`, `PrinterRepository`,
`PrinterConnectionLock`) — **không phụ thuộc lẫn nhau**, không phải quan hệ
wrap:

```text
                DriverRegistry   PrinterRepository   PrinterConnectionLock
                      │                 │                    │
        ┌─────────────┼─────────────────┤          ┌─────────┤
        ▼             ▼                 ▼          ▼         ▼
   PrinterConnectionService (connection/)      PrinterPrintService (printing/)
```

`print()` gọi thẳng `driver.connect()` nếu cần (không qua
`PrinterConnectionService.connect()`, vì hàm đó connect *tất cả* driver
của printer, khác scope với "connect đúng driver cần in").

**Bất biến quan trọng:** `print()` không tự `lock.runExclusive` — nó luôn
chạy bên trong lock mà `PrintScheduler` đã acquire sẵn cùng `resourceKey`.
`PrinterConnectionLock` không reentrant; tự thêm lock trong `print()` sẽ
deadlock ngay. Chỉ `testPrint()` (gọi thẳng từ UI, không qua scheduler) mới
tự lock.

---

## 14. Concurrency — `PrinterConnectionLock`

Lock bảo vệ **ranh giới tài nguyên native**, không phải "1 printer = 1 khoá":

```ts
export interface PrinterConnectionLockApi {
  runExclusive<T>(resourceKey: string, task: () => Promise<T>): Promise<T>;
}
```

```text
USB                        → "usb"                          (global singleton — mọi USB printer serialize chung)
ESC/POS bất kỳ connection   → "escpos:<connectionType>"       (native module singleton theo namespace)
TSPL Bluetooth device A     → "tspl:bluetooth:<deviceId>"     (độc lập theo device → in song song được)
TSPL LAN ip:port            → "tspl:lan:<ip>:<port>"          (độc lập theo endpoint → in song song được)
```

Dùng chung bởi `PrinterConnectionService`, `PrinterPrintService`,
`PrinterConfigService` (font install), `PrintScheduler` — 1 singleton duy
nhất trong toàn feature. `resourceKey` **không log** (chứa IP với TSPL LAN
— vi phạm rule không lộ IP). `connectionType` + `protocol` đã đủ để debug
concurrency.

---

## 15. Font Lifecycle (TSPL TrueType) — tách biệt hoàn toàn khỏi print

```ts
// management/PrinterConfigService.ts
export interface PrinterConfigServiceApi {
  installTsplFont(printerId: string, font: TsplFontConfig): Promise<void>;
  setTsplRenderMode(printerId: string, renderMode: TsplRenderMode): void;
  setTsplInternalFont(printerId: string, internalFont: TsplInternalFontConfig): void;
  setEscPosRenderMode(printerId: string, renderMode: EscPosRenderMode): void;
  setPrinterMedia(printerId: string, patch: Partial<PrintMedia>): void;
}
```

```text
Install (thao tác tường minh, riêng biệt):
  lock → connect → đọc TTF bundled → build DOWNLOAD → write → disconnect → fontInstalled = true

Print (không bao giờ chạm DOWNLOAD):
  connect (nếu chưa) → TEXT → PRINT
```

`fontInstalled` chỉ nghĩa "lệnh DOWNLOAD đã gửi thành công ở tầng
transport" — **không** đảm bảo máy in còn giữ font (mất điện/factory
reset có thể xoá). Không có cách nào app tự phát hiện — user phải cài lại
thủ công nếu nghi ngờ.

**Không bao giờ DOWNLOAD trong:** `print()`, `testPrint()`, `reconnect()`.
Đổi `renderMode` không tự kích hoạt install; lưu printer không tự
DOWNLOAD.

---

## 16. Error Handling

```ts
export interface PrinterError {
  code: PrinterErrorCode;
  message: string;
  cause?: unknown;
}

export class PrinterErrorException extends Error {
  code: PrinterErrorCode;
  cause?: unknown;
}
```

```text
Native/SDK error
      ↓
Adapter/Transport (bắt, không để leak nguyên văn)
      ↓
Driver (normalize thành PrinterErrorException)
      ↓
promise.reject(code, message) xuống JS caller
```

Nhóm code liên quan tới ảnh (`IMAGE_REQUIRED`/`IMAGE_INVALID`/
`IMAGE_TOO_LARGE`) dùng chung cho **cả 2 protocol** — không mang tiền tố
riêng của protocol nào, vì bản chất là trạng thái của `documents.image`,
không phải lỗi riêng TSPL hay ESC/POS.

**Print failure không rollback payment.** `OrderPrintTrigger` log warning
và trả kết quả, không throw ngược lên luồng thanh toán.

---

## 17. Persistence

```ts
// storage/PrinterRepository.ts
export interface PrinterRepositoryApi {
  getPrinters(): Printer[];
  savePrinters(printers: Printer[]): void;
  findOrThrow(printerId: string): Printer;
  addPrinter(printer: PrinterWriteInput): void;
  updatePrinter(printer: PrinterWriteInput): void;
  removePrinter(printerId: string): void;
  setEnabled(printerId: string, enabled: boolean): void;
}
```

`PrinterStorage` (MMKV) là tầng đọc/ghi thô bên dưới `PrinterRepository`
(CRUD + identity dedup + `printerSchema.parse()`). Đổi shape `Printer`
không tương thích ngược → bump `CURRENT_STORAGE_VERSION`, **destructive
reset** (không viết code migrate field-by-field) — printer cũ mất, user
cấu hình lại.

Không persist runtime state (`connected`/`connecting`/`lastError`) — chỉ
persist configuration (driver, renderMode, media, font state).

---

## 18. Logging

```ts
export interface PrinterLoggerApi {
  scanCompleted(params: { connectionType: ConnectionType; deviceCount: number; durationMs: number }): void;
  scanFailed(params: { connectionType: ConnectionType; errorCode: PrinterErrorCode; durationMs: number }): void;
  connectSucceeded(params: { printerId: string; protocol: PrinterDriverType; connectionType: ConnectionType; durationMs: number }): void;
  connectFailed(params: { printerId: string; protocol: PrinterDriverType; connectionType: ConnectionType; errorCode: PrinterErrorCode; durationMs: number }): void;
  printSucceeded(params: { printerId: string; protocol: PrinterDriverType; durationMs: number }): void;
  printFailed(params: { printerId: string; protocol: PrinterDriverType; errorCode: PrinterErrorCode; durationMs: number }): void;
  // ... disconnect*/testPrint*/discovery*/fontInstall* theo cùng pattern
}
```

Field chuẩn: `printerId`, `operation` (`'scan'|'connect'|'disconnect'|'discovery'|'test-print'|'print'|'font-install'`),
`protocol`, `connectionType`, `durationMs`, `result?` (`'success'|'failure'`,
optional — event mốc-bắt-đầu như `discovery.started` không phát), `errorCode?`.

**Không log:** nội dung hoá đơn, MAC address, IP, `resourceKey`, byte font.

---

## 19. Testing Strategy

```text
Unit (không cần hardware):
  schema, resolver, routing, lock, scheduler, encoder, strategy,
  font manager, bitmap conversion, driver (mock adapter)

Integration:
  driver + adapter (mock transport)

Hardware (bắt buộc trước khi khuyến nghị dùng production):
  USB / Bluetooth / LAN × ESC/POS / TSPL × mỗi renderMode
```

Component UI thuần trình bày không có test riêng (verify qua type-check +
lint + test tay). File logic có `__tests__/` colocate, dùng
`testing/printerFixtures.ts`/`printerServiceTestKit.ts` làm fixture chung.

---

## 20. SOLID Mapping

| Nguyên tắc | Áp dụng trong feature này |
|---|---|
| **Single Responsibility** | Mỗi file trong §3 chỉ có đúng 1 responsibility — vd `TsplEncoder` chỉ build syntax, `TsplFontManager` chỉ lo font lifecycle, không gộp thành 1 `TsplService` làm hết |
| **Open/Closed** | Thêm `renderMode` mới cho TSPL = thêm 1 strategy + đăng ký vào `TsplStrategyRegistry`, không sửa `TsplDriver`. Thêm protocol mới = thêm 1 `IPrinterDriver` impl + đăng ký `DriverRegistry`, không sửa `PrintService`/`PrintScheduler` |
| **Liskov Substitution** | Mọi `IPrinterDriver` (ESC/POS, TSPL, `WebUnsupportedDriver` cho web build) phải giữ đúng contract — `scan()` luôn trả `Unsubscribe`, `print()` luôn throw `PrinterErrorException` khi lỗi, không bao giờ silent-fail khác nhau giữa impl |
| **Interface Segregation** | `IPrinterAdapter` không ép `IPrinterDriver` biết; `ITsplPrintStrategy` không ép biết `connect()`/`disconnect()`. Không tạo 1 interface khổng lồ ép mọi implementation phải có method không dùng tới |
| **Dependency Inversion** | `PrintService`/`PrinterConnectionService`/`TsplDriver` phụ thuộc `IPrinterDriver`/`IPrinterAdapter`/`PrinterRepositoryApi` (abstraction), không phụ thuộc `NativeAdapter`/MMKV/USB SDK trực tiếp — native/storage implementation luôn ở outer layer, inject qua factory-function default param |

**Không đồng nghĩa** SOLID = interface hoá mọi class hay tách factory cho
mọi object — xem [`CODING_STYLE.md`](CODING_STYLE.md) §3, §7, §12 (Interface
Rule, Constructor/Factory, Abstraction Rules).

---

## 21. Core Invariants

Rút gọn từ nguyên tắc §1, áp dụng khi review code mới:

1. UI/business feature không import `drivers/`/`adapters/`/`transports/` trực tiếp.
2. Production print luôn qua `printing/PrintService`; management luôn qua các service ở `connection/`/`management/`/`discovery/`.
3. `renderMode` là hợp đồng cứng — thất bại thì lỗi, không đổi mode.
4. `DOWNLOAD` chỉ xuất hiện trong flow cài font tường minh, không bao giờ trong `print()`/`testPrint()`/`reconnect()`.
5. Protocol xác nhận qua `identify()` thật hoặc chọn thủ công — không đoán theo vendor/model.
6. Mọi job print phải qua `PrinterConnectionLock`; `resourceKey` phản ánh đúng ranh giới native, không phải "1 printer = 1 khoá".
7. `identityKey` (physical printer) và `resourceKey` (concurrency boundary) là 2 khái niệm khác nhau, không dùng lẫn.
8. `PrintMedia` thuộc `Printer`; `renderMode` thuộc từng `PrinterDriverConfig` — không đảo ngược.
9. Transport/Adapter chỉ chuyển byte — không hiểu document/font/renderMode/strategy.
10. Breaking storage shape → bump version, reset (không migrate field-by-field).
11. Native chỉ được biết bởi `NativeAdapter`/`PrinterNativeModule`/`transports/*Transport`.
12. Không log dữ liệu nhạy cảm (nội dung hoá đơn, MAC, IP, resourceKey).

---

## 22. Tài liệu tham khảo

- [`CODING_STYLE.md`](CODING_STYLE.md) — rule đặt tên/comment/class-design riêng cho feature này.
- [`docs/CODING_STANDARDS_TS.md`](../../../docs/CODING_STANDARDS_TS.md) — coding style TypeScript chung toàn app.
- [`docs/CODING_STANDARDS.md`](../../../docs/CODING_STANDARDS.md) — coding style Java (native Android layer).
- `docs/superpowers/specs/` (tìm theo ngày, chủ đề "printer") — quyết định
  chi tiết + lý do lịch sử. Tài liệu này không phụ thuộc vào chúng để tự
  đầy đủ, nhưng khi cần hiểu *vì sao* 1 quyết định được chọn (vd vì sao
  `PrintMedia` thuộc `Printer` chứ không thuộc driver), spec tương ứng có
  đầy đủ phân tích trade-off.
