# Feature printer: model, ngôn ngữ in, tầng kết nối — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm sạch `src/features/printer`: model đúng nghĩa (union, summary), ngôn ngữ in (ESC/POS, TSPL) chỉ encode,
tìm thiết bị / kết nối / trạng thái / gửi byte gom về một tầng kết nối chung, bỏ `drivers/`, `LibraryAdapter`,
`transports/` và hai thư viện JS.

**Architecture:** `languages/` (`IPrintLanguage.encode` + `identifyProbe`) không biết kết nối; `connection/`
(`PrinterConnectionService` theo `printerId`, `IPrinterAdapter` → `NativeAdapter` cho mọi đường truyền, khoá theo
`deviceId`) không biết ngôn ngữ. `printing/` ghép hai thứ để in, `detection/` ghép để dò ngôn ngữ, `discovery/` tìm
thiết bị trả `DiscoveredDevice`. Byte encode được ghim bằng fixture chụp từ driver cũ trước khi đổi.

**Tech Stack:** React Native 0.86, TypeScript strict, zod, Jest (preset react-native), MMKV.

**Spec:** `docs/superpowers/specs/2026-10-02-printer-model-language-refactor-design.md`

## Cách plan này được viết

Toàn bộ 9 task đã được làm thử trên một bản clone của branch này (base `1ae9c2a`), mỗi task một commit, chạy tsc /
jest / eslint / đo độ dài dòng sau từng task, rồi xuất thành patch và **áp lại trên một bản clone mới** để chắc chắn
patch áp sạch và cho đúng kết quả. Code của mỗi task vì vậy nằm nguyên văn trong patch tương ứng ở
`docs/superpowers/plans/2026-10-02-printer-model-language-refactor/`; plan này mô tả từng patch làm gì, sinh ra những
interface nào, các quyết định đã chốt, và lệnh kiểm tra kèm số liệu mong đợi.

Thứ tự task theo spec §15, với hai điều chỉnh để mỗi commit đều chạy được và không có code chết: phần in
(`PrinterPrintService`, `PrintScheduler`) chuyển sang ngôn ngữ + kết nối ngay ở Task 6 cùng tầng kết nối (driver không
còn giữ kết nối nên không in được nữa); `LibraryAdapter`, `resolvePrinterAdapter`, `transports/` bị xoá ở Task 6 khi hết
nơi dùng, còn hai thư viện JS được gỡ ở Task 7 cùng lúc với `TsplDriver.scan` (nơi cuối cùng dùng
`react-native-bluetooth-classic`).

Trong các bước dưới, `P=docs/superpowers/plans/2026-10-02-printer-model-language-refactor` (thư mục patch).

Patch dùng được với `git am` (tạo luôn commit đúng message + trailer). Nếu một patch không áp được hoặc số liệu kiểm tra
lệch: **dừng, báo lại** — không sửa tay cho khớp.

## Global Constraints

- Repo `C:\NDTCORE\NDTCore\NDTCore.App`, branch `refactor/printer-model-language`. Không dùng git worktree, không commit
  thẳng `main`, không push.
- Không bao giờ `git add -A` / `git add .`.
- Commit message tiếng Anh, kết thúc bằng trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (đã có sẵn
  trong patch).
- Quy ước code (spec §13), mọi file mới hoặc bị viết lại:
  1. Summary tiếng Việt một dòng cho mọi model, interface, class, hàm export không hiển nhiên, và field cần giải thích;
     một dòng trống giữa các field và giữa các method.
  2. Comment chỉ nói WHY, 1–3 dòng; không kể lịch sử; không tham chiếu tài liệu (số mục spec, tên file tài liệu).
  3. Dòng ≤ 120 ký tự (đo bằng Node); TS nesting ≤ 3; không `any`.
  4. Tên đầy đủ, không viết tắt; interface tiền tố `I`.
  5. Import module khác qua barrel nếu có.
- Dòng dài có sẵn từ trước mà chỉ bị đổi tên (không viết lại) thì không reflow — dọn ở đợt 2.
- Sau mỗi task: `npx tsc --noEmit` 0 lỗi, `npx jest` xanh với đúng số suite/test ghi trong task, `npx eslint
  src/features/printer` 0 lỗi.
- Storage lên v8, dữ liệu cũ bị xoá (không migrate).

## Review Focus

Năm tình huống spec ngụ ý mà dễ làm người dùng gặp lỗi nhất, kèm test ghim từng cái:

1. **Máy USB chưa có serial lúc quét, được cấp quyền khi kết nối** → sau khi dò xong phải quét lại và khớp đúng máy theo
   `DeviceInfo.deviceId` để lưu `deviceId` có serial (`usb:<vid>:<pid>:<serial>`); khớp theo vid/pid sẽ nhầm khi có hai
   máy cùng model. Test: Task 7, `useAddPrinterFlow.test.tsx` — "USB: sau khi kết nối đọc lại serial…".
2. **Hai `Printer` record cùng một máy vật lý (Hoá đơn + Tem) cùng nhận lệnh in** → phải in lần lượt dù khác ngôn ngữ;
   hai máy khác nhau cùng loại kết nối thì in song song. Test: Task 6, `PrintScheduler.test.ts`.
3. **Rút cáp / tắt máy giữa phiên** → trạng thái `Disconnected`; sự kiện mất kết nối của adapter đã bị thay (kết nối
   lại) không được đổi trạng thái phiên mới. Test: Task 6, `PrinterConnectionService.test.ts`, `NativeAdapter.test.ts`.
4. **Giấy tem chưa nhập đủ kích thước** → In thử bị chặn (báo lỗi giấy), kết nối/dò vẫn chạy với giấy mặc định, không
   lưu cấu hình giấy hỏng. Test: Task 3, `PaperDraft.test.ts` ("giấy tem thiếu một kích thước…"),
   `useAddPrinterFlow.test.tsx` ("onTestPrint khi giấy tem thiếu kích thước…", "onChangePaper giấy tem thiếu kích
   thước…").
5. **Máy ESC/POS cắm USB** → không bao giờ tự xác nhận ESC/POS; dò xong phải ngắt kết nối và cho chọn ngôn ngữ tay.
   Test: Task 7, `LanguageDetectionService.test.ts` — "USB không bao giờ tự xác nhận ESC/POS…".

Không kiểm được bằng jest, cần máy thật (Task 10): TSPL qua Bluetooth/LAN đi native; quét Bluetooth chỉ thấy máy đã ghép
đôi; hai máy ESC/POS cùng loại kết nối cùng lúc; khoá theo máy vật lý.

---

## Task 0: Đưa plan và patch vào branch

**Files:**
- Create: `docs/superpowers/plans/2026-10-02-printer-model-language-refactor.md`
- Create: `docs/superpowers/plans/2026-10-02-printer-model-language-refactor/0001…0009-*.patch`

- [ ] **Step 1: Kiểm tra điểm xuất phát**

Run: `git -C C:/NDTCORE/NDTCore/NDTCore.App log --oneline -1` (sau commit plan thì là commit plan, cha là `1ae9c2a`)
Expected: branch `refactor/printer-model-language`, working tree sạch (trừ file untracked có sẵn).

Plan và patch được commit riêng bằng `docs: add printer model and language refactor plan` trước khi bắt đầu Task 1.

---

## Task 1: Ghim byte encode bằng fixture

**Patch:** `0001-test-pin-printer-driver-output-bytes-with-encode-fin.patch`

**Files:**
- Create: `src/features/printer/testing/encodeCases.ts` — `ENCODE_CASES` (8 ca: ESC/POS lệnh 80/58mm có/không cắt,
  ESC/POS ảnh 80/58mm, TSPL lệnh hoá đơn, TSPL ảnh hoá đơn, TSPL lệnh tem 2 cột, TSPL ảnh tem 2 cột × 2 hàng) và
  `fingerprintOf(bytes)` (FNV-1a 32-bit + độ dài; tsconfig không có Node `crypto`).
- Create: `src/features/printer/drivers/__tests__/encodeCases.test.ts` — chạy `driver.testPrint` thật, gộp mọi lần
  `DeviceModule.write` và so dấu vân tay.

**Interfaces:**
- Produces: `ENCODE_CASES: { name; printer; documents; options?; fingerprint }[]`, `fingerprintOf(bytes: Uint8Array):
  string`. Task 5 và Task 6 dùng lại để chứng minh byte không đổi.

- [ ] **Step 1: Áp patch** — `git am $P/0001-test-pin-printer-driver-output-bytes-with-encode-fin.patch`
- [ ] **Step 2: Kiểm tra** — `npx tsc --noEmit` (0 lỗi); `npx jest` → **Test Suites: 137 passed, Tests: 1009 passed**;
  `npx eslint src/features/printer` (0 lỗi).

---

## Task 2: Đổi tên model, `deviceId`, storage v8

**Patch:** `0002-refactor-rename-printer-models-to-kind-language-pape.patch` (119 file, phần lớn là đổi tên)

**Files (chính):**
- Create: `models/printer/{PrintKind, ConnectionType, PrinterConnection, deviceIdOf, PrinterLanguage,
  PrinterCapabilities, PrinterStatus, Printer}.ts`, `models/paper/PaperOptions.ts` (dạng cũ, field tuỳ chọn — Task 3 đổi
  sang union), `models/printing/{PrintDocuments, PrintOptions, PrintJob}.ts`, `utils/printKindLabels.ts`.
- Delete: `models/printing/PrintType.ts`, `models/printing/PrintTarget.ts`, `models/printer/PrinterDriver.ts`,
  `models/paper/PrintPaperConfig.ts`.
- Modify: toàn feature + `features/cart` theo bảng đổi tên spec §12 (`PrintType`→`PrintKind`/`kind`,
  `identityKey`→`deviceId`, `PrinterConnectionType`→`ConnectionType`, `driver`→`language`,
  `RenderMode.Encoder/Bitmap`→`Command/Raster`, `bitmapSource`→`rasterSource`, `PrintPaperConfig`→`PaperOptions`,
  Bluetooth `deviceId`→`mac`, bỏ `name`).
- Modify: `storage/PrinterStorage.ts` — `CURRENT_STORAGE_VERSION = 8`, dữ liệu phiên bản khác bị xoá; khối comment lịch
  sử rút còn một dòng chính sách.

**Interfaces:**
- Produces: `Printer { id; deviceId; kind; name; vendor?; model?; connection; language; paper; capabilities;
  autoReconnect; enabled; createdAt; updatedAt }`, `PrinterLanguage { type: PrintLanguage; selection: LanguageSelection;
  renderMode: RenderMode; rasterSource: RasterSource }`, `PrinterCapabilities { cutter; cashDrawer; color; image }`,
  `deviceIdOf(connection): string`.

**Rulings:**
- Định dạng `deviceId` Bluetooth giữ `bluetooth:mac:<MAC>` như hiện có (spec ghi giữ định dạng; ví dụ trong spec được
  sửa ở Task 9).
- Model thiết bị (`DeviceInfo`, `DiscoveredDevice`, `DeviceDiscoveryEvent`) để tới Task 7, cùng lúc với tìm thiết bị.

- [ ] **Step 1: Áp patch** — `git am $P/0002-refactor-rename-printer-models-to-kind-language-pape.patch`
- [ ] **Step 2: Kiểm tra** — tsc 0 lỗi; `npx jest` → **Test Suites: 137 passed, Tests: 1009 passed**; eslint 0 lỗi;
  `npx jest src/features/printer/drivers/__tests__/encodeCases.test.ts` vẫn xanh (byte không đổi).

---

## Task 3: Giấy cuộn / giấy tem thành union

**Patch:** `0003-refactor-split-printer-paper-into-continuous-and-die.patch`

**Files (chính):**
- Modify: `models/paper/PaperOptions.ts` — `PaperOptions = ContinuousPaper | DieCutPaper` (giấy cuộn có `cutterMode` bắt
  buộc; tem có đủ kích thước, không có dao cắt).
- Create: `forms/addPrinter/PaperDraft.ts` (+ test) — bản nháp form, field tem có thể trống; `toPaperOptions(draft)` chỉ
  trả `PaperOptions` khi đủ và hợp lệ; `DIE_CUT_DRAFT_DEFAULTS`.
- Modify: `paper/validation.ts` (nhận `PaperDraft`), `paper/cutter.ts` (`DieCut`→`None`, còn lại `paper.cutterMode`),
  `languages`/`drivers` TSPL (`columnPitchDots(DieCutPaper)`; giấy cuộn in tem dùng chiều cao mặc định 30mm),
  `forms/addPrinter/PrinterSchema.ts` (`paperOptionsSchema = discriminatedUnion(...).superRefine(tràn hàng)`), UI giấy
  dùng `PaperDraft`, `PrinterConfigService.setPaper(id, PaperOptions)`, `useDriverConfig` chỉ ghi khi `toPaperOptions`
  hợp lệ, `useAddPrinterFlow` (`paper: toPaperOptions(paper) ?? DEFAULT_PAPER`), `useTestPrint` (nhận `paperError`, từ
  chối in thử).

**Rulings:**
- Giấy cuộn in tem: chiều cao = `DEFAULT_LABEL_HEIGHT_MM` (30) — bỏ `itemHeightMm` cũ treo trên giấy cuộn.
- Bỏ test schema "die-cut cutterMode" (trạng thái này không còn biểu diễn được).
- In thử bị chặn khi bản nháp tem chưa đủ; kết nối dùng `DEFAULT_PAPER` làm giá trị tạm.
- zod `discriminatedUnion` cần `ZodObject` thuần nên `superRefine` đặt trên union.

- [ ] **Step 1: Áp patch** — `git am $P/0003-refactor-split-printer-paper-into-continuous-and-die.patch`
- [ ] **Step 2: Kiểm tra** — tsc 0 lỗi; `npx jest` → **Test Suites: 138 passed, Tests: 1012 passed**; eslint 0 lỗi.

---

## Task 4: Mặc định máy in mới và `canPrintKind`

**Patch:** `0004-refactor-replace-driver-capabilities-with-printer-dr.patch`

**Files:**
- Create: `management/createPrinterDraft.ts` (+ test) — `DEFAULT_PAPER` (cuộn 80mm, `PerJob`),
  `createPrinterLanguage(type, selection)` (ESC/POS `Command`, TSPL `Raster`, `rasterSource: Image`),
  `defaultCapabilitiesOf(type)` (ESC/POS `{cutter, cashDrawer, image}`, TSPL `{image}`), `createPrinterDraft({ id?,
  kind, connection, language })` (`autoReconnect: true`, tên tạm "Máy in mới").
- Create: `forms/addPrinter/printerRules.ts` (+ test) — `canPrintKind(language, kind)`: ESC/POS chỉ `Receipt`.
- Delete: `drivers/DriverCapabilities.ts`, `drivers/driverConfig.ts` và test.
- Modify: `StatusPanel`, `PrinterDiscoveryService`, `useProtocolDiscovery`, `PrinterSchema`, `useTestPrint`,
  `PrintService`, `useAddPrinterFlow` (`buildDraftPrinter` dựng trên `createPrinterDraft`).

**Interfaces:**
- Produces: `createPrinterDraft(input: PrinterDraftInput): Printer`, `createPrinterLanguage(type, selection):
  PrinterLanguage`, `canPrintKind(language: PrintLanguage, kind: PrintKind): boolean`, `DEFAULT_PAPER: ContinuousPaper`.

- [ ] **Step 1: Áp patch** — `git am $P/0004-refactor-replace-driver-capabilities-with-printer-dr.patch`
- [ ] **Step 2: Kiểm tra** — tsc 0 lỗi; `npx jest` → **Test Suites: 138 passed, Tests: 1009 passed**; eslint 0 lỗi.

---

## Task 5: `languages/` — ESC/POS và TSPL chỉ encode

**Patch:** `0005-refactor-move-printer-encoding-into-ESC-POS-and-TSPL.patch`

**Files:**
- Move: `drivers/escpos/EscPosTextBuilder.ts` → `languages/escpos/`; `EscPosBitmapEncoder` →
  `languages/escpos/EscPosRasterEncoder.ts` (`buildEscPosRasterBytes`); `adapters/native/utils/{EPToolkit,
  buffer-helper}` → `languages/escpos/`; `drivers/tspl/TsplEncoder.ts` → `languages/tspl/`; strategies →
  `languages/tspl/strategies/` (`TsplCommandStrategy`, `TsplRasterStrategy`); kèm test.
- Create: `languages/IPrintLanguage.ts`, `languages/getPrintLanguage.ts`, `languages/escpos/EscPosLanguage.ts`,
  `languages/tspl/TsplLanguage.ts`, `languages/__tests__/encodeCases.test.ts`, test cho hai ngôn ngữ.
- Modify: `EscPosDriver`/`TsplDriver` gọi `EscPosLanguage.encode` / `TsplLanguage.encode` /
  `TsplLanguage.identifyProbe`.

**Interfaces:**
- Produces: `IPrintLanguage { encode(printer, documents, options?): Uint8Array; identifyProbe?: IdentifyProbe }`,
  `IdentifyProbe { command: Uint8Array; matches(response): boolean }`, `getPrintLanguage(type): IPrintLanguage`.

**Rulings:**
- `EscPosLanguage` bỏ 9 byte tiền tố khởi tạo `1B 40 1C 26 1C 43 FF 1B 32` mà `EPToolkit.exchange_text` luôn thêm (thay
  mẹo `.replace('G0AcJhxD/xsy', '')` trên base64), làm trên byte; đường lệnh ESC/POS ghi thẳng byte này.
- `TsplLanguage`: `rows` không hợp lệ (≤0, NaN) coi như 1; lệnh dò `~!T\r\n`, khớp khi phản hồi ≥ 1 byte.
- File chỉ di chuyển (TsplEncoder…) giữ nguyên dòng dài có sẵn.

- [ ] **Step 1: Áp patch** — `git am $P/0005-refactor-move-printer-encoding-into-ESC-POS-and-TSPL.patch`
- [ ] **Step 2: Kiểm tra** — tsc 0 lỗi; `npx jest` → **Test Suites: 141 passed, Tests: 1024 passed** (cả hai test
  fixture — driver và languages — đều xanh); eslint 0 lỗi.

---

## Task 6: Tầng kết nối chung

**Patch:** `0006-refactor-route-printer-connections-through-a-shared-.patch`

**Files (chính):**
- Modify: `adapters/IPrinterAdapter.ts` — bỏ `printText`, `PrinterConnectTarget`, `toConnectTarget`; `source: 'native' |
  'vendor'`; `connect(connection: PrinterConnection)`; thêm `onLost(callback): Unsubscribe`; export `Unsubscribe`.
- Modify: `adapters/native/NativeAdapter.ts` — `connect(connection)`, `onLost` qua `subscribeDeviceDisconnected` so
  `connectionId` của kết nối đang giữ; bỏ `printText`, đường iOS cũ, `getConnectionId`.
- Modify: `adapters/vendor/VendorAdapter.ts` theo interface mới.
- Create: `connection/createPrinterAdapter.ts` (`NativeAdapter`), `connection/createPrinterAdapter.web.ts` (báo
  `PRINTER_UNSUPPORTED_CONNECTION`).
- Rewrite: `connection/PrinterConnectionService.ts` — phiên `Map<printerId, { adapter; stopWatchingLost }>`;
  `connect(printer)`, `disconnect(printerId)`, `send`, `read`, `getStatus`, `onStatusChange`, `reconnect`,
  `reconnectAutoPrinters`; deps `{ createAdapter, ensureBluetoothPermission, repository }`.
- Rewrite: `connection/PrinterConnectionLock.ts` — `lockKeyOf(printer) = deviceIdOf(printer.connection)`; bỏ
  `connectionResourceKey`/`resourceKeyFor`.
- Rewrite: `printing/PrinterPrintService.ts` — chưa `Connected` thì `connect`; `getPrintLanguage(...).encode`; `send`;
  `testPrint` tự khoá theo `lockKeyOf`.
- Modify: `printing/PrintScheduler.ts` (khoá `lockKeyOf`), `logging/PrinterLogger.ts` (log kết nối bỏ ngôn ngữ; log in
  đổi `protocol`→`language`), `discovery/PrinterDiscoveryService.ts` (connect/disconnect qua connection service),
  `hooks/useAddPrinterFlow.ts`, `hooks/addPrinter/useProtocolDiscovery.ts`, `hooks/usePrinterList.ts` (API mới).
- Shrink: `drivers/` chỉ còn `scan` + `identify(printer)` (identify chạy trên connection service) — xoá ở Task 7.
- Delete: `adapters/library/`, `adapters/resolvePrinterAdapter.ts`, `transports/`.
- Move: test fixture byte sang `printing/__tests__/encodeCases.test.ts` (PrinterPrintService + PrinterConnectionService
  thật + `DeviceModule` mock).
- Test mới/viết lại: `PrinterConnectionService.test.ts`, `createPrinterAdapter.test.ts`, `NativeAdapter.test.ts`,
  `VendorAdapter.test.ts`, `PrinterPrintService.test.ts`, `PrintScheduler.test.ts`, `PrinterConnectionLock.test.ts`;
  test kit `makeFakeAdapter`, `makeMockConnectionService`.

**Interfaces:**
- Produces: `PrinterConnectionService.{connect(printer), disconnect(id), send(id, bytes), read(id, timeoutMs),
  getStatus(id), onStatusChange(id, cb), reconnect(id), reconnectAutoPrinters()}`,
  `createPrinterConnectionService(deps)`, `lockKeyOf(printer): string`, `createPrinterAdapter(): IPrinterAdapter`.

**Rulings:**
- `PrinterConnectionService` không tự khoá — khoá chỉ ở tầng in (scheduler + in thử), vì `print` kết nối bên trong khoá
  của scheduler và khoá không reentrant. Giá phải trả nếu sai: kết nối từ UI có thể chen giữa một lệnh in cùng máy (pool
  dùng chung kết nối native nên vô hại).
- `deps` có thêm `repository` (spec chỉ ghi hai deps) để `reconnect` và test thay được.
- Lỗi khi ngắt ném lại nguyên lỗi của adapter (đã là `PrinterErrorException`), không bọc lại
  `PRINTER_CONNECTION_FAILED`.
- Lưu máy in xong thì kết nối bằng bản đã lưu (`PrinterRepository.findOrThrow`), vì repository tính lại `deviceId`.
- Các ca encode trong test driver bị xoá được chuyển sang `languages/`: ESC/POS phần tử QR/ảnh không hỗ trợ; TSPL ảnh
  cao quá tem nhưng in được hoá đơn; "nội dung lỗi thì không gửi gì" ở `PrinterPrintService`.

- [ ] **Step 1: Áp patch** — `git am $P/0006-refactor-route-printer-connections-through-a-shared-.patch`
- [ ] **Step 2: Kiểm tra** — tsc 0 lỗi; `npx jest` → **Test Suites: 139 passed, Tests: 927 passed** (fixture byte qua
  đường in thử vẫn xanh); eslint 0 lỗi.

---

## Task 7: Tìm thiết bị, dò ngôn ngữ, xoá `drivers/`

**Patch:** `0007-refactor-split-device-discovery-and-language-detecti.patch`

**Files (chính):**
- Create: `models/device/{DeviceInfo, DiscoveredDevice, DeviceDiscoveryEvent}.ts`.
- Modify: `IPrinterAdapter.listDevices` → `DiscoveredDevice[]`; `NativeAdapter` ánh xạ theo bảng spec §5.3 (bỏ
  `devicePath` khỏi kết nối; tên trống → MAC / đường dẫn).
- Create: `discovery/DeviceDiscoveryService.ts` (+ test), `detection/LanguageDetectionService.ts` (+ test),
  `hooks/addPrinter/useLanguageDetection.ts`, `components/DiscoveredDeviceList.tsx`.
- Rewrite: `logging/PrinterLogger.ts` (`scan*`→`discovery*`; dò ngôn ngữ →
  `detection*`/`languageDetected`/`languageUnknown`) và test dạng bảng.
- Modify: `useConnectionSetup` (`selectedDevice: DiscoveredDevice`; `refreshUsbSerial` quét lại qua adapter, khớp theo
  `DeviceInfo.deviceId`), `useAddPrinterFlow`, `ConnectionSection`, `StatusPanel`/`PrinterInfoCard` (`device?:
  DeviceInfo`).
- Delete: `drivers/`, `models/printer/PrinterDevice.ts`, `discovery/{PrinterResolver, DeviceScanService,
  PrinterDiscoveryService}.ts`, `components/DeviceScanList.tsx`, `hooks/addPrinter/useProtocolDiscovery.ts` và test
  tương ứng.
- Gỡ `react-native-bluetooth-classic`, `react-native-tcp-socket` khỏi `package.json` / `package-lock.json`, bỏ mock
  trong `jest.setup.js` và alias trong `webpack.config.js`.

**Interfaces:**
- Produces: `DeviceDiscoveryService.discover(connectionType, onEvent): Unsubscribe`, `LanguageDetectionService.detect({
  draftPrinter }, onEvent): Unsubscribe`, `LanguageDetectionEvent = Connecting | Identifying{language} |
  Detected{language: PrinterLanguage} | Unknown | Error{error}`, `LanguageDetectionStage`.

**Rulings:**
- Dò ngôn ngữ kết nối **một lần** (spec §11 hàng 5); thử TSPL rồi ESC/POS lọc theo `canPrintKind`; gửi lệnh dò lỗi coi
  như không khớp.
- Máy đang sửa (chưa quét lại) được dựng `selectedDevice` từ bản đã lưu: `device { deviceId: printer.deviceId, name: '',
  manufacturer: vendor, model, hasPermission: true }`, `connection` = kết nối đã lưu.
- `PrinterDeviceInfo` (luôn rỗng) được thay bằng `DeviceInfo` của thiết bị đang chọn để hiển thị hãng/model đọc được từ
  USB.
- Bỏ chặn USB trên iOS ở bước tìm thiết bị (iOS ngoài phạm vi; native thiếu thì báo `Error`).
- `iOS/Podfile.lock` không đụng (iOS ngoài phạm vi).

- [ ] **Step 1: Áp patch** — `git am $P/0007-refactor-split-device-discovery-and-language-detecti.patch`
- [ ] **Step 2: Không chạy `npm install`** — patch chỉ sửa `package.json`/`package-lock.json`; thư mục `node_modules`
  hiện có vẫn chạy được test. Chạy `npm install` sau khi merge để dọn hai thư viện khỏi `node_modules`.
- [ ] **Step 3: Kiểm tra** — tsc 0 lỗi; `npx jest` → **Test Suites: 135 passed, Tests: 899 passed**; eslint 0 lỗi.

---

## Task 8: Đổi tên UI còn lại

**Patch:** `0008-refactor-rename-printer-settings-UI-from-driver-and-.patch`

**Files:**
- Move: `hooks/addPrinter/useDriverConfig.ts` → `usePrintSettings.ts`; `components/DriverMediaSection.tsx` →
  `PaperSection.tsx`; `components/DriverRenderModeSection.tsx` → `RenderModeSection.tsx`.
- Rename: `ProtocolState`→`LanguageState`, `protocolState`→`languageState`, `onChooseProtocol`→`onChooseLanguage`,
  `lastProtocol`→`languageType`, `protocolLabel`→`languageLabel`, `hasDriver`→`hasLanguage`, prop
  `StatusPanel.protocol`→`languageType`…
- Sửa comment/tên test còn nói "driver"/"protocol".

**Rulings:**
- Chuỗi hiển thị cho người dùng ("Driver: ESC/POS", "Giao thức: …") **giữ nguyên** — đổi copy UI là thay đổi hành vi
  ngoài spec; để người dùng quyết.
- Mã lỗi `PRINTER_PROTOCOL_UNKNOWN` giữ nguyên (mã lỗi là định danh ổn định).

- [ ] **Step 1: Áp patch** — `git am $P/0008-refactor-rename-printer-settings-UI-from-driver-and-.patch`
- [ ] **Step 2: Kiểm tra** — tsc 0 lỗi; `npx jest` → **Test Suites: 135 passed, Tests: 899 passed**; eslint 0 lỗi; lệnh
  dưới chỉ còn ra dữ liệu v7 cũ trong `PrinterStorage.test.ts` (và tài liệu `.md`, sửa ở Task 9):

  ```bash
  grep -rnwE "PrintType|identityKey|PrinterDriver|PrintPaperConfig|PrinterDevice|IPrinterDriver|DriverRegistry" src
  ```

---

## Task 9: Tài liệu

**Patch:** `0009-docs-describe-printer-languages-shared-connection-la.patch`

**Files:**
- Rewrite: `src/features/printer/ARCHITECTURE.md` — phần kiến trúc (mục 1–33, 53–62) viết lại theo model mới; mục quy
  tắc code chung giữ nguyên, đánh số lại, sửa ví dụ còn dùng tên cũ.
- Modify: `src/features/printer/CODING_STYLE.md` (ví dụ tên), `CLAUDE.md` (mục Printer Module), spec (ví dụ `deviceId`
  Bluetooth → `bluetooth:mac:<MAC>`).

- [ ] **Step 1: Áp patch** — `git am $P/0009-docs-describe-printer-languages-shared-connection-la.patch`
- [ ] **Step 2: Kiểm tra** — `npx jest` → **Test Suites: 135 passed, Tests: 899 passed**; mọi dòng `.md` sửa ≤
  120 ký tự.

---

## Task 10: Kiểm tra trên máy thật (người dùng)

- [ ] Thêm máy USB, Bluetooth, LAN; dò ngôn ngữ đúng; máy USB lưu `deviceId` có serial.
- [ ] TSPL qua Bluetooth/LAN in được (giờ đi native, không còn thư viện JS).
- [ ] Quét Bluetooth: chỉ thấy máy đã ghép đôi.
- [ ] Hai máy ESC/POS cùng loại kết nối kết nối và in cùng lúc.
- [ ] In hoá đơn ESC/POS (lệnh và ảnh) và tem TSPL (ảnh, nhiều cột); bản in giống trước refactor.
- [ ] Sau khi merge: `npm install` để gỡ hai thư viện khỏi `node_modules`, build Android lại.
