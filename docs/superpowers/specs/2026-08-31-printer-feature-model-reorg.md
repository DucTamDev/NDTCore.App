# Printer Feature — Model/Forms/Services Reorg (bỏ `types/`)

> **Trạng thái:** spec để review. Bám sát đề xuất của user (tin nhắn 2026-08-31),
> có bổ sung ruling cho các chỗ mockup còn mơ hồ/mâu thuẫn — đánh dấu rõ **[RULING]**.
> Sau khi user duyệt → viết plan → thực thi qua `subagent-driven-development`.

## 0. Mục tiêu

- Xoá `types/` catch-all. Không thay bằng `interfaces/`/`contracts/`/`definitions/` khác.
- Tổ chức lại theo **trách nhiệm dữ liệu**: `models/` (domain đã lưu), `forms/` (UI form input), `errors/`, đổi tên `definitions/` → khái niệm capability, chuẩn hoá hậu tố (`Props`/`Input`/`Values`/`Result`/không hậu tố=domain model).
- Đổi `Printer.connectionType`/`device`/`lan` (phẳng) → `Printer.connection: PrinterConnection` (lồng).
- Thêm tầng `AddPrinterInput` cho luồng lưu printer (form → mapper → input → service → model).

## 1. Non-goals (chốt để tránh phình phạm vi)

- **Không** đổi cơ chế lỗi từ throw sang Result-object ở các service hiện đang throw (`PrinterErrorException`). Giữ nguyên throw. Chỉ những chỗ **đã** trả Result thật (`PrintService.print(): Promise<PrintResult>`) mới có `*Result` type — đó là rename/relocate, không phải đổi hành vi.
- **Không** thêm field `resourceKey` lưu trên `Printer`. Xác nhận trong code: `resourceKeyFor(printer, driverType)` tính động **theo từng driver** (`services/PrinterConnectionLock.ts:45`), không phải 1 giá trị tĩnh/printer. Thêm field này sẽ sai lệch model — bỏ khỏi mockup.
- **Không** đổi `PrintService.print(printType, documents)` (2 tham số rời) thành nhận 1 object `PrintInput` — đây là đổi chữ ký hàm thật, không phải rename type, và không giải quyết vấn đề gì cụ thể đã nêu. `PrintInput` **không tạo mới**; `PrintResult` (đã có ở `types/printJob.types.ts`) chỉ **relocate** sang `models/printing/PrintJob.ts`.
- Tương tự, **không** bọc tham số của `DiscoverDriver`/`installTsplFont`/`setDriverMedia`... thành Input object nếu hiện đang là tham số rời — chỉ áp dụng Input/Result cho **luồng Add/Edit Printer** (chỗ user chỉ rõ có vấn đề: `buildDraftPrinter()` build thẳng ra `Printer`).

## 2. `PrinterIdentity` — bỏ khỏi danh sách model file **[RULING]**

Mockup của user liệt kê `models/printer/PrinterIdentity.ts` nhưng ví dụ `Printer` interface lại để `identityKey: string` **phẳng**, không lồng `identity: PrinterIdentity` — tự mâu thuẫn với chính nó.

`identityKey` là 1 chuỗi tính từ `connectionType`+`device`/`lan` (hàm `resolveIdentityKey`, hiện ở `services/discovery/PrinterResolver.ts`). Bọc nó thành 1 "model" `PrinterIdentity { key: string }` là suffix không mang thêm thông tin — đúng nguyên tắc chính user đề ra ("đừng dùng suffix nếu không cung cấp thông tin").

→ **Quyết định:** `Printer.identityKey: string` giữ phẳng. Không tạo `models/printer/PrinterIdentity.ts`. Hàm `resolveIdentityKey` + `ResolveIdentityKeyInput` tiếp tục sống ở `services/discovery/` (đổi tên file `PrinterResolver.ts` → giữ nguyên, đã đúng chỗ — nó là 1 service function, không phải model).

## 3. `PrinterDriver` — không trùng tên thật trong code **[RULING]**

Code hiện tại contract của driver **đã** tên `IPrinterDriver` (`types/driver.types.ts:27`), không phải `PrinterDriver` trần — mockup của user dùng `PrinterDriver` cho cả 2 chỉ là ví dụ tốc ký, không phải tên thật đang xung đột.

→ **Quyết định:** giữ tiền tố `I` cho contract — `drivers/IPrinterDriver.ts` (đây là interface **triển khai bởi** `EscPosDriver`/`TsplDriver`, tiền tố `I` ở đây mang thông tin thật: "đây là contract để implement", khác với "Interface" nhét vô nghĩa vào cuối tên data type). `models/printer/` giữ tên `PrinterDriver` cho data shape (1 driver được gán cho 1 printer) — không đổi.

## 4. Gộp file theo concern, không 1-file-1-type **[RULING]**

Tách 12 model thành 12 file riêng sẽ tạo import cycle (chúng tham chiếu chéo: `Printer.drivers: PrinterDriver[]`, `PrinterDriver.config: PrinterDriverConfig`, `PrinterDriverConfig` = `TsplDriverConfig | EscPosDriverConfig`, cả hai đều có `media: PrintMedia`...). Gộp theo **concern** (nhóm thay đổi cùng nhau), mỗi file vẫn nhỏ:

```
models/printer/
├── Printer.ts            # Printer, PrinterConnection, PrinterCapabilities
├── PrinterDriver.ts       # PrinterDriver, PrinterDriverConfig (+ Tspl/EscPos variant),
│                          #   TsplFontConfig, TsplInternalFontConfig, enum PrinterDriverType/
│                          #   DriverSource/TsplRenderMode/TsplCodepage
├── PrinterDevice.ts       # PrinterDevice, UsbRawDevice, PrinterLanConfig, PrinterDeviceInfo,
│                          #   DeviceScanEvent, DeviceScanEventType, enum ConnectionType
└── PrinterStatus.ts       # enum PrinterStatus

models/printing/
├── PrintDocument.ts        # PrintElement (union) + PrintDocument (từ printDocument.types.ts)
├── PrintJob.ts             # PrintJob, PrintJobStatus, PrintResult, PrintResultStatus (từ printJob.types.ts)
└── PrintTarget.ts          # PrintTarget (từ printing/PrintRoutingService.ts, tách interface ra)

models/media/
└── PrintMedia.ts           # PrintMedia, PrintMediaType, CutterMode (từ printer.types.ts)
```

`PaperSize` (`58|80|100|104`) đi cùng `models/media/PrintMedia.ts` (nó là thuộc tính của `PrintMedia`, dùng trong `media/paperSpec.ts` cũng được — giữ ở `PrintMedia.ts` vì là type domain, `paperSpec.ts` chỉ là bảng tra cứu).

`PrintConfiguration.types.ts` (`PrintType` — Receipt/Label) → `models/printing/PrintType.ts` (tách riêng, nó là enum độc lập không thuộc `PrintDocument`/`PrintJob`).

## 5. `errors/`

`types/PrinterError.ts` → `errors/PrinterError.ts` nguyên trạng (đã có runtime code — enum + class — đúng lý do nó lệch quy ước `.types` trước đây, giờ có nhà riêng).

## 6. `drivers/`

- `types/driver.types.ts` tách 2: `IPrinterDriver` + `Unsubscribe` + `PrintDocuments`/`PrintOptions` → `drivers/IPrinterDriver.ts` (đây là contract + shape I/O của nó — ở cạnh nhau vì luôn dùng cùng nhau).
- `definitions/` (đã gộp vào `drivers/driverDefinitions.ts` hôm nay) → đổi tên file thành `drivers/DriverCapabilities.ts`, đổi tên export `PRINTER_DRIVER_DEFINITIONS` → `DRIVER_CAPABILITIES`, `getDriverDefinition` → `getDriverCapabilities`, interface `PrinterDriverDefinition` → `DriverCapabilities`.

## 7. `forms/addPrinter/`

**[RULING]** — hiện tại **không có** `AddPrinterFormValues` riêng: `useAddPrinterFlow` dùng 2 form RHF độc lập (`lanForm` từ `lanConnectionSchema`, `displayForm` từ `printerDisplaySchema`) cộng state rời (`connectionType`, `selectedDevice`, `drivers`, `autoReconnect`...) — không phải 1 object form values gộp. Gộp thật thành 1 `AddPrinterFormValues` là đổi state shape của `useConnectionSetup`/coordinator, rủi ro cao cho lợi ích thấp (form đã hoạt động đúng, tách 2 RHF form theo lý do: LAN validate khác display name).

→ **Thu hẹp phạm vi `forms/`:** chỉ di chuyển các Zod schema đã có, đổi tên file cho nhất quán, **không gộp state**:

```
forms/addPrinter/
├── LanConnectionSchema.ts      # lanConnectionSchema + type LanConnectionValues (từ schemas/printerFormSchema.ts)
├── PrinterDisplaySchema.ts     # printerDisplaySchema + type PrinterDisplayValues
└── PrinterSchema.ts            # printerSchema + printMediaSchema + dieCutRowOverflow import + type PrinterValidated
```
`AddPrinterFormMapper` — **không tạo** (không có bước map thật sự khác `buildDraftPrinter()` đang làm; xem §8).

## 8. `AddPrinterInput` — thêm đúng 1 chỗ, đúng vấn đề đã nêu

Vấn đề thật: `PrinterRepository.addPrinter(printer: Printer)`/`updatePrinter(printer: Printer)` nhận thẳng `Printer` — bên trong tự tính lại `identityKey` (không tin giá trị caller truyền, xem `withRecomputedIdentity`) trước khi `printerSchema.parse()`. Caller (`buildDraftPrinter()`) phải tự bịa `identityKey: ''`/tạm vì biết sẽ bị ghi đè — hơi lệch semantics "đây là Printer hoàn chỉnh" khi thực ra 1 field chưa đáng tin.

→ **Thêm** `models/printer/Printer.ts` xuất thêm:
```ts
/** Input để tạo/sửa 1 printer — giống Printer nhưng identityKey là GIÁ TRỊ ĐỀ XUẤT, service tự tính lại (không tin caller). */
export type AddPrinterInput = Omit<Printer, 'identityKey'> & { identityKey?: string };
```
`PrinterRepository.addPrinter`/`updatePrinter` đổi tham số từ `Printer` → `AddPrinterInput`, trả về `Printer` đã persist (hiện đang trả `void` — **giữ nguyên `void`**, không đổi thành return-Printer, ngoài phạm vi). `buildDraftPrinter()` trong `useAddPrinterFlow` đổi kiểu trả về từ `Printer` sang `AddPrinterInput` (bỏ được identityKey giả tạm).

Không có `AddPrinterResult` — `addPrinter`/`updatePrinter` vẫn throw lỗi (không đổi sang Result-object, xem §1 Non-goals).

## 9. `services/discovery/` — đổi tên Input/Result cho khớp thực tế

- `DiscoveryInput` (`services/discovery/PrinterDiscoveryService.ts:33`) → đổi tên `DiscoverPrinterInput`, **giữ nguyên chỗ** (nó thuộc về chính service dùng nó, không tách file riêng — 1 interface 3 dòng không cần file riêng).
- **Không có `DiscoverPrinterResult`** — output của discovery là **stream sự kiện** (`DiscoveryEvent` qua callback: `connecting`/`identifying`/`identified`/`unknown_protocol`/`error`), không phải 1 giá trị trả về đơn. Giữ tên `DiscoveryEvent`/`DiscoveryStage` (đã mô tả đúng bản chất — event, không phải result).

## 10. `services/printing/` — Result đã có, chỉ relocate

`PrintResult`/`PrintResultStatus` (hiện ở `types/printJob.types.ts`) → `models/printing/PrintJob.ts` (§4). `PrintService.print()` **giữ nguyên chữ ký** `(printType, documents) => Promise<PrintResult>` — không có `PrintInput` (§1 Non-goals).

## 11. `Printer.connection: PrinterConnection` — xác nhận rủi ro dữ liệu

`PrinterStorage.ts` bump `CURRENT_STORAGE_VERSION` (hiện = 4) → **reset toàn bộ, không migrate** (xác nhận trong code, dòng 19-32). Đổi shape `Printer` bắt buộc bump version → **user đã xác nhận chấp nhận mất printer đã lưu của máy đang dev/test** (chưa có user thật). Task risk này ghi vào plan như 1 bước rõ ràng (bump `CURRENT_STORAGE_VERSION = 5`), không âm thầm.

```ts
export interface PrinterConnection {
  type: ConnectionType;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
}

export interface Printer {
  id: string;
  name: string;
  vendor?: string;
  model?: string;
  drivers: PrinterDriver[];
  connection: PrinterConnection;   // ⬅ thay connectionType + device + lan
  identityKey: string;
  capabilities: PrinterCapabilities;
  autoReconnect: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

Mọi chỗ đọc `printer.connectionType` → `printer.connection.type`, `printer.device` → `printer.connection.device`, `printer.lan` → `printer.connection.lan`. Đây là phần đụng nhiều file nhất (ước lượng ở plan).

## 12. Cây thư mục đích (đầy đủ)

```text
src/features/printer/
├── components/                         # giữ nguyên (không đổi trong spec này)
├── forms/
│   └── addPrinter/
│       ├── LanConnectionSchema.ts
│       ├── PrinterDisplaySchema.ts
│       └── PrinterSchema.ts
├── hooks/                              # giữ nguyên vị trí, sửa import + AddPrinterInput
├── models/
│   ├── printer/
│   │   ├── Printer.ts                  # Printer, PrinterConnection, PrinterCapabilities, AddPrinterInput
│   │   ├── PrinterDriver.ts
│   │   ├── PrinterDevice.ts
│   │   └── PrinterStatus.ts
│   ├── printing/
│   │   ├── PrintDocument.ts
│   │   ├── PrintJob.ts
│   │   ├── PrintTarget.ts
│   │   └── PrintType.ts
│   └── media/
│       └── PrintMedia.ts
├── services/                           # giữ cấu trúc hôm nay (printing/, discovery/, 8 service cốt lõi)
├── drivers/
│   ├── IPrinterDriver.ts               # đổi tên từ driver.types.ts
│   ├── DriverCapabilities.ts           # đổi tên từ driverDefinitions.ts
│   ├── driverConfig.ts / DriverRegistry.ts / escpos/ / tspl/   # giữ nguyên
├── transports/ · adapters/ · storage/ · media/ · testing/ · store/  # giữ nguyên
├── errors/
│   └── PrinterError.ts
├── constants.ts
└── ARCHITECTURE.md
```

`types/`, `definitions/`, `schemas/` (ở gốc `printer/`) **biến mất hoàn toàn**.

## 13. Quy tắc đặt tên (chốt, ghi vào `ARCHITECTURE.md` sau khi xong)

| Hậu tố/vị trí | Ý nghĩa | Ví dụ |
|---|---|---|
| `*Props` | Input của 1 component | `PrinterInfoCardProps` |
| `*Input` (hook/hàm) | Tham số 1 hàm/hook | `UseConnectionSetupInput`, `DiscoverPrinterInput` |
| `*Values` | State form RHF trước khi lưu | `LanConnectionValues` |
| Không hậu tố, ở `models/` | Domain model đã lưu — vừa là input khi ghi vừa là output khi đọc | `Printer`, `PrintMedia` |
| `*Input` (service, gắn với model) | Input để tạo/sửa 1 model, khác model ở đúng field cần nới lỏng | `AddPrinterInput` |
| `*Result` | Giá trị trả về **thật sự** của 1 operation (không phải mọi hàm đều cần) | `PrintResult` |
| `*Event` | Sự kiện phát ra qua callback/stream | `DeviceScanEvent`, `DiscoveryEvent` |
| `I` + tên | Contract để implement (native TS/OOP convention, không phải "Interface" nhét cuối tên) | `IPrinterDriver`, `IPrinterAdapter` (đã có) |

Không dùng: `PrinterData`, `PrinterInfo`, `PrinterType` (đã dùng cho enum, không đổi), `PrinterModel`, `PrinterConfigType`, `PrinterInterface`, `PrinterDefinition`, `PrinterResponse`.

## 14. Rà theo file — mapping đầy đủ (cho bước viết plan)

| File hiện tại | → | Ghi chú |
|---|---|---|
| `types/printer.types.ts` | `models/printer/{Printer,PrinterDriver,PrinterDevice,PrinterStatus}.ts` + `models/media/PrintMedia.ts` | tách theo §4 |
| `types/driver.types.ts` | `drivers/IPrinterDriver.ts` | |
| `types/printDocument.types.ts` | `models/printing/PrintDocument.ts` | |
| `types/printJob.types.ts` | `models/printing/PrintJob.ts` | |
| `types/printConfiguration.types.ts` | `models/printing/PrintType.ts` | |
| `types/PrinterError.ts` | `errors/PrinterError.ts` | |
| `drivers/driverDefinitions.ts` | `drivers/DriverCapabilities.ts` | rename export |
| `schemas/printerFormSchema.ts` | `forms/addPrinter/{LanConnectionSchema,PrinterDisplaySchema,PrinterSchema}.ts` | tách 3 |
| `printing/PrintRoutingService.ts` (nội bộ `PrintTarget`) | interface `PrintTarget` → `models/printing/PrintTarget.ts` | file service giữ nguyên chỗ, chỉ export type ra |
| (mới) | `models/printer/Printer.ts` thêm `AddPrinterInput` | §8 |

**Không di chuyển:** `components/`, `hooks/`, `services/` (cấu trúc `printing/`+`discovery/`+8 service), `adapters/`, `transports/`, `storage/`, `media/` (rule), `testing/`, `store/` — những folder này **giữ nguyên vị trí**, chỉ sửa import + field access (`connectionType`→`connection.type` v.v.) theo shape mới.

## 15. Ước lượng phạm vi (để chọn effort ở plan)

- File tạo mới: ~12 (models/ 8 + forms/ 3 + errors/ 1... trừ những cái relocate = rename, tính là move không phải "tạo mới thật").
- File đổi import path: mọi nơi `import ... from '../types/...'`, `'../schemas/printerFormSchema'`, `'../definitions/driverDefinitions'` — ước lượng 45-60 file (production + test) dựa trên số lần các type đó được dùng hôm nay.
- File đổi **nội dung** (không chỉ import) do đổi field `connectionType/device/lan` → `connection.type/device/lan`: mọi nơi đọc/ghi trực tiếp field đó — `PrinterRepository` (identity recompute), `PrinterConnectionLock` (resourceKeyFor), `PrinterConnectionService`, discovery, `useAddPrinterFlow`+`useConnectionSetup`+`useProtocolDiscovery`, `printerFormSchema`/`PrinterSchema` (Zod schema cho `Printer` phải đổi shape), `printerFixtures.ts`, `printerServiceTestKit.ts`, MỌI test file dựng `Printer`/`basePrinter` (rất nhiều — mỗi service test file, hook test file). Đây là phần tốn công nhất, không phải sed đơn thuần — mỗi test fixture phải sửa tay.
- `PrinterStorage.ts`: bump `CURRENT_STORAGE_VERSION` 4→5.

## 16. Câu hỏi còn mở cho user (cần trả lời trước khi viết plan)

1. §2, §3, §4, §7, §8, §9 là **ruling của tôi** trên các mockup mâu thuẫn/mơ hồ — đồng ý hay muốn sửa?
2. `components/` giữ nguyên trong spec này (không đổi tên field bên trong component, chỉ đổi nếu chúng đọc `printer.connectionType` trực tiếp) — xác nhận đúng phạm vi bạn muốn, hay muốn dọn cả `components/` (đặt tên prop...) trong đợt này luôn?
