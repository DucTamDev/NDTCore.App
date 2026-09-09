# PrintMedia thuộc về Printer, không thuộc Driver — Design Specification

> **Đảo ngược quyết định trước đó.** Spec `2026-08-30-print-media-domain-design.md` §"Quyết định đã chốt" cố tình đặt `media: PrintMedia` **theo từng driver** để hỗ trợ "1 printer vừa TSPL die-cut vừa ESC/POS continuous cùng lúc". Spec này đảo ngược quyết định đó — xem §0 vì sao.

## 0. Bối cảnh — vì sao đảo ngược

`PrintMedia` (loại giấy continuous/die-cut, khổ giấy, kích thước tem, cutter mode) mô tả **giấy vật lý đang nạp trong máy in tại 1 thời điểm** — không phải thuộc tính của protocol/driver đang dùng để nói chuyện với máy.

Quyết định gốc (2026-08-30) giả định 2 driver trên 1 printer có thể có 2 `media` khác nhau **cùng lúc, cùng hợp lệ**. Thực tế vật lý không cho phép: 1 máy in tại 1 thời điểm chỉ có **1 loại giấy** đang nạp. Kịch bản "vừa die-cut vừa continuous" chỉ có thể xảy ra ở 2 thời điểm khác nhau (user tháo giấy cũ, nạp giấy mới) — không phải song song.

Hệ quả cụ thể của model sai:
- `DriverMediaSection` render **2 lần độc lập** khi printer có 2 driver — user có thể (vô tình) để 2 giá trị mâu thuẫn nhau mà app không cảnh báo gì.
- Khi user đổi giấy thật ngoài đời, phải nhớ sửa **cả 2 nơi** cho khớp — quên 1 chỗ thì driver đó âm thầm build lệnh sai khổ giấy/layout so với giấy thật đang nạp, không có gì báo lỗi.
- Đúng thực tế vận hành: đổi giấy → sửa **đúng 1 chỗ** → mọi driver đều đọc cùng 1 nguồn sự thật.

## 1. Phạm vi

**Trong phạm vi:**
1. Dời `media: PrintMedia` từ `TsplDriverConfig`/`EscPosDriverConfig` lên `Printer` (top-level).
2. `mediaOf()` đổi input từ `PrinterDriver` sang `Printer`.
3. `DriverMediaSection` render **1 lần/printer**, ra khỏi vòng lặp `drivers.map()`.
4. `onChangeDriverMedia(driverType, patch)` → `onChangePrinterMedia(patch)` (bỏ tham số `driverType`).
5. `PrinterConfigService.setDriverMedia` → `setPrinterMedia`.
6. Schema: `media` chuyển từ 2 driver-config-schema lên `printerSchema` top-level.
7. Rule "ESC/POS chỉ in giấy cuộn liên tục" chuyển từ per-driver sang per-printer: **nếu printer có driver ESC/POS, `printer.media.type` phải là `continuous`** (áp dụng cho toàn bộ printer, không riêng driver ESC/POS — nếu printer đó có cả TSPL, TSPL cũng bị giới hạn continuous theo đúng giấy thật đang nạp).
8. Bump `PrinterStorage.CURRENT_STORAGE_VERSION` (destructive reset, đúng convention hiện có).
9. Cập nhật `testing/printerFixtures.ts`, mọi test liên quan.

**Ngoài phạm vi:**
- Không đổi hành vi render die-cut/continuous đã có ở tầng `TsplEncoder`/strategy — chỉ đổi **nơi lấy `media` từ đâu**, không đổi logic dùng nó.
- ESC/POS bitmap printing (`2026-09-09-escpos-bitmap-printing-design.md`) — spec đó **phụ thuộc** spec này, cập nhật sau khi spec này được duyệt.

---

## 2. Kiến trúc — flow

### 2.1 Flow vận hành thật (user đổi giấy)

```text
User tháo giấy cũ, nạp giấy mới vào máy in (vật lý)
        │
        ▼
Mở app → màn Sửa máy in → "Cài đặt nâng cao"
        │
        ▼
Sửa DriverMediaSection — ĐÚNG 1 LẦN cho cả Printer
(loại giấy / khổ giấy / kích thước tem nếu die-cut / cutter mode)
        │
        ▼
Lưu → Printer.media cập nhật (nguồn sự thật DUY NHẤT)
        │
        ▼
Mọi lần in tiếp theo (Hoá đơn qua ESC/POS, Tem qua TSPL, hoặc ngược lại)
đều đọc ĐÚNG giấy đang thật sự nạp — không có driver nào "quên cập nhật"
```

### 2.2 Flow tại thời điểm in (data flow qua các layer)

```text
PrintService.print(printType, documents)
        │
        ▼
PrintRoutingService.resolveTargets(printType) → { printer, driver }[]
        │
        ▼
PrintScheduler.enqueue(job) ── lock.runExclusive theo resourceKey
        │
        ▼
driver.print(printerId, documents, printType)
        │
   ┌────┴─────┐
   ▼          ▼
EscPosDriver  TsplDriver
   │          │
   └────┬─────┘
        ▼
mediaOf(printer)   ← ĐỌC TỪ Printer.media (KHÔNG còn driver.config.media)
        │
        ▼
renderMode của driver (EscPosRenderMode / TsplRenderMode) quyết định cách encode
        │
        ▼
adapter.write(bytes) / adapter.printText(text) → Transport → Printer vật lý
```

`mediaOf()` là điểm truy cập DUY NHẤT — mọi nơi cần `PrintMedia` (encoder, strategy, capture ảnh, validate schema) đều gọi qua đây, không đọc trực tiếp `driver.config.media` hay `printer.media` rải rác.

### 2.3 Flow cấu hình trong UI (setup/edit)

```text
PrinterInfoCard
   │
   ├─ DriverMediaSection        ← 1 LẦN, ngoài vòng lặp driver
   │     onChange → onChangePrinterMedia(patch)
   │
   └─ drivers.map(driver =>
         ├─ toggle contentTypes (per driver, không đổi)
         └─ DriverRenderModeSection (renderMode — VẪN per driver, đúng bản chất:
              cùng 1 giấy, ESC/POS có thể chọn text/bitmap độc lập với TSPL
              chọn bitmap/truetype/internalfont — đây là lựa chọn CÁCH GỬI LỆNH,
              không phải giấy nào, nên đúng là thuộc driver)
      )
        │
        ▼
onChangePrinterMedia(patch) → useDriverConfig → PrinterConfigService.setPrinterMedia
        │
        ▼
PrinterRepository.savePrinters() → printerSchema.parse() (validate ESC/POS-continuous ở đây)
```

**Điểm quan trọng cần phân biệt rõ:** `media` (giấy vật lý) thuộc `Printer` — dùng chung. `renderMode` (cách 1 driver cụ thể encode nội dung thành lệnh) vẫn thuộc từng `PrinterDriverConfig` — đây KHÔNG phải thứ bị đảo ngược trong spec này, vì renderMode thật sự là lựa chọn riêng của từng protocol/driver, không phải thuộc tính giấy.

---

## 3. Data Model

### 3.1 `models/printer/Printer.ts`

```ts
export interface Printer {
  id: string;
  name: string;
  vendor?: string;
  model?: string;
  drivers: PrinterDriver[];
  connection: PrinterConnection;
  identityKey: string;
  capabilities: PrinterCapabilities;
  media: PrintMedia;              // MỚI — dời từ driver config
  autoReconnect: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 3.2 `models/printer/PrinterDriver.ts`

```diff
  export interface TsplDriverConfig {
    type: 'tspl';
    renderMode: TsplRenderMode;
    font?: TsplFontConfig;
    internalFont?: TsplInternalFontConfig;
-   media: PrintMedia;
  }

  export interface EscPosDriverConfig {
    type: 'escpos';
-   media: PrintMedia;
+   renderMode?: EscPosRenderMode;   // xem spec ESC/POS bitmap — độc lập với thay đổi này
  }
```

### 3.3 `drivers/driverConfig.ts`

```diff
- export const mediaOf = (driver: PrinterDriver): PrintMedia => driver.config.media;
+ export const mediaOf = (printer: Printer): PrintMedia => printer.media;

- export const paperSizeOf = (driver: PrinterDriver): PaperSize => driver.config.media.paperSize;
+ export const paperSizeOf = (printer: Printer): PaperSize => printer.media.paperSize;
```

**Cutover — mọi chỗ gọi `mediaOf(driver)`/`paperSizeOf(driver)` phải đổi sang truyền `printer`:**

| File | Trước | Sau |
|---|---|---|
| `drivers/tspl/TsplDriver.ts` (`buildBytes`) | `mediaOf(driver)` | `mediaOf(printer)` — đã có sẵn `printer` trong scope |
| `drivers/escpos/EscPosDriver.ts` (`sendDocuments`) | `paperSizeOf(driver)` | `paperSizeOf(printer)` — cần truyền thêm `printer` vào `sendDocuments()` (hiện chỉ nhận `driver`) |
| `drivers/tspl/strategies/tsplStrategy.types.ts` (`TsplStrategyContext`) | `media: PrintMedia` build từ `mediaOf(driver)` | build từ `mediaOf(context.printer)` — context đã có sẵn `printer` |
| `components/PrinterInfoCard.tsx` | `mediaOf(driver)` trong `drivers.map()` | `mediaOf(printer)` — gọi 1 lần trước vòng lặp, không phải trong đó |
| `hooks/useBillImageCapture` caller (`useTestPrint`, `OrderPrintTrigger`) | truyền `mediaOf(driver)` | truyền `mediaOf(printer)` |

**Chú ý riêng `EscPosDriver.sendDocuments(adapter, driver, documents)`:** hiện không có `printer` trong tham số (chỉ cần `driver` để build text). Sau thay đổi này cần thêm `printer` vào chữ ký — kéo theo cập nhật 2 nơi gọi nó (`print()`, `testPrint()`) đã có sẵn `printer`/`context` trong scope, không cần truyền xuyên thêm layer nào khác.

### 3.4 Schema (`forms/addPrinter/PrinterSchema.ts`)

```diff
  const tsplDriverConfigSchema = z.object({
    type: z.literal(PrinterDriverType.tspl),
    renderMode: z.enum([...]),
    font: tsplFontConfigSchema.optional(),
    internalFont: tsplInternalFontConfigSchema.optional(),
-   media: printMediaSchema,
  });

  const escPosDriverConfigSchema = z.object({
    type: z.literal(PrinterDriverType.escpos),
-   media: printMediaSchema,
  });

  export const printerSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    ...
    capabilities: printerCapabilitiesSchema,
+   media: printMediaSchema,
    ...
  }).superRefine((printer, ctx) => {
    ...
+   const hasEscPos = printer.drivers.some((d) => d.type === PrinterDriverType.escpos);
+   if (hasEscPos && printer.media.type !== PrintMediaType.continuous) {
+     ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['media', 'type'], message: 'Printer có driver ESC/POS chỉ được dùng giấy cuộn liên tục' });
+   }
  });
```

### 3.5 `drivers/DriverCapabilities.ts`

`defaultConfig` của cả 2 driver **bỏ** `media` (không còn field đó trong config nữa). `DEFAULT_MEDIA` dời thành default cho `Printer.media` — dùng ở `useAddPrinterFlow.buildDraftPrinter()` khi dựng printer mới, không phải ở `DriverCapabilities` nữa (vì media giờ không thuộc riêng driver).

### 3.6 Storage

```ts
// v6: dời PrintMedia từ PrinterDriver.config lên Printer.media — 1 nguồn
// sự thật duy nhất cho giấy vật lý, thay vì mỗi driver 1 bản có thể mâu
// thuẫn nhau. Đảo ngược quyết định "media theo driver" đưa vào từ v4.
const CURRENT_STORAGE_VERSION = 6;
```

---

## 4. Testing

| Test | Kiểm |
|---|---|
| `PrinterSchema.test.ts` | `printerSchema` có `media` top-level bắt buộc; printer có driver ESC/POS + `media.type: 'die_cut'` → fail; printer chỉ có TSPL + die_cut → pass |
| `driverConfig.test.ts` | `mediaOf(printer)`/`paperSizeOf(printer)` nhận `Printer`, không nhận `PrinterDriver` |
| `EscPosDriver.test.ts` | `sendDocuments` nhận thêm `printer`, đọc đúng `printer.media` |
| `TsplDriver.test.ts` / `Tspl*Strategy.test.ts` | context `media` build từ `printer.media` |
| `PrinterInfoCard` UI test (nếu có) | `DriverMediaSection` chỉ render 1 lần dù có 2 driver |
| `PrinterConfigService.test.ts` | `setPrinterMedia` thay `setDriverMedia`, không cần `driverType` |
| `printerFixtures.ts` / `printerServiceTestKit.ts` | `makePrinter` nhận `media` trực tiếp; `makeTsplDriverEntry`/`makeEscPosDriverEntry` bỏ tham số `media` |
| `PrinterStorage.test.ts` | version cũ → reset đúng version 6 |

---

## 5. Rủi ro / lưu ý

- **Breaking storage change** — mọi printer đã lưu trước version 6 bị xoá theo policy reset hiện có (không viết migration). Cần thông báo trước khi merge nếu có máy in thật đang test trên thiết bị.
- Grep toàn bộ `driver.config.media`, `mediaOf(`, `paperSizeOf(` trước khi sửa để không sót call site — số lượng đã liệt ở bảng §3.3 nhưng nên grep xác nhận lại lúc viết plan.
- Sau spec này, spec `2026-09-09-escpos-bitmap-printing-design.md` cần cập nhật lại các đoạn code mẫu đang viết `mediaOf(driver)` → `mediaOf(printer)`.
