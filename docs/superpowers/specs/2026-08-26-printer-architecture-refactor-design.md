# Printer Feature — Architecture Refactor Design

Nguồn gốc: dựa trên `docs/superpowers/specs/2026-08-26-refactor.md` (bản phác thảo ban đầu), đã qua nhiều vòng review/điều chỉnh với domain owner. Tài liệu này là **bản chốt** — thay thế bản phác thảo gốc làm nguồn tham chiếu để lập implementation plan.

## 1. Phạm vi & mục tiêu

Refactor kiến trúc feature `printer` (`NDTCore.App/src/features/printer/`) theo hướng:

1. Tách rõ layer: Driver / Transport / Adapter / Discovery / Storage / Routing.
2. Đổi data model: `Printer` có `drivers: PrinterDriver[]` (nhiều driver/printer) thay vì 1 `protocol` field đơn.
3. Bỏ `isDefault` — routing dựa hoàn toàn vào content type → driver.
4. Thêm printer identity & chống trùng lặp (không dùng tên hiển thị làm identity).
5. Sửa 1 bug tài nguyên khoá (USB) mà thiết kế multi-driver làm lộ rõ.

**Ngoài phạm vi (explicitly out of scope):** TrueType font cho TSPL (`TsplFontManager`, lệnh `DOWNLOAD`, capability detection). Đây là tính năng **chưa được verify khả thi trên phần cứng thật** — cần một spike riêng trước khi thiết kế chi tiết. Lần refactor này chỉ giữ chỗ tối thiểu trong model (xem §4.3) để không khoá kiến trúc, không xây bất kỳ phần implementation nào của nó. Khi triển khai thật, nguồn font sẽ là asset được thêm thủ công vào app (không tải qua mạng lúc runtime).

Đây là refactor kiến trúc + đổi data model — **không migrate dữ liệu cũ** (xem §10), người dùng thêm lại máy in sau khi cập nhật.

---

## 2. Design Principles

### 2.1 Content Type / Driver / Transport độc lập

```text
Content Type          Driver               Transport
├── Receipt           ├── ESC/POS          ├── USB
└── Label             └── TSPL             ├── Bluetooth
                                            └── LAN
```

Không mặc định `Receipt = ESC/POS`, `Label = TSPL`. Một printer có thể có tối đa 2 driver (ESC/POS + TSPL), mỗi driver được gán 1 tập content type — **nhưng một content type chỉ thuộc về đúng 1 driver trong cùng 1 printer** (xem §4.2 — invariant #3).

### 2.2 Disable, không Hide

Giữ nguyên convention hiện tại của module: control/section phụ thuộc state phải `disabled`, không unmount/hide. Áp dụng cho cả các driver card mới trong `AddPrinterModal` (§5).

### 2.3 Layering & trách nhiệm

`Transport` là abstraction kết nối chuẩn cho các connectionType do chính feature tự viết/kiểm soát (TSPL). ESC/POS là **ngoại lệ có chủ đích** vì thư viện vendor sở hữu toàn bộ vòng đời kết nối và gộp connect+encode+write làm 1 — 2 nhánh layering khác nhau từ `PrinterDriver` trở xuống:

```text
PrintRoutingService
        ↓ (chọn printer + driver cho 1 content type)
PrinterService
        ↓ (facade, lifecycle, storage-backed operations)
PrinterDriver
        │
        ├── Generic path (TSPL)
        │       ↓ encode(document) → raw bytes
        │   Transport
        │       ↓ (connection/state/reconnect theo connectionType)
        │   Adapter
        │       ↓ (wrapper cho native module, vd RNUSBPrinter.printRawData)
        │   Native module / Printer
        │
        └── ESC/POS pragmatic path (ngoại lệ, xem bên dưới)
                ↓
            Adapter (ThermalPrinterLibraryAdapter)
                ↓ (connect+encode+write gộp — API của thư viện, theo namespace USB/BLE/Net)
            @poriyaalar/react-native-thermal-receipt-printer
```

Nguyên tắc:
- **Routing** chỉ biết "content type nào → printer nào / driver nào" — không biết cách driver mã hoá dữ liệu.
- **Driver** biết cách mã hoá `PrintDocument` thành raw bytes cho đúng protocol của nó, và tự quyết định dùng document variant nào (text/image) dựa trên capability/config của chính nó — không phải Routing/PrintService quyết định thay.
- **Transport** (nhánh generic/TSPL) chỉ biết kết nối/ghi/đọc byte theo connectionType, không biết Receipt/Label là gì.
- **Adapter** wrap native module/vendor SDK — có thể chứa integration/mapping logic (convert API, chuẩn hoá lỗi, callback→Promise, bridge vòng đời kết nối), nhưng **không chứa business logic về máy in** (content type, routing, printer state).

**Ngoại lệ đã biết (documented pragmatic exception):** `EscPosDriver` (ESC/POS) dùng thư viện `@poriyaalar/react-native-thermal-receipt-printer`, thư viện này gộp connect+encode+write làm 1 lệnh theo từng connectionType (3 namespace độc lập `USBPrinter`/`BLEPrinter`/`NetPrinter`, không phải 1 Transport chung). Viết lại toàn bộ ESC/POS thành raw-byte-tự-encode + dùng chung Transport với TSPL sẽ phải tái hiện lại các workaround đã verify trên phần cứng thật (UTF-8 mode-switch, `keepConnection` NPE tránh treo Promise...) — rủi ro regression cao, không đáng đánh đổi ở lần refactor này. Quyết định: **giữ nguyên EscPosDriver tự chọn namespace theo connectionType nội bộ**, bọc trong `adapters/ThermalPrinterLibraryAdapter.ts` để phần code bên ngoài driver (PrinterService, PrintRoutingService...) không thấy chi tiết thư viện. Đây là compromise có chủ đích, không phải thiếu sót — ESC/POS **không đi qua `Transport`**, và `encode()` của nó chỉ phục vụ unit test/snapshot (xem §7), không phải production write path.

---

## 3. Cấu trúc thư mục

```text
src/features/printer/
├── components/              # giữ nguyên vị trí — AddPrinterModal, ConnectionSection, StatusPanel,
│                             # PrinterInfoCard (đổi nội dung, xem §5), PrinterList*, ...
├── hooks/                   # giữ nguyên — usePrinterConnection, useBillImageCapture
├── printing/
│   ├── PrinterService.ts          # facade — API tương tự hiện tại, đọc drivers[] thay vì protocol
│   ├── PrintRoutingService.ts     # MỚI — resolveTargets(printType) → [{printer, driver}]
│   ├── PrintService.ts            # giữ nguyên vai trò, chuyển từ services/
│   ├── PrintScheduler.ts          # giữ nguyên vai trò, chuyển từ services/
│   └── PrinterConnectionLock.ts   # giữ nguyên vai trò, đổi resource key formula (§9)
├── services/                 # tiện ích cross-cutting, không thuộc layer cụ thể nào
│   ├── PrinterLogger.ts
│   ├── PrinterPermissionService.ts
│   └── NetworkInfoService.ts
├── drivers/
│   ├── escpos/
│   │   └── EscPosDriver.ts         # đổi tên từ ThermalReceiptDriver.ts, thêm encode() public pure
│   └── tspl/
│       ├── TsplDriver.ts
│       └── TsplEncoder.ts          # từ protocols/TsplEncoder.ts
├── transports/               # giữ nguyên vai trò (state/reconnect), gọi qua adapters/ thay vì SDK trực tiếp
│   ├── LanTransport.ts
│   ├── BluetoothTransport.ts
│   └── UsbTransport.ts
├── adapters/                  # MỚI — external implementation boundary: wrap native SDK/vendor library.
│   │                          # Được phép chứa integration/mapping logic (convert API, chuẩn hoá lỗi,
│   │                          # callback→Promise, bridge vòng đời kết nối) — KHÔNG chứa business logic
│   │                          # về máy in (content type, routing, printer state).
│   ├── ThermalPrinterLibraryAdapter.ts  # bọc @poriyaalar/... (USBPrinter/BLEPrinter/NetPrinter)
│   ├── UsbPrinterNativeAdapter.ts       # từ services/UsbPrinterNative.ts (RNUSBPrinter.printRawData)
│   └── MockPrinterAdapter.ts            # cho unit test — thay native thật
├── discovery/
│   ├── PrinterDiscoveryService.ts  # đổi tên từ discoverProtocol.ts, nhận `excludedDrivers` (xem §5.1)
│   └── PrinterResolver.ts          # MỚI — tính identityKey (xem §6), KHÔNG tự quyết định duplicate
├── definitions/
│   └── PrinterDriverDefinitions.ts  # MỚI — capability TĨNH theo driver TYPE (không phải vendor/model)
├── storage/
│   └── PrinterStorage.ts     # tách đọc/ghi MMKV ra khỏi PrinterService, có version + migration (§10)
├── store/                    # giữ nguyên — Redux slice
├── schemas/                  # giữ nguyên vị trí — Zod, cập nhật shape + enforce invariant (§4.2, §8)
├── types/                    # cập nhật shape (§4)
└── utils/                    # giữ nguyên — paperWidth, monochromeBitmap, pngToMonochrome
```

Không tạo `management/` — đây là feature sở hữu data theo convention của app, `components/` phẳng phù hợp quy mô hiện tại. Không tạo `definitions/PrinterDefinitions.ts` kiểu rule-table vendor/model — cơ chế đó đã bị bỏ trước đây vì không đáng tin (xem CLAUDE.md); `definitions/` ở đây chỉ chứa capability tĩnh theo driver type.

---

## 4. Data Model

### 4.1 Types cơ bản

```ts
type PaperSize = 58 | 80;                      // đổi từ '58mm' | '80mm'
type PrinterDriverType = 'escpos' | 'tspl';
type PrintContentType = 'Receipt' | 'Label';
type ConnectionType = 'usb' | 'bluetooth' | 'lan'; // giữ nguyên
type DriverSource = 'auto' | 'manual';             // đổi tên từ ProtocolSource
type TsplRenderMode = 'bitmap';                    // literal đơn — chỉ 1 giá trị khả dụng hiện tại,
                                                    // KHÔNG viết union chứa nhánh chưa dùng được
                                                    // ('truetype' chỉ thêm vào khi spike TrueType xong)
```

### 4.2 `PrinterDriver` & `Printer`

```ts
interface TsplDriverConfig {
  type: 'tspl';
  renderMode: TsplRenderMode;   // luôn 'bitmap' — không có UI chọn ở phase này
  labelHeightMm?: number;
}

interface EscPosDriverConfig {
  type: 'escpos';
  // không có config riêng hiện tại
}

type PrinterDriverConfig = TsplDriverConfig | EscPosDriverConfig;

interface PrinterDriver {
  type: PrinterDriverType;
  source: DriverSource;
  contentTypes: PrintContentType[];  // phải là tập con của PrinterDriverDefinitions[type].contentTypes
  config: PrinterDriverConfig;
}

interface Printer {
  id: string;
  name: string;                     // đổi từ printerName
  vendor?: string;
  model?: string;
  drivers: PrinterDriver[];         // >= 1, <= 2 (escpos + tspl)
  connectionType: ConnectionType;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
  identityKey: string;              // xem §6
  paperSize: PaperSize;
  autoReconnect: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  // KHÔNG có isDefault
  // KHÔNG có bất kỳ field trạng thái kết nối runtime nào — invariant #11
}
```

**Ràng buộc `connectionType` ↔ `device`/`lan`:** shape TypeScript ở trên để `device`/`lan` optional (không đổi thành discriminated union để giảm phạm vi refactor), nhưng **Zod schema phải enforce** để không lọt state vô nghĩa (vd `connectionType: 'lan'` kèm `device` của USB):

```text
connectionType === 'usb'        → device required, lan forbidden
connectionType === 'bluetooth'  → device required, lan forbidden
connectionType === 'lan'        → lan required, device forbidden
```

Dùng Zod `superRefine` trên `Printer` schema (cùng chỗ enforce invariant #3, #10 — xem §8).

### 4.3 `definitions/PrinterDriverDefinitions.ts`

Capability tĩnh theo driver type — dùng để validate `contentTypes` và điều khiển UI (vd chỉ hiện checkbox Label cho driver hỗ trợ):

```ts
const PRINTER_DRIVER_DEFINITIONS: Record<PrinterDriverType, { contentTypes: PrintContentType[] }> = {
  escpos: { contentTypes: ['Receipt'] },
  tspl: { contentTypes: ['Receipt', 'Label'] },
};
```

`DriverDefinition` (capability driver CÓ THỂ làm gì) tách biệt hoàn toàn khỏi `PrinterDriver.contentTypes` (config THỰC TẾ đang được gán) — không nhầm 2 khái niệm này.

### 4.4 Đổi tên field so với hiện tại

| Hiện tại | Mới | Ghi chú |
|---|---|---|
| `PrinterConfig` | `Printer` | |
| `printerName` | `name` | |
| `protocol` (1 field) | `drivers[].type` | |
| `protocolSource` | `drivers[].source` | |
| `printsReceipt`/`printsLabel` | `drivers[].contentTypes` | disjoint theo driver, xem invariant #3 |
| `tsplRenderAsImage?: boolean` | `drivers[].config.renderMode: 'bitmap'` | luôn bitmap, không optional |
| `labelHeightMm` | `drivers[].config.labelHeightMm` (chỉ tspl) | |
| `paperSize: '58mm'\|'80mm'` | `paperSize: 58\|80` | |
| `isDefault` | *(xoá)* | không dùng cho routing thực tế (đã verify — chỉ dùng trong menu "Đặt mặc định", không ai đọc để routing) |

---

## 5. AddPrinterModal — Multi-driver flow

Vẫn là **single-screen scrollable modal**, dùng chung Add/Edit qua `initialValues` — không đổi nguyên tắc UX gốc.

### 5.1 Flow

1. Chọn `connectionType` (USB/Bluetooth/LAN) — field chung cho cả printer.
2. Chọn thiết bị (USB/BT) hoặc nhập IP+Port (LAN).
3. **Identity check ngay khi có đủ thông tin thiết bị/IP, trước khi bấm "Kết nối"** (xem §6.3) — nếu trùng, báo lỗi ngay tại `StatusPanel`, không tốn 1 lượt connect thật.
4. Bấm "Kết nối" → gọi `PrinterDiscoveryService.discover({ connection, excludedDrivers })`.
   - `excludedDrivers` = danh sách `type` của driver **đã có** trong printer đang thêm/sửa — **`AddPrinterModal` tự tính và truyền vào**, `PrinterDiscoveryService` chỉ nhận constraint, không tự biết business rule "driver này đã được add" (tách trách nhiệm rõ).
   - Thuật toán connect+identify từng candidate giữ nguyên như `discoverProtocol.ts` hiện tại.
5. Kết quả:
   - **Identified** → hiện 1 "driver card": badge protocol + badge nguồn (auto/manual) + checkbox content type. Checkbox chỉ hiện type nằm trong `PrinterDriverDefinitions[type].contentTypes`, và **disable nếu type đó đã được driver khác của cùng printer nhận** (UI reflect invariant #3 — nhưng bất biến thật được enforce ở service/schema layer, không chỉ UI, xem §8).
   - **Unknown** → chọn thủ công, chỉ hiện các protocol **chưa có** trong `drivers[]` hiện tại của printer này.
6. Nút **"+ Thêm driver khác"** — hiện khi `drivers.length < 2`, chạy lại bước 4 với `excludedDrivers` cập nhật. Ẩn khi đã đủ 2/2.
7. TSPL driver card: không có switch "In bằng ảnh" — hiển thị tĩnh "Chế độ render: Bitmap", không cho chọn (renderMode luôn `'bitmap'`).
8. Field cấp printer (Tên hiển thị, Khổ giấy, Tự động kết nối lại) unlock khi `drivers.length > 0` và không `connectionDirty` — giữ nguyên nguyên tắc `locked` hiện tại.
9. Test print theo content type: tra driver có `contentTypes` chứa content type đó trong `drivers[]` (luôn ≤ 1 do invariant #3), gọi đúng driver đó.
10. Save: enabled khi `drivers.length > 0` và không `connectionDirty`. Trước khi ghi storage, `PrinterService.addPrinter`/`updatePrinter` chạy lại duplicate check theo `identityKey` (trừ chính printer đang edit) — chặn ở service layer, không chỉ tin vào check lúc bước 3 (tránh race nếu có đường gọi khác).

---

## 6. Printer Identity & Uniqueness

### 6.1 Nguyên tắc

- Một physical printer chỉ được có **1 `Printer` record**.
- **Tên hiển thị không phải identity.**
- **Protocol/driver không phải identity** — identity chỉ phụ thuộc `connectionType` + `device`/`lan`, hoàn toàn độc lập với driver nào được gán sau đó. Đây là điều kiện tiên quyết để multi-driver hoạt động đúng: add ESC/POS cho 1 máy, sau đó add TSPL cho **cùng máy đó**, phải đi vào flow "+ Thêm driver" của printer đã có, không tạo printer mới.

### 6.2 Format `identityKey`

```text
usb:serial:<serial>                              (ưu tiên nếu đọc được serial)
usb:device:<vendorId>:<productId>:<deviceId>     (fallback)
bluetooth:mac:<macAddress>
lan:<host>:<port>
```

**Giới hạn đã biết, ghi rõ trong code:** USB fallback (`vendorId:productId:deviceId`) là best-effort, **không đảm bảo phân biệt được 2 printer cùng model cùng lúc cắm** — thư viện hiện tại không expose serial number qua USB descriptor một cách đáng tin. Không cố tạo giải pháp giả cho việc này ở lần refactor này.

`PrinterResolver` (`discovery/`) **chỉ chịu trách nhiệm tính `identityKey`** từ input (device/lan/connectionType) — **không** tự quyết định "có phải trùng lặp không". Duplicate check (tra `identityKey` trong danh sách printer đã lưu) nằm ở `PrinterService`/`PrinterStorage`.

### 6.3 Thời điểm check

Tính `identityKey` ngay khi đủ thông tin thiết bị/IP (trước khi bấm "Kết nối" — không cần biết protocol). Khi Edit, loại trừ chính printer đang sửa khỏi việc so khớp.

---

## 7. PrintRoutingService & Print Pipeline

### 7.1 Trách nhiệm từng service (tránh vòng lặp trách nhiệm)

```text
Business layer (OrderPrintTrigger...)
   ↓
PrintService            — orchestrate 1 print request từ business layer:
   ↓                      print(printType, documentVariants) → hỏi Routing → đẩy Scheduler
PrintRoutingService      — CHỈ: contentType → enabled printers → driver → PrintTarget[]
   ↓                      (routing concern thuần, không biết cách encode)
PrintScheduler           — CHỈ: resourceKey → serialize job → execute
   ↓
PrinterService           — quản lý 1 printer cụ thể / lifecycle: add/update/remove/get/
                           connect/disconnect/testPrint/print(printerId, ...)
   ↓
Driver runtime           — encode + gửi đi (xem §7.2, khác nhau theo driver — không đồng nhất)
```

`PrinterService.print(printerId, ...)` cũng là 1 API gọi trực tiếp được (vd từ `testPrint`), **không bắt buộc phải đi qua** `PrintRoutingService` — routing chỉ là đường vào từ content-type-level request (`PrintService`).

Type dùng chung giữa các service này:

```ts
interface PrintRequest {
  printType: PrintContentType;
  documentVariants: PrintDocumentVariants;
}

interface PrintTarget {
  printer: Printer;
  driver: PrinterDriver;
}
```

### 7.2 Production write path — KHÔNG đồng nhất giữa các driver

`PrinterService.print(printerId, documentVariants, printType)` tra `driver = printer.drivers.find(d => d.contentTypes.includes(printType))` rồi gọi `driver.print(...)` — **không giả định mọi driver đều đi qua `transport.write(bytes)`**, vì ESC/POS là ngoại lệ đã ghi ở §2.3 (thư viện vendor gộp connect+encode+write, không có `Transport` độc lập để gọi `write()` từ bên ngoài):

- **TSPL** (generic path): `PrinterService` gọi `driver.print(...)` → nội bộ gọi `encode(documentVariants, config, printType)` → `transport.write(bytes)`.
- **ESC/POS** (pragmatic path): `PrinterService` gọi `driver.print(...)` → nội bộ đi thẳng qua `ThermalPrinterLibraryAdapter` (API `printText`/`connectPrinter` gộp sẵn) — không có bước `transport.write(bytes)` tách rời.

Việc chọn document representation (text vs image) là **driver capability concern**, nằm trong logic nội bộ của từng driver khi build nội dung để gửi — `TsplDriver` luôn ưu tiên `documentVariants.image` (vì `renderMode` luôn `'bitmap'`); `EscPosDriver` luôn dùng `documentVariants.text`. `PrintRoutingService`/`PrintService` không biết chi tiết này.

`IPrinterDriver` thêm method public pure **`encode(documents, config, printType?): Uint8Array`** cho driver nào hỗ trợ raw-byte generation (bắt buộc với TSPL, dùng cho unit test/snapshot raw output không cần transport/printer thật). Với ESC/POS, `encode()` (đổi tên từ `encodeDocument` hiện đang private) cũng được public hoá cho mục đích test tương tự, **nhưng đây không phải lý do để viết lại production print path của ESC/POS** — `encode()` ở đây chỉ phục vụ test, production vẫn đi qua `ThermalPrinterLibraryAdapter` như hiện tại.

---

## 8. Invariants (đưa thẳng vào validation, không chỉ document)

1. Một physical printer chỉ có một `Printer` record.
2. Một `Printer` có tối đa 2 driver: ESC/POS + TSPL (`drivers.length` trong khoảng `[1, 2]`).
3. **Một `PrintContentType` chỉ thuộc về tối đa một driver trong cùng 1 Printer** — enforce bằng Zod `superRefine` trên `Printer` schema (không chỉ disable checkbox ở UI) — reject nếu 2 driver cùng printer có `contentTypes` giao nhau.
4. Protocol/driver không phải identity.
5. Identity được resolve trước khi connect (không phụ thuộc protocol).
6. Duplicate check không phụ thuộc protocol — dựa hoàn toàn vào `identityKey`.
7. Driver tạo/chuẩn bị dữ liệu in; Routing chỉ chọn target (`{printer, driver}`), không biết cách driver gửi dữ liệu đi (encode→transport, hay đi thẳng qua thư viện gộp sẵn như ESC/POS — xem §7.2).
8. Adapter/Transport được phép chứa integration/mapping logic (convert API, chuẩn hoá lỗi, callback→Promise), nhưng không chứa business logic về content type hay routing.
9. TSPL hiện tại luôn `renderMode = 'bitmap'` — không có lựa chọn khác ở phase này.
10. `drivers` không rỗng — Zod `z.array(printerDriverSchema).min(1).max(2)`.
11. Runtime connection state (`PrinterStatus`) **không** persist vào `Printer` model — thuộc runtime connection layer, hiện tại implementation là 1 status map trong bộ nhớ theo `printerId` (không khoá cứng khái niệm này vào riêng "driver" — chỉ là chi tiết implementation hiện có).
12. Migration sang model mới là **destructive reset** nếu không migrate an toàn được (xem §10).
13. `connectionType` ràng buộc `device`/`lan` — Zod enforce: `usb`/`bluetooth` → `device` bắt buộc, `lan` cấm; `lan` → `lan` bắt buộc, `device` cấm (xem §4.2).
14. Resource key của `PrinterConnectionLock` phải phản ánh đúng ranh giới concurrency thật của implementation bên dưới (thư viện singleton theo connectionType cho ESC/POS, transport riêng theo connection cho TSPL) — **không phải** định danh vật lý của printer. Không tự ý đổi thành `bluetooth:<deviceId>`/`lan:<host>:<port>` đồng loạt cho mọi driver (xem §9).

---

## 9. Resource Locking

Khoá tài nguyên kết nối native (`PrinterConnectionLock`) phải phản ánh đúng **tài nguyên native thật sự bị chia sẻ**, không phải áp 1 công thức chung cho mọi driver:

| Driver | ConnectionType | Resource key | Lý do |
|---|---|---|---|
| ESC/POS hoặc TSPL | `usb` | `"usb"` | `RNUSBPrinter` là native module singleton **dùng chung giữa cả 2 driver** (đã ghi trong CLAUDE.md) — bất kể protocol nào. |
| ESC/POS | `bluetooth` | `"escpos:bluetooth"` | Thư viện `@poriyaalar/...` giữ **đúng 1 kết nối native / namespace `BLEPrinter`, singleton toàn cục theo connectionType, KHÔNG theo device** — 2 máy ESC/POS-BT khác nhau vẫn dùng chung 1 slot. Thu hẹp xuống `bluetooth:<deviceId>` sẽ **tái tạo lại bug multi-printer đã fix trước đây** (2 job tưởng độc lập nhưng cướp kết nối lẫn nhau). |
| ESC/POS | `lan` | `"escpos:lan"` | Tương tự — namespace `NetPrinter` cũng singleton toàn cục theo connectionType. |
| TSPL | `bluetooth` | `"tspl:bluetooth:<deviceId>"` | `TsplDriver` tự quản lý transport riêng theo `printerId` (không qua thư viện singleton) — an toàn để thu hẹp xuống per-device, cho phép 2 máy TSPL-BT khác nhau in song song thật. |
| TSPL | `lan` | `"tspl:lan:<host>:<port>"` | Tương tự — mỗi `LanTransport` là 1 socket độc lập, không có singleton native cần bảo vệ chung. |

**Không áp dụng `bluetooth:<deviceId>`/`lan:<host>:<port>` đồng loạt cho mọi driver** — chỉ an toàn cho TSPL vì đặc thù transport tự viết của nó, không đúng cho ESC/POS vì đặc thù singleton của thư viện vendor.

---

## 10. Migration

Đổi sang model mới (`protocol` đơn → `drivers[]`, `paperSize` string → number, bỏ `isDefault`) là thay đổi cấu trúc lớn, không migrate dữ liệu MMKV cũ:

```text
This migration is intentionally destructive.
Existing printer configuration is not migrated.
Users must add printers again.
```

`PrinterStorage` thêm 1 storage-schema version key. Khi version cũ hơn version hiện tại của app: xoá `printer.list` và `printer.defaultId` (đã bỏ nhưng cần dọn nếu còn sót) **atomically** (cùng 1 lần ghi/xoá, không để 1 trong 2 bị xoá còn cái kia sống sót nếu app crash giữa chừng).

---

## 11. File mapping (hiện tại → mới)

| File hiện tại | Vị trí mới |
|---|---|
| `services/PrinterService.ts` | `printing/PrinterService.ts` |
| `services/PrintService.ts` | `printing/PrintService.ts` — không đổi vai trò, chỉ đổi tên field nội bộ |
| `services/PrintScheduler.ts` | `printing/PrintScheduler.ts` — đọc `driver.type` thay vì `protocol` |
| `services/PrinterConnectionLock.ts` | `printing/PrinterConnectionLock.ts` — đổi công thức resource key (§9) |
| `services/DriverRegistry.ts` | `printing/DriverRegistry.ts` — cùng nhóm với PrinterService/PrintRoutingService |
| `services/PrinterLogger.ts`, `PrinterPermissionService.ts`, `NetworkInfoService.ts` | giữ tại `services/` — tiện ích cross-cutting, không thuộc layer cụ thể |
| `drivers/ThermalReceiptDriver.ts` | `drivers/escpos/EscPosDriver.ts` |
| `drivers/TsplDriver.ts` | `drivers/tspl/TsplDriver.ts` |
| `protocols/TsplEncoder.ts` | `drivers/tspl/TsplEncoder.ts` |
| `services/discoverProtocol.ts` | `discovery/PrinterDiscoveryService.ts` |
| *(mới)* | `discovery/PrinterResolver.ts` |
| `services/UsbPrinterNative.ts` | `adapters/UsbPrinterNativeAdapter.ts` |
| *(mới, bọc thư viện escpos)* | `adapters/ThermalPrinterLibraryAdapter.ts` |
| *(mới, cho unit test)* | `adapters/MockPrinterAdapter.ts` |
| *(inline trong PrinterService)* | `storage/PrinterStorage.ts` |
| *(mới)* | `printing/PrintRoutingService.ts` |
| *(mới)* | `definitions/PrinterDriverDefinitions.ts` |
| `transports/*.ts` | giữ nguyên vị trí, gọi qua `adapters/` thay vì SDK trực tiếp |
| `components/PrinterInfoCard.tsx` | giữ nguyên vị trí, redesign nội dung theo driver card (§5) |
| `types/printer.types.ts`, `types/driver.types.ts` | cập nhật shape theo §4, giữ nguyên vị trí |
| `schemas/printerFormSchema.ts` | cập nhật + thêm validation invariant #3, #10 |

Các file không liệt kê (`utils/`, `hooks/`, `store/`, phần lớn `components/`) giữ nguyên vị trí và vai trò.
