# Printer Architecture Conformance Checklist

Bảng đối chiếu cuối (Task 12 / P9) của kế hoạch
`docs/superpowers/plans/2026-08-28-printer-architecture-conformance.md`.

Đối chiếu code thực tế trong `src/features/printer/` với:
- `src/features/printer/ARCHITECTURE.md` §142 — 45 Production Invariants
- `src/features/printer/ARCHITECTURE.md` §145 — 50 Absolute Production Rules
- `src/features/printer/ARCHITECTURE.md` §145b — 8 TSPL Named Rules

Verdict mỗi dòng là đúng một trong:
- `✅ conform` + trích dẫn `file:line` hoặc tên test
- `⚠️ deviation` + mục Documented Deviations (`ARCHITECTURE.md` §"Documented Deviations" / spec §12) bao phủ
- `N/A (hardware)` cho phần chỉ kiểm được trên máy in thật

Đường dẫn trích dẫn tương đối tính từ `src/features/printer/` trừ khi ghi rõ khác.

---

## §142 — 45 Production Invariants

### Architecture

| # | Tóm tắt | Verdict |
|---|---|---|
| 1 | UI không gọi native printer | ✅ conform — UI chỉ gọi facade: `components/AddPrinterModal.tsx:324` (`PrinterService.installTsplFont`), toàn bộ `components/*` import `printing/PrinterService`; không `components/*` nào import `transports/`/`adapters/`. |
| 2 | Business feature không gọi native printer | ✅ conform — `../cart/services/OrderPrintTrigger.ts:1` chỉ dùng `printing/PrintService`; không import driver/transport/adapter. |
| 3 | Production printing đi qua `PrintService` | ✅ conform — `printing/PrintService.ts:66`; `../cart/hooks/useCheckout.ts:47` + `../cart/hooks/useOrderHistory.ts:76` gọi `printReceipt` → `PrintService.print`. |
| 4 | Printer management đi qua `PrinterService` | ✅ conform — `printing/PrinterService.ts:278` (singleton facade); test `printing/__tests__/PrinterService.test.ts`. |
| 5 | Native access chỉ ở adapter/transport boundary | ⚠️ deviation (D2) — TSPL đúng (`transports/{Lan,Bluetooth,Usb}Transport.ts` + `adapters/UsbPrinterNativeAdapter.ts`); ESC/POS dùng thẳng thư viện vendor gộp connect+encode+write trong `drivers/escpos/EscPosDriver.ts` — D2 chấp nhận ngoại lệ pragmatic. |

### Driver

| # | Tóm tắt | Verdict |
|---|---|---|
| 6 | Driver implement `IPrinterDriver` | ✅ conform — `drivers/tspl/TsplDriver.ts:*` `implements IPrinterDriver`, `drivers/escpos/EscPosDriver.ts` idem; interface `types/driver.types.ts` (signature thật, xem D1). |
| 7 | Protocol và PrintType độc lập | ✅ conform — routing theo `driver.contentTypes` chứ không theo protocol: `printing/PrintRoutingService.ts:24`; test `types/__tests__/printConfiguration.types.test.ts`, `definitions/__tests__/PrinterDriverDefinitions.test.ts`. |
| 8 | Driver resolve qua `DriverRegistry` | ✅ conform — `printing/DriverRegistry.ts`; `printing/PrinterService.ts:21` `getDriver = (type) => registry[type]`. |
| 9 | TSPL dùng Strategy | ✅ conform — `drivers/tspl/TsplDriver.ts:165` `resolveTsplStrategy(driver.config.renderMode)`; `drivers/tspl/TsplStrategyRegistry.ts:8`. |

### Strategy

| # | Tóm tắt | Verdict |
|---|---|---|
| 10 | Bitmap dùng `TsplBitmapStrategy` | ✅ conform — `drivers/tspl/TsplStrategyRegistry.ts:9`; `strategies/TsplBitmapStrategy.ts:13` `readonly mode = TsplRenderMode.bitmap`. |
| 11 | TrueType dùng `TsplTrueTypeStrategy` | ✅ conform — `drivers/tspl/TsplStrategyRegistry.ts:10`; `strategies/TsplTrueTypeStrategy.ts:16`. |
| 12 | Strategy không connect printer | ✅ conform — Part B guard "Strategy Purity" rỗng; `strategies/*.ts` không import `transports/`/`adapters/`; test `strategies/__tests__/TsplBitmapStrategy.test.ts`, `TsplTrueTypeStrategy.test.ts`. |
| 13 | Strategy không access native | ✅ conform — cùng guard §145b "Strategy Purity" (Part B, empty). |
| 14 | Strategy không install font | ✅ conform — `strategies/*.ts` không import `TsplFontManager`; `grep "downloadFont" strategies/` rỗng (Part B B2). |

### Bitmap

| # | Tóm tắt | Verdict |
|---|---|---|
| 15 | Bitmap mode yêu cầu image | ✅ conform — `strategies/TsplBitmapStrategy.ts:15-21` ném `TSPL_IMAGE_REQUIRED`; test `strategies/__tests__/TsplBitmapStrategy.test.ts`. |
| 16 | PNG phải convert thành 1-bit bitmap | ✅ conform — `utils/pngToMonochrome.ts:50` `decodePngBase64ToMonochrome` → `utils/monochromeBitmap.ts` `rgbaToMonochromeBitmap`; test `utils/__tests__/pngToMonochrome.test.ts`, `monochromeBitmap.test.ts`. |
| 17 | Image width phải normalize | ✅ conform — `strategies/TsplBitmapStrategy.ts:29` resize về `PAPER_IMAGE_WIDTH_PX[printer.paperSize]`; `utils/pngToMonochrome.ts:47-61`. |
| 18 | Image height phải validate | ✅ conform — `strategies/TsplBitmapStrategy.ts:36-42` ném `TSPL_IMAGE_TOO_LARGE` khi `bitmap.heightPx > heightMm * DOTS_PER_MM`. |
| 19 | Bitmap failure không fallback | ✅ conform — `strategies/TsplBitmapStrategy.ts` chỉ `throw`, không nhánh TEXT; `drivers/tspl/TsplDriver.ts:173-174` không catch quanh `strategy.validate/encode`; test `drivers/tspl/__tests__/TsplDriver.test.ts` ("không fallback"). |

### TrueType

| # | Tóm tắt | Verdict |
|---|---|---|
| 20 | TrueType yêu cầu installed font | ✅ conform — `strategies/TsplTrueTypeStrategy.ts:20-21` ném `TSPL_FONT_NOT_INSTALLED` khi `!config.font?.fontInstalled`; test `strategies/__tests__/TsplTrueTypeStrategy.test.ts`. |
| 21 | TrueType chỉ gửi `TEXT` | ✅ conform — `strategies/TsplTrueTypeStrategy.ts` encode qua `TsplEncoder` text path, không gửi font binary (comment :10); test `strategies/__tests__/TsplTrueTypeStrategy.test.ts`. |
| 22 | TrueType failure không fallback | ✅ conform — strategy chỉ `throw`; `drivers/tspl/TsplDriver.ts:161-174` không catch; test `drivers/tspl/__tests__/TsplDriver.test.ts`. ⚠️ chưa xác nhận firmware (D7). |
| 23 | Không dùng built-in font làm fallback | ✅ conform — không có nhánh chọn built-in font ở `strategies/TsplTrueTypeStrategy.ts` / `TsplDriver.ts`; `grep isTsplTrueTypeActive src/` rỗng (Part B B6). |

### Font

| # | Tóm tắt | Verdict |
|---|---|---|
| 24 | `DOWNLOAD` chỉ dùng để install font | ✅ conform — lệnh DOWNLOAD chỉ ở `drivers/tspl/TsplFontManager.ts:27` `downloadFont`; Part B B2 xác nhận caller-set. |
| 25 | Print không được `DOWNLOAD` | ✅ conform — `drivers/tspl/TsplDriver.ts:203-211` `print()` không gọi `fontManager`; test `drivers/tspl/__tests__/TsplDriver.test.ts:403` ("print()/testPrint()/connect() KHÔNG gọi TsplFontManager.downloadFont"). |
| 26 | Test print không được `DOWNLOAD` | ✅ conform — `drivers/tspl/TsplDriver.ts:187-201`; cùng test `TsplDriver.test.ts:403`; `printing/__tests__/PrinterService.test.ts:473` (RULE 15-17). |
| 27 | Reconnect không được `DOWNLOAD` | ✅ conform — `printing/PrinterService.ts:104-107` `reconnect` = disconnect+connect; test `printing/__tests__/PrinterService.test.ts:473-484`. |
| 28 | `TsplDriver.print()` không gọi `TsplFontManager.install()` | ✅ conform — `drivers/tspl/TsplDriver.ts:203-211`; test `drivers/tspl/__tests__/TsplDriver.test.ts:403`. |
| 29 | Font installation là explicit operation | ✅ conform — chỉ `PrinterService.installTsplFont` (`printing/PrinterService.ts:199`) và `AddPrinterModal.onToggleTsplFont` (`components/AddPrinterModal.tsx:324`) khởi động; test `printing/__tests__/PrinterService.test.ts:487+` (A4). |

### Discovery

| # | Tóm tắt | Verdict |
|---|---|---|
| 30 | Protocol discovery ưu tiên real `identify()` | ✅ conform — `discovery/PrinterDiscoveryService.ts:83-84` gọi `driver.identify(printerId)` thật; test `discovery/__tests__/PrinterDiscoveryService.test.ts`. |
| 31 | Vendor/model không phải protocol truth | ✅ conform — không còn rule table; `discovery/PrinterDiscoveryService.ts:8-14` comment + `CANDIDATE_ORDER` cố định; test `discovery/__tests__/PrinterDiscoveryService.test.ts`. |
| 32 | USB identify không thành công → manual selection | ✅ conform — `discovery/PrinterDiscoveryService.ts:104` emit `unknown_protocol`; `components/AddPrinterModal.tsx` `onToggleTsplFont`/manual "Printer Language" (CLAUDE.md §Printer Module). |

### Storage

| # | Tóm tắt | Verdict |
|---|---|---|
| 33 | `identityKey` định danh physical printer | ✅ conform — `discovery/PrinterResolver.ts:21` `resolveIdentityKey` chỉ từ connectionType+device/lan; `printing/PrinterService.ts:49-52` recompute; test `discovery/__tests__/PrinterResolver.test.ts`. |
| 34 | Không duplicate physical printer | ✅ conform — `printing/PrinterService.ts:33-41` `assertNoDuplicateIdentity` ném `PRINTER_ALREADY_EXISTS`; test `printing/__tests__/PrinterService.test.ts:50`. |
| 35 | Runtime status không persist | ✅ conform — `storage/PrinterStorage.ts` chỉ lưu `Printer` entity; status sống ở Redux `store/printerSlice.ts` (in-memory); `schemas/printerFormSchema.ts` không có field status; test `storage/__tests__/PrinterStorage.test.ts`, `store/__tests__/printerSlice.test.ts`. |
| 36 | Breaking storage change phải bump version | ✅ conform — `storage/PrinterStorage.ts:6,14,23-27` `CURRENT_STORAGE_VERSION` + destructive reset; test `storage/__tests__/PrinterStorage.test.ts`. |

### Concurrency

| # | Tóm tắt | Verdict |
|---|---|---|
| 37 | Mọi print job phải dùng `PrinterConnectionLock` | ✅ conform — `printing/PrintScheduler.ts:31-32` `lock.runExclusive(resourceKeyFor(job), …)`; test `printing/__tests__/PrintScheduler.test.ts`, `PrinterConnectionLock.test.ts`. |
| 38 | Resource key phản ánh native concurrency boundary | ✅ conform — `printing/PrinterConnectionLock.ts:28-35` (`usb` global / `escpos:<conn>` / `tspl:bluetooth:<deviceId>` / `tspl:lan:<ip>:<port>`); test `printing/__tests__/PrinterConnectionLock.test.ts`. |
| 39 | USB singleton dùng global lock | ✅ conform — `printing/PrinterConnectionLock.ts:28` `if (connectionType === usb) return 'usb'`; test `printing/__tests__/PrinterConnectionLock.test.ts`. |
| 40 | TSPL LAN/Bluetooth độc lập có thể parallel | ✅ conform — key riêng theo ip:port / deviceId (`PrinterConnectionLock.ts:30-35`); test `printing/__tests__/PrintScheduler.test.ts` (parallel khác resource). |

### Error

| # | Tóm tắt | Verdict |
|---|---|---|
| 41 | Native errors normalize thành `AppError` | ✅ conform — `transports/*.ts` + `drivers/*.ts` bọc bằng `AppErrorException` / `errorCodeOf`; `types/AppError.ts`; test `types/__tests__/AppError.test.ts`, `transports/__tests__/*`. |
| 42 | Rendering error là hard failure | ✅ conform — `strategies/*` ném `TSPL_*` không catch; `drivers/tspl/TsplStrategyRegistry.ts:16` `TSPL_RENDER_MODE_UNSUPPORTED`; test strategies. |
| 43 | Không có implicit fallback | ✅ conform — `drivers/tspl/TsplDriver.ts:155-174` comment "KHÔNG fallback"; Part B B6 (`isTsplTrueTypeActive` rỗng); test `drivers/tspl/__tests__/TsplDriver.test.ts`. |
| 44 | Printing failure không làm payment fail | ✅ conform — `../cart/hooks/useCheckout.ts:44-49` không `await` printReceipt (fire-and-forget), `../cart/services/OrderPrintTrigger.ts:195-210` nuốt lỗi + `LoggerService.warning`; test `../cart/services/__tests__/OrderPrintTrigger.test.ts`. |
| 45 | Printer errors phải được log | ✅ conform — `drivers/escpos/EscPosDriver.ts:139,153,182` + `drivers/tspl/TsplDriver.ts:124,136,198` `PrinterLogger.*Failed`; production TSPL print-fail: `PrintScheduler` gán `job.error` + `OrderPrintTrigger.ts:204,209` log. Ghi chú: `TsplDriver.print()` không tự emit `PrinterLogger` (ESC/POS có) — chấp nhận vì scheduler+trigger đã log mọi print-fail. |

---

## §145 — 50 Absolute Production Rules

| RULE | Tóm tắt | Verdict |
|---|---|---|
| 01 | UI không access native printer module | ✅ conform — xem Invariant 1; `components/*` chỉ import `printing/PrinterService`. |
| 02 | Production printing qua `PrintService` | ✅ conform — `printing/PrintService.ts:66`; xem Invariant 3. |
| 03 | Printer management qua `PrinterService` | ✅ conform — `printing/PrinterService.ts:278`; xem Invariant 4. |
| 04 | `PrintType` và `PrinterDriverType` độc lập | ✅ conform — `types/printConfiguration.types.ts` + `types/printer.types.ts` tách rời; test `types/__tests__/printConfiguration.types.test.ts`. |
| 05 | `TsplDriver` dùng Strategy Pattern | ✅ conform — `drivers/tspl/TsplDriver.ts:165`; Part B B3 (`TsplDriver.ts` không `new TsplEncoder`/PNG decode). |
| 06 | Bitmap dùng `TsplBitmapStrategy` | ✅ conform — `drivers/tspl/TsplStrategyRegistry.ts:9`. |
| 07 | TrueType dùng `TsplTrueTypeStrategy` | ✅ conform — `drivers/tspl/TsplStrategyRegistry.ts:10`. |
| 08 | Bitmap failure không fallback TEXT | ✅ conform — `strategies/TsplBitmapStrategy.ts` chỉ throw; test `strategies/__tests__/TsplBitmapStrategy.test.ts`. |
| 09 | TrueType failure không fallback BITMAP | ✅ conform — `strategies/TsplTrueTypeStrategy.ts` chỉ throw; test `strategies/__tests__/TsplTrueTypeStrategy.test.ts`. ⚠️ hardware chưa xác nhận (D7). |
| 10 | TrueType thiếu font → FAIL | ✅ conform — `strategies/TsplTrueTypeStrategy.ts:20-21` `TSPL_FONT_NOT_INSTALLED`; test `strategies/__tests__/TsplTrueTypeStrategy.test.ts`. |
| 11 | Bitmap thiếu image → FAIL | ✅ conform — `strategies/TsplBitmapStrategy.ts:15-21` `TSPL_IMAGE_REQUIRED`; test `strategies/__tests__/TsplBitmapStrategy.test.ts`. |
| 12 | Unsupported rendering → FAIL | ✅ conform — `drivers/tspl/TsplStrategyRegistry.ts:16` `TSPL_RENDER_MODE_UNSUPPORTED`; `drivers/tspl/TsplEncoder.ts` ném `TSPL_ELEMENT_UNSUPPORTED`; test `drivers/tspl/__tests__/TsplEncoder.test.ts`. |
| 13 | DOWNLOAD chỉ thuộc font installation | ✅ conform — `drivers/tspl/TsplFontManager.ts:27`; Part B B2. |
| 14 | PRINT không bao giờ chạy DOWNLOAD | ✅ conform — `drivers/tspl/TsplDriver.ts:203-211`; test `drivers/tspl/__tests__/TsplDriver.test.ts:403`. |
| 15 | TEST PRINT không bao giờ chạy DOWNLOAD | ✅ conform — `drivers/tspl/TsplDriver.ts:187-201`; test `printing/__tests__/PrinterService.test.ts:473`. |
| 16 | RECONNECT không bao giờ chạy DOWNLOAD | ✅ conform — `printing/PrinterService.ts:104-107`; test `printing/__tests__/PrinterService.test.ts:473`. |
| 17 | `TsplDriver.print()` không install font | ✅ conform — `drivers/tspl/TsplDriver.ts:203-211`; test `drivers/tspl/__tests__/TsplDriver.test.ts:403`. |
| 18 | Font installation gọi explicit | ✅ conform — `printing/PrinterService.ts:199` + `components/AddPrinterModal.tsx:324`; test `printing/__tests__/PrinterService.test.ts` (A4, :487+). |
| 19 | `fontInstalled` không phải hardware verification | ✅ conform — chỉ là config flag ở `types/printer.types.ts` `TsplFontConfig`; strategy chỉ đọc nó để quyết định fail sớm (`strategies/TsplTrueTypeStrategy.ts:20`); ARCHITECTURE.md §51 + D7. |
| 20 | Discovery dùng real `identify()` khi hỗ trợ | ✅ conform — `discovery/PrinterDiscoveryService.ts:83-84`; test `discovery/__tests__/PrinterDiscoveryService.test.ts`. |
| 21 | Vendor/model không phải protocol truth | ✅ conform — `discovery/PrinterDiscoveryService.ts:8-14` (no rule table). |
| 22 | USB discovery CÓ THỂ ra `unknown_protocol` | ✅ conform — `discovery/PrinterDiscoveryService.ts:104`; test `discovery/__tests__/PrinterDiscoveryService.test.ts`. |
| 23 | USB unknown → yêu cầu manual selection | ✅ conform — `components/AddPrinterModal.tsx` state machine "Printer Language" thủ công (spec `2026-08-01-printer-modal-single-screen-design.md`). |
| 24 | Mọi print job tôn trọng `PrinterConnectionLock` | ✅ conform — `printing/PrintScheduler.ts:31`; test `printing/__tests__/PrintScheduler.test.ts`. |
| 25 | Lock key = native resource boundary | ✅ conform — `printing/PrinterConnectionLock.ts:28-35`; test `printing/__tests__/PrinterConnectionLock.test.ts`. |
| 26 | USB singleton dùng global resource lock | ✅ conform — `printing/PrinterConnectionLock.ts:28`. |
| 27 | TSPL LAN/Bluetooth độc lập CÓ THỂ in song song | ✅ conform — `printing/PrinterConnectionLock.ts:30-35`; test `printing/__tests__/PrintScheduler.test.ts`. |
| 28 | Runtime connection state không persist | ✅ conform — xem Invariant 35; `storage/PrinterStorage.ts` + `schemas/printerFormSchema.ts`. |
| 29 | `identityKey` = physical printer identity | ✅ conform — `discovery/PrinterResolver.ts:21`; test `discovery/__tests__/PrinterResolver.test.ts`. |
| 30 | Duplicate physical printer bị từ chối | ✅ conform — `printing/PrinterService.ts:33-41`; test `printing/__tests__/PrinterService.test.ts:50`. |
| 31 | Native errors normalize thành `AppError` | ✅ conform — `types/AppError.ts` + wrap ở transport/driver; test `types/__tests__/AppError.test.ts`. |
| 32 | Print failure không chặn payment thành công | ✅ conform — `../cart/hooks/useCheckout.ts:44-49`; test `../cart/services/__tests__/OrderPrintTrigger.test.ts`. |
| 33 | Mọi printer failure phải được log | ✅ conform — `PrinterLogger.*Failed` ở `drivers/escpos/EscPosDriver.ts:139,153,182` + `drivers/tspl/TsplDriver.ts:124,136,198`; production print-fail: `PrintScheduler` `job.error` + `../cart/services/OrderPrintTrigger.ts:204,209`. |
| 34 | Sensitive print/customer data không log | ✅ conform — `services/PrinterLogger.ts:5-19` (không nhận field nhạy cảm), bỏ `resourceKey` (D6); test `services/__tests__/PrinterLogger.test.ts:49-51,253-254` (assert không có `ip`/`mac`/`resourceKey`). |
| 35 | Transport chỉ truyền bytes | ⚠️ deviation (D2) — TSPL transport (`transports/{Lan,Bluetooth,Usb}Transport.ts`) chỉ nhận `Uint8Array` (Part B B4 rỗng); ESC/POS không có tầng transport riêng (D2). |
| 36 | Encoder chỉ sinh protocol command | ✅ conform — `drivers/tspl/TsplEncoder.ts:1-3` chỉ import type + `MonochromeBitmap`; không connect/transport (`grep "connect\|transport" TsplEncoder.ts` rỗng); test `drivers/tspl/__tests__/TsplEncoder.test.ts`. |
| 37 | Strategy chỉ xử lý rendering/encoding decision | ✅ conform — `strategies/*.ts`; Part B "Strategy Purity" rỗng. |
| 38 | FontManager chỉ xử lý font installation | ✅ conform — `drivers/tspl/TsplFontManager.ts` chỉ có `downloadFont`; test `drivers/tspl/__tests__/TsplFontManager.test.ts`. |
| 39 | Storage chỉ xử lý persistence | ✅ conform — `storage/PrinterStorage.ts` chỉ get/save + version; test `storage/__tests__/PrinterStorage.test.ts`. |
| 40 | Routing chỉ resolve target | ✅ conform — `printing/PrintRoutingService.ts:13-31` (comment "CHỈ biết content type → printer/driver"); test `printing/__tests__/PrintRoutingService.test.ts`. |
| 41 | Scheduler chỉ orchestrate print job | ✅ conform — `printing/PrintScheduler.ts:30-51` (enqueue/retry qua lock); `PrintJob` shape thật xem D4; test `printing/__tests__/PrintScheduler.test.ts`. |
| 42 | ConnectionLock chỉ control concurrency | ✅ conform — `printing/PrinterConnectionLock.ts` (`createResourceLock` + `runExclusive`); test `printing/__tests__/PrinterConnectionLock.test.ts`. |
| 43 | Không layer nào bypass abstraction boundary | ✅ conform — Part B B1/B3/B4 rỗng; `drivers/tspl/TsplDriver.ts:7` chỉ import hằng số từ `TsplEncoder`. |
| 44 | Driver mới phải implement `IPrinterDriver` | ✅ conform — `types/driver.types.ts` là contract; `drivers/tspl/TsplDriver.ts` + `drivers/escpos/EscPosDriver.ts` `implements`. Signature thật khác pseudocode §23 (D1). |
| 45 | TSPL render mode mới phải implement `ITsplPrintStrategy` | ✅ conform — `strategies/tsplStrategy.types.ts` `ITsplPrintStrategy`; registry `drivers/tspl/TsplStrategyRegistry.ts:8` typed `Record<TsplRenderMode, ITsplPrintStrategy>`. |
| 46 | Transport mới phải implement transport abstraction | ✅ conform — `types/driver.types.ts` / `drivers/tspl/tsplTransport` shape; 3 transport hiện có cùng `write()`/`connect()`/`disconnect()`. ⚠️ ESC/POS ngoại lệ (D2). |
| 47 | Đổi printer config KHÔNG âm thầm install font | ✅ conform — `components/AddPrinterModal.tsx:309-320` tắt switch chỉ đổi `renderMode`, không gọi installTsplFont; install chỉ khi `enabled === true` (:321-324). |
| 48 | Đổi render mode KHÔNG âm thầm print | ✅ conform — `components/AddPrinterModal.tsx` `onToggleTsplFont` không gọi print/testPrint; `printing/PrinterService.installTsplFont` chỉ DOWNLOAD + persist. |
| 49 | Save printer KHÔNG âm thầm DOWNLOAD font | ✅ conform — `printing/PrinterService.ts:54-59` `addPrinter` chỉ `savePrinters`; DOWNLOAD tách riêng ở `installTsplFont`. Persist-in-add-flow xem D3. |
| 50 | Print pipeline deterministic từ driver + render mode | ✅ conform — `drivers/tspl/TsplDriver.ts:161-174` `buildBytes` chỉ đọc `driver.config.renderMode` (không đọc runtime state); §145b "Configuration Is Source of Truth". |

---

## §145b — 8 TSPL Named Rules

| Named rule | Verdict |
|---|---|
| TSPL Strategy Ownership | ✅ conform — `drivers/tspl/TsplDriver.ts:7` chỉ import `DEFAULT_LABEL_HEIGHT_MM`/`CONTINUOUS_HEIGHT_MM` từ `TsplEncoder` (hằng số), không `new TsplEncoder`/`pngToMonochrome`; render delegate `resolveTsplStrategy` (:165). Part B B3 rỗng. |
| No Fallback | ✅ conform — `strategies/TsplBitmapStrategy.ts` (`TSPL_IMAGE_REQUIRED`, không "TEXT") + `strategies/TsplTrueTypeStrategy.ts` (`TSPL_FONT_NOT_INSTALLED`, không "BITMAP"); test `strategies/__tests__/TsplBitmapStrategy.test.ts`, `TsplTrueTypeStrategy.test.ts`. ⚠️ firmware chưa xác nhận (D7). |
| No Download During Print | ✅ conform — Part B B2: `downloadFont`/`installTsplFont` callers chỉ gồm `TsplFontManager`/`TsplDriver.installTsplFont`/`PrinterService.installTsplFont`/`AddPrinterModal.onToggleTsplFont`; test `drivers/tspl/__tests__/TsplDriver.test.ts:403`. |
| Strategy Purity | ✅ conform — Part B B1: `grep "transports/\|adapters/\|storage/\|StorageService" strategies/` rỗng. |
| Driver Responsibility | ✅ conform — `drivers/tspl/TsplDriver.ts` sở hữu connect/disconnect/`writeBytes` (:177-185), render đẩy sang strategy (:165-174). |
| Transport Responsibility | ✅ conform — Part B B4: `grep "printDocument\|Strategy\|TsplEncoder" transports/` rỗng; transport chỉ nhận `Uint8Array`. ⚠️ ESC/POS không qua transport (D2). |
| Configuration Is Source of Truth | ✅ conform — `drivers/tspl/TsplDriver.ts:165` `resolveTsplStrategy(driver.config.renderMode)`; không code path nào đọc runtime font availability để chọn strategy (Part B B6 `isTsplTrueTypeActive` rỗng). |
| Explicit Failure | ✅ conform — mọi nhánh invalid ném `TSPL_*` cụ thể: `TSPL_IMAGE_REQUIRED/INVALID/TOO_LARGE` (`strategies/TsplBitmapStrategy.ts:18,31,38`), `TSPL_FONT_NOT_INSTALLED` (`strategies/TsplTrueTypeStrategy.ts:21,28`), `TSPL_RENDER_MODE_UNSUPPORTED` (`TsplStrategyRegistry.ts:16`), `TSPL_ELEMENT_UNSUPPORTED` (`TsplEncoder.ts`, dùng chung ESC/POS — D5); test `drivers/tspl/__tests__/TsplEncoder.test.ts`, strategies. |

---

## Tổng kết

| Verdict | Số dòng |
|---|---|
| ✅ conform | 100 |
| ⚠️ deviation (D2 / D7) | 3 (Invariant 5, RULE 35, Named "Transport Responsibility"; RULE 09/22 + Named "No Fallback" mang thêm chú thích D7 nhưng verdict chính vẫn ✅) |
| N/A (hardware) | 0 |
| **Tổng** | **103** (45 + 50 + 8) |

Ghi chú: 3 dòng `⚠️` đều là **D2** (`EscPosDriver` không đi qua `Transport` — thư viện vendor gộp connect+encode+write, ngoại lệ pragmatic đã ghi ở ARCHITECTURE.md "Documented Deviations" + spec §12.2). **D7** (TrueType chưa test firmware) không đổi verdict conform của code path nhưng là điều kiện tiên quyết cho hardware checklist bên dưới.

Không phát hiện lệch nào NGOÀI danh sách Documented Deviations trong lần sweep này. Part B (6 grep guard của spec §10 mục 4) toàn bộ PASS, không cần sửa code.

---

## Hardware test checklist (cho user — không tự động hoá)

Các kiểm tra dưới đây cần máy in thật, không nằm trong `npm run verify`. Bắt buộc
chạy trước khi bật TrueType ở production (D7).

### Ma trận connection × render mode

- [ ] **USB × bitmap** — in bill 58mm và 80mm, kiểm tra canh lề + không cắt nội dung.
- [ ] **USB × truetype** — cài font (DOWNLOAD) → in bill → kiểm tra dấu tiếng Việt hiển thị đúng.
- [ ] **Bluetooth × bitmap** — in bill, kiểm tra tốc độ + toàn vẹn ảnh.
- [ ] **Bluetooth × truetype** — cài font → in bill → kiểm tra dấu tiếng Việt.
- [ ] **LAN × bitmap** — in bill, kiểm tra reconnect sau khi mất mạng.
- [ ] **LAN × truetype** — cài font → in bill → kiểm tra dấu tiếng Việt.

### Failure modes

- [ ] **TrueType chưa cài font → in phải BÁO LỖI rõ** (`TSPL_FONT_NOT_INSTALLED`) — KHÔNG ra giấy trắng, KHÔNG âm thầm rơi về bitmap.
- [ ] **Mất điện máy in giữa chừng job** → job fail rõ ràng (`job.status = failed`, warning log), **payment vẫn OK** (đơn hàng đã tạo, không rollback).
