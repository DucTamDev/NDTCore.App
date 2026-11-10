# Printer Package Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `features/printer` của App chỉ còn UI, mẫu in và dữ liệu đơn; kết nối, dò ngôn ngữ, hàng đợi, chụp ảnh, dựng
lệnh, lưu máy in đi qua `@ndtcore/printer` và `@ndtcore/printer-native`.

**Architecture:** Package nằm ở repo `NDTCore.Package` cùng thư mục cha, App phụ thuộc bằng `file:`. Task 1–2 (sửa
package cho đủ nhu cầu của App) đã làm ở plan package `refactor/printer-model`; Task 3 nối package vào bundler,
Jest, webpack; Task 4–10 chuyển từng phần App sang API package trong khi code cũ vẫn chạy song song; Task 11 gỡ code cũ; Task 12 kiểm đầu cuối trên máy ảo.

**Tech Stack:** React Native 0.86.2 New Architecture, TypeScript strict, Jest + react-test-renderer, react-native-paper,
react-hook-form + zod, Metro, webpack (bản web).

**Spec:** `docs/superpowers/specs/2026-11-10-printer-package-migration-design.md` (D1–D14). API package:
`../NDTCore.Package/docs/05-technical/tsd.md` mục 5, 8.1, 9.6, 9.11.

## Global Constraints

- Hai repo, không worktree: `C:\NDTCORE\NDTCore\NDTCore.Package` ở `main` sau khi merge `refactor/printer-model`
  (chỉ sửa khi Task 3 bước 10 cần); `C:\NDTCORE\NDTCore\NDTCore.App` nhánh `feat/printer-package` (Task 3–12).
- Package: theo `NDTCore.Package/docs/04-architecture/03-structure.md` (thư mục `enums/`, `constants/`, `types/`…,
  import trong module thẳng file, khác module qua barrel). Mỗi task package sửa code thì sửa docs liên quan (SRS, TSD,
  test case) trong commit docs riêng.
- App: theo `src/features/printer/CODING_STYLE.md` và `docs/CODING_STANDARDS_TS.md`; domain constant là const-object;
  service là class + instance camelCase.
- Hàm trả Promise có hậu tố `Async` (code mới và hàm đổi chữ ký).
- Comment tiếng Việt, chỉ giải thích WHY, 1–3 dòng; field export có JSDoc tiếng Việt, một dòng trống giữa các field.
- Dòng ≤ 120 ký tự (đo bằng Node); tên theo khái niệm, không ghép nơi dùng hay chi tiết style.
- Mẫu in đo bằng dot chuẩn (1/8 mm); mọi kích thước trong mẫu đi qua `toDp`; không viết số dp trực tiếp.
- Singleton phải lấy từ `node_modules` của App: `react`, `react-native`, `react-native-mmkv`, `react-native-view-shot`,
  `@ndtcore/printer-native`.
- Commit: `<type>: <mô tả>` tiếng Anh, không `git add -A`/`git add .`, kết thúc bằng
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Không push.
- Mỗi task xong: App `npx tsc --noEmit` 0 lỗi, `npx eslint src` sạch, Jest phần liên quan pass; package
  `npx tsc --noEmit -p .`, `npx jest`, `npx eslint src index.ts` sạch.

## Review Focus

1. Bản sao `react` trong `NDTCore.Package.Printer/node_modules` lọt vào bundle hoặc Jest → hook của package lỗi "Invalid
   hook call". (Task 3, test `smoke: hook của package chạy trong cây React của App`)
2. Mẫu chạy ngoài khung dựng (vd bản xem trước trong App gọi `ReceiptTemplate` trực tiếp) → `usePrintRenderContext` ném;
   mọi nơi dựng mẫu ngoài package phải bọc `renderWithContext`. (Task 5, test `mẫu dựng ngoài context thì ném rõ lỗi`)
3. Đơn có tem nhưng chưa có máy in tem → không cảnh báo, không snackbar; chưa có máy in hoá đơn → cảnh báo ngay lúc bấm.
   (Task 6 test `không có máy in tem thì không cảnh báo`; Task 7 test `PRINTER_NOT_ASSIGNED không hiện snackbar`)
4. Lưu cấu hình sai (vd khổ 113 mm) → lỗi `INPUT_INVALID` của package hiện đúng ô trên form, không mất dữ liệu đã nhập.
   (Task 10, test `fieldErrors của package gắn vào đúng trường`)
5. Bản web: mở màn máy in và thanh toán không crash; máy in báo không hỗ trợ. (Task 3 bước build web; Task 12 bước 6)

---

### Task 1: Package — vùng in khổ 100 mm và 104 mm (đã xong ở package)

Làm ở plan package `NDTCore.Package/docs/superpowers/plans/2026-11-10-printer-model-refactor.md` Task 5, nhánh
`refactor/printer-model` (790d701): `printableWidthMm(100) === 96`, `printableWidthMm(104) === 104`;
`RECEIPT_PAPER_WIDTHS_MM` có 100, 104. Không còn việc ở plan này.

### Task 2: Package — API cho app (đã xong ở package)

Làm ở plan package (Task 1–5) cùng nhánh. API App dùng từ đây trở đi:

- `renderWithContext(renderer, context): ReactElement` xuất ở `@ndtcore/printer`.
- `Printer` chỉ đọc: `id`, `createdAt`, `deviceInfo`, `connectionConfig`, `config` (`PrinterConfig`: `kind`, `name`,
  `lang`, `langSource`, `capabilities`, `paper`), `status`, `address`.
- `printer.withConfig(update: PrinterConfigUpdate): Printer` (`name?`, `lang?`, `capabilities?`, `paper?`): bản sao chưa
  lưu, ném `INPUT_INVALID` kèm `fieldErrors` ngay khi sai. `paper` thay nguyên khối; bản nháp chưa dò được `lang` thì
  lần `withConfig` đầu phải có `lang`.
- `printerSetup.connectAsync(candidate): Promise<Printer>` trả bản nháp; `printerSetup.saveAsync(draft)` nhận bản nháp
  (hoặc bản `withConfig` của nó), trả Printer mới. Không còn `getDefaultPrinter`, `SetupConnection`.
- `printerManager.updateAsync(printer)` nhận bản `withConfig` của máy đã lưu;
  `printerManager.updateLanAddressAsync(printerId, host, port)` đổi IP, cổng máy LAN.
- `printService.testPrintAsync(printer, renderers)`: in thử bản nháp, máy đã lưu hoặc bản `withConfig`. Không còn
  `printerSetup.testPrintAsync`, `printerManager.testPrintAsync`.
- Trên web `@ndtcore/printer-native` có module `null`; mọi hàm ném `PLATFORM_UNSUPPORTED`.
- MMKV đổi khoá sang `printerRecords` (`schemaVersion` 1): máy đã lưu ở bản package cũ cũng phải thêm lại (D6).

### Task 3: App — nối package vào Metro, Jest, webpack

Repo `NDTCore.App`, nhánh `feat/printer-package` (đã tạo từ `main`).

**Files:**
- Modify: `package.json`, `metro.config.js`, `jest.config.js`, `jest.setup.js`, `webpack.config.js`
- Create: `src/features/printer/__tests__/PrinterPackage.test.tsx`

**Interfaces:**
- Produces: `import { printerManager, printService, printerSetup, PrintCaptureHost, usePrintRenderContext,
  renderWithContext, PrinterKind, PrinterErrorCode, … } from '@ndtcore/printer'` chạy được trong App, Jest, Metro,
  webpack.

- [ ] **Step 1:** `package.json`: thêm `"@ndtcore/printer": "file:../NDTCore.Package/NDTCore.Package.Printer"`,
  `"@ndtcore/printer-native": "file:../NDTCore.Package/NDTCore.Package.Printer.Native"`; nâng `react-native-view-shot`
  lên `^6.2.1`. `npm install --legacy-peer-deps`.
- [ ] **Step 2: Viết test** `PrinterPackage.test.tsx`:
  `it('smoke: hook của package chạy trong cây React của App')` dựng
  `renderWithContext(() => <Probe />, context)` bằng `react-test-renderer`, trong đó `Probe` gọi
  `usePrintRenderContext().toDp(8)` và ghi ra; kỳ vọng giá trị bằng `context.toDp(8)`. Thêm
  `it('smoke: PrinterKind và printService có từ package')`.
- [ ] **Step 3:** `npx jest src/features/printer/__tests__/PrinterPackage` → FAIL (chưa resolve, hoặc
  "Invalid hook call").
- [ ] **Step 4: Jest.** `transformIgnorePatterns` thêm `@ndtcore`; `moduleNameMapper` ánh xạ các singleton ở Global
  Constraints (cả `^react/(.*)$`, `^react-native/(.*)$`) về `<rootDir>/node_modules/...`; `jest.setup.js` thêm
  `jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }))`.
- [ ] **Step 5:** `npx jest src/features/printer/__tests__/PrinterPackage` → PASS.
- [ ] **Step 6: Metro.** `watchFolders: [path.resolve(__dirname, '../NDTCore.Package')]`; `resolver.resolveRequest` trả
  về bản trong `node_modules` của App cho các singleton (resolve bằng `context.resolveRequest` với
  `originModulePath` là một file trong App), còn lại để mặc định.
- [ ] **Step 7:** `npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output
  %TEMP%\app.bundle` → thành công, bundle chỉ có một bản `react` (tìm `node_modules/react/index.js` xuất hiện một lần
  trong `--sourcemap-output`).
- [ ] **Step 8: Webpack.** Alias các singleton về `node_modules` của App; `babel-loader` include thêm
  `../NDTCore.Package/NDTCore.Package.Printer`; `resolve.extensions` có `.web.js` trước `.js` để lấy
  `NativePrinterNative.web`. `npm run build:web` → thành công.
- [ ] **Step 9: Android.** Theo `feedback-android-build-env`: kiểm `JAVA_HOME`, `ANDROID_HOME` tồn tại;
  `cd android && ./gradlew :app:assembleDebug -PreactNativeArchitectures=x86_64` → BUILD SUCCESSFUL, autolinking có
  `ndtcore_printer-native`.
- [ ] **Step 10:** `npx tsc --noEmit` → 0 lỗi. Lỗi nằm trong file của package (tsconfig App khác package) thì sửa ở
  package cho đúng ở cả hai, commit bên package `fix: compile under app tsconfig`.
- [ ] **Step 11:** Commit `chore: depend on printer package via file links, wire Metro, Jest and webpack`.

### Task 4: App — khởi động máy in và câu lỗi tiếng Việt

**Files:**
- Modify: `App.tsx`
- Create: `src/features/printer/errors/PrinterErrorMessages.ts`
- Test: `src/features/printer/errors/__tests__/PrinterErrorMessages.test.ts`, `__tests__/App.test.tsx` (nếu có)

**Interfaces:**
- Produces: `printerErrorMessageOf(code: PrinterErrorCode): string` (câu cho người dùng, đủ 26 mã public).
- Consumes: `printerManager.initAsync()`, `printerManager.setLogSink`, `PrintCaptureHost`.

- [ ] **Step 1: Viết test** `it('mọi mã public đều có câu riêng, không rỗng')`:
  `Object.values(PrinterErrorCode).forEach((code) => expect(printerErrorMessageOf(code)).toMatch(/\S/))` và số câu
  khác nhau bằng số mã.
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Viết bảng `Record<PrinterErrorCode, string>` theo ý nghĩa ở TSD 12.3 (vd `BLUETOOTH_DISABLED` →
  "Bluetooth đang tắt", `DEVICE_IN_USE` → "Máy in đang bận in đơn khác").
- [ ] **Step 4:** Chạy → PASS.
- [ ] **Step 5:** `App.tsx`: gắn `<PrintCaptureHost />` cạnh `<PrintFailureSnackbar />`; trong `useEffect` gọi
  `printerManager.setLogSink(...)` chuyển sang `LoggerService` rồi `void printerManager.initAsync()`; bỏ lời gọi
  `printerConnectionService`. tsc, eslint, `npx jest` toàn bộ → PASS.
- [ ] **Step 6:** Commit `feat: start printer package at app launch, Vietnamese messages for package errors`.

### Task 5: App — mẫu in đo bằng dot chuẩn qua `toDp`

**Files:**
- Modify: `src/features/printer/templates/PrintLayout.tsx`, `PrintCodes.tsx`, `ReceiptTemplate.tsx`,
  `LabelTemplate.tsx`, `src/features/printer/components/SamplePrint.tsx`
- Create: `src/features/printer/templates/__tests__/renderTemplate.tsx` (helper test)
- Test: `templates/__tests__/LabelTemplate.test.tsx`, `PrintCodes.test.tsx`, `ReceiptTemplate.test.tsx`

**Interfaces:**
- Consumes: `usePrintRenderContext()`, `renderWithContext` (package, Task 2).
- Produces:
  - `usePaddingStyle(padding: PrintPadding): ViewStyle` thay `paddingStyleOf`.
  - `LabelTemplate` bỏ prop `paper`; `SampleLabel` bỏ prop `paper`.
  - Helper test `renderTemplate(element: ReactElement, toDp?: (dots: number) => number): ReactTestRenderer`, mặc
    định `toDp = (dots) => dots / 2`.

- [ ] **Step 1: Sửa và thêm test** (dùng `renderTemplate`):
  - `it('PrintText: cỡ chữ và line-height qua toDp')`: `size={27}` → `fontSize === 13.5`,
    `lineHeight === Math.round(27 * 1.3) / 2`.
  - `it('PrintCodes: mỗi ô đổi một lần rồi nhân')` với `toDp = (d) => Math.round(d * 1.476)`: một vạch dài 3 ô của
    `moduleDots` 2 rộng `3 * 3`, không phải `Math.round(6 * 1.476)`.
  - `it('LabelTemplate lấp đầy khung tem, không tự đặt chiều cao')`: style gốc có `flex: 1`, không có `height`.
  - `it('mẫu dựng ngoài context thì ném rõ lỗi')`: `TestRenderer.create(<ReceiptTemplate content={…} />)` ném
    `/usePrintRenderContext/`.
- [ ] **Step 2:** `npx jest src/features/printer/templates` → FAIL.
- [ ] **Step 3:** `PrintLayout`: `textStyleOf(size, bold, toDp)` trả `fontSize: toDp(size)`,
  `lineHeight: toDp(Math.round(size * LINE_HEIGHT_RATIO))`; `PrintDivider` nét và gạch qua `toDp`; `usePaddingStyle`.
  `PrintCodes`: `const module = toDp(moduleDots)`, `width = run.length * module`, `height = toDp(heightDots)`.
  `ReceiptTemplate`: logo `toDp(LOGO_SIZE_DOTS)`. `LabelTemplate`: bỏ `labelHeightOf`, `paper`, `DOTS_PER_MM`, gốc
  `flex: 1`.
- [ ] **Step 4:** `npx jest src/features/printer/templates` → PASS; tsc, eslint sạch.
- [ ] **Step 5:** Commit `refactor: print templates measure standard dots through toDp`.

### Task 6: App — in đơn và in lại qua package

**Files:**
- Modify: `src/features/cart/services/OrderPrintTrigger.ts`, `src/features/cart/hooks/useCheckout.ts`,
  `src/features/cart/hooks/useOrderHistory.ts`, `src/features/cart/components/CartPanel.tsx`,
  `src/features/cart/components/OrderHistoryPanel.tsx`
- Test: `src/features/cart/services/__tests__/OrderPrintTrigger.test.ts`,
  `src/features/cart/hooks/__tests__/useOrderHistory.test.ts`

**Interfaces:**
- Consumes: `printService.printAsync(request: PrintRequest): Promise<PrintJobHandle>`, `printerManager.getPrinters()`.
- Produces:
  - `printOrderAsync(receipt: ReceiptContent, labels: LabelContent): Promise<OrderPrintOutcome>` thay `printOrder`,
    `printReceipt`, `printLabels`, `printOrderChain`.
  - `OrderPrintOutcome { receipt: PrintOutcome; labels: PrintOutcome }`, `PrintOutcome = 'queued' | 'no-printer' |
    'failed'` giữ nguyên; `printWarningOf` giữ nguyên.
  - `useCheckout()` và `useOrderHistory()` không còn tham số `captureImage`.

- [ ] **Step 1: Viết lại test** với `jest.mock('@ndtcore/printer', …)` giả `printService.printAsync` và
  `printerManager.getPrinters`:
  - `it('một đơn là một Job: hoá đơn rồi tem')`: một lần `printAsync`, `title === 'Đơn #A1'`, `parts[0].kind ===
    PrinterKind.Receipt` với 1 renderer, `parts[1].kind === PrinterKind.Label` với số renderer bằng
    `labelPagesOf(labels, DEFAULT_LABEL_TEMPLATE).length`.
  - `it('không có máy in hoá đơn: receipt là no-printer, vẫn gửi Job')`.
  - `it('không có máy in tem thì không cảnh báo')`: `printWarningOf` trả `null`.
  - `it('printAsync reject: failed, không reject ra ngoài')`.
  - `it('có logo thì tải sẵn trước khi in')`: `Image.prefetch` gọi với `logoUri` trước `printAsync`; prefetch lỗi
    vẫn in.
- [ ] **Step 2:** `npx jest src/features/cart` → FAIL.
- [ ] **Step 3:** Viết `printOrderAsync`: tính `no-printer` theo `getPrinters().some((p) => p.config.kind ===
  kind)`; renderer hoá đơn `() => <ReceiptTemplate content={receipt} />`, tem
  `pages.map((page) => () => <LabelTemplate content={labels} page={page} />)`; bọc try/catch như cũ. Sửa hook và
  panel: bỏ `usePrintImageCapture`, `captureNode`, tham số `captureImage`.
- [ ] **Step 4:** `npx jest src/features/cart` → PASS; tsc, eslint sạch.
- [ ] **Step 5:** Commit `feat: print orders through the printer package`.

### Task 7: App — snackbar lỗi in theo sự kiện package

**Files:**
- Modify: `src/features/printer/components/PrintFailureSnackbar.tsx`
- Test: `src/features/printer/components/__tests__/PrintFailureSnackbar.test.tsx`

**Interfaces:**
- Consumes: `printService.subscribe(listener: PrintEventListener): Unsubscribe`, `printerErrorMessageOf` (Task 4).
- Produces: `printFailureNoticeOf(results: SubJobResult[]): string`; `FAILURE_BATCH_WINDOW_MS` giữ 1000.

- [ ] **Step 1: Sửa test** để phát sự kiện `SUB_JOB_FINISHED` qua `printService` giả:
  - `it('Job con FAILED hiện tên máy và câu lỗi')`: `{ printerName: 'Quầy', outcome: FAILED, errorCode:
    CONNECTION_TIMEOUT }` → chứa `Quầy` và `printerErrorMessageOf('CONNECTION_TIMEOUT')`.
  - `it('UNCERTAIN cũng báo')`.
  - `it('PRINTER_NOT_ASSIGNED không hiện snackbar')`.
  - Giữ test gộp lỗi trong `FAILURE_BATCH_WINDOW_MS` và test lỗi đến khi đang hiện.
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Đổi nguồn từ `printQueue.onTaskFinished` sang `printService.subscribe`, lọc `SUB_JOB_FINISHED` có
  `outcome !== PRINTED` và `errorCode !== PRINTER_NOT_ASSIGNED`; bỏ prop `queue`, thêm prop
  `service = printService` để test.
- [ ] **Step 4:** Chạy → PASS; tsc, eslint sạch.
- [ ] **Step 5:** Commit `feat: print failure snackbar listens to package print events`.

### Task 8: App — danh sách máy in và trạng thái

**Files:**
- Modify: `src/features/printer/hooks/usePrinterList.ts`, `components/PrinterList.tsx`, `PrinterListItem.tsx`,
  `PrinterStatusBadge.tsx`, `PrinterManagementPanel.tsx`
- Create: `src/features/printer/components/UsbRebindDialog.tsx`
- Test: `hooks/__tests__/usePrinterList.test.tsx`, `components/__tests__/PrinterListItem.test.tsx`

**Interfaces:**
- Consumes: `printerManager.getPrinters`, `subscribe`, `removeAsync`, `reconnectAsync`, `listUsbDevicesForRebind`,
  `rebindUsbAsync`; kiểu `Printer`, `PrinterStatus`, `ConnectionState`, `PrinterAction`.
- Produces:
  - `usePrinterList(): UsePrinterList` với `printers: Printer[]`, `removeAsync(printerId)`, `reconnectAsync(printerId)`,
    `listUsbDevicesForRebind(printerId): UsbRebindCandidate[]`, `rebindUsbAsync(printerId, path)`.
  - `PrinterStatusBadge` nhận `status: PrinterStatus`.
  - `PrinterListItem` nhận `printer: Printer` (kiểu package); bỏ công tắc bật/tắt, nút kết nối, nút ngắt.

- [ ] **Step 1: Viết lại test** với `printerManager` giả:
  - `it('nhận danh sách mới qua subscribe')`.
  - `it('nút Kết nối lại chỉ hiện khi actions có Reconnect')`.
  - `it('nút Chọn lại máy USB chỉ hiện khi actions có RebindUsb, chọn máy gọi rebindUsbAsync')`.
  - `it('badge: ERROR hiện câu lỗi của errorCode')`.
  - `it('không còn công tắc bật/tắt')`.
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Viết hook theo `getPrinters` + `subscribe` (state cập nhật khi danh sách đổi); badge có bốn trạng thái
  (`CONNECTING`, `CONNECTED`, `DISCONNECTED`, `ERROR`) kèm `printerErrorMessageOf(errorCode)`; nút theo
  `status.actions`; `UsbRebindDialog` liệt kê `UsbRebindCandidate`, máy đã thuộc Printer khác hiện tên Printer đó.
- [ ] **Step 4:** Chạy → PASS; tsc, eslint sạch.
- [ ] **Step 5:** Commit `feat: printer list and status from the printer package`.

### Task 9: App — thêm máy: tìm và kết nối

**Files:**
- Create: `src/features/printer/hooks/addPrinter/usePrinterSetupSession.ts`
- Modify: `components/ConnectionSection.tsx`, `DiscoveredDeviceList.tsx`, `StatusPanel.tsx`,
  `hooks/useAddPrinterFlow.ts`
- Test: `hooks/__tests__/usePrinterSetupSession.test.tsx`

**Interfaces:**
- Consumes: `printerSetup.start`, `listUsbDevices`, `listBluetoothDevicesAsync`, `checkLanAddress`, `connectAsync`,
  `cancelAsync`, `subscribe`; kiểu `DeviceCandidate`, `Printer`, `TransportType`, `PrinterLang`.
- Produces: `usePrinterSetupSession(kind: PrinterKind)` trả:
  - `transport: TransportType`, `setTransport(value)`;
  - `candidates: DeviceCandidate[]`, `refreshAsync(): Promise<void>` (USB đọc ngay, Bluetooth xin quyền);
  - `checkLan(host: string, port: number): LanCandidate | FieldError[]`;
  - `connectAsync(candidate): Promise<void>`, `draft?: Printer` (bản nháp `connectAsync` trả về),
    `connectionState: 'idle' | 'connecting' | 'connected' | 'error'`, `errorMessage?: string`;
  - `lang?: PrinterLang` (`draft.config.lang` khi dò được, rỗng thì chờ người dùng chọn), `setLang(lang)`;
  - `cancelAsync(): Promise<void>` (gọi khi đóng modal).
  - Bỏ `useConnectionSetup`, `usePrinterDetection`.

- [ ] **Step 1: Viết test** với `printerSetup` giả:
  - `it('đổi transport sang Bluetooth thì xin quyền rồi liệt kê máy đã ghép đôi')`.
  - `it('ứng viên trùng hiện duplicate, connectAsync báo PRINTER_ALREADY_EXISTS thành error')`.
  - `it('kết nối xong giữ bản nháp; lang lấy từ draft.config, rỗng thì chờ người dùng chọn')`.
  - `it('LAN sai IP trả fieldErrors host')`.
  - `it('đóng modal gọi cancelAsync')`.
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Viết hook; component đổi `DeviceInfo` → `DeviceCandidate` (`displayName`, `duplicate`),
  `ConnectionType` → `TransportType`; giữ gợi ý IP Wi-Fi (`getCurrentWifiIp`) ở `ConnectionSection`.
- [ ] **Step 4:** Chạy → PASS; tsc, eslint sạch.
- [ ] **Step 5:** Commit `feat: add-printer discovery and connect through printerSetup`.

### Task 10: App — cấu hình, in thử, lưu, sửa máy

**Files:**
- Modify: `hooks/useAddPrinterFlow.ts`, `hooks/addPrinter/useTestPrint.ts`, `components/PaperSection.tsx`,
  `PrinterInfoCard.tsx`, `TestPrintPanel.tsx`, `AddPrinterForm.tsx`, `AddPrinterModal.tsx`,
  `forms/addPrinter/PaperFormSchema.ts`, `PrinterDisplaySchema.ts`, `LanConnectionSchema.ts`
- Delete: `forms/addPrinter/PrinterSchema.ts`, `printerRules.ts`
- Create: `src/features/printer/forms/addPrinter/FieldErrorMapping.ts`
- Test: `hooks/__tests__/useAddPrinterFlow.test.tsx`, `forms/addPrinter/__tests__/*`

**Interfaces:**
- Consumes: `usePrinterSetupSession` (Task 9, `draft`); `printer.withConfig(update)`, `printerSetup.saveAsync(draft)`,
  `printerManager.updateAsync(printer)`, `updateLanAddressAsync(printerId, host, port)`,
  `printService.testPrintAsync(printer, renderers)` (package, Task 2); `RECEIPT_PAPER_WIDTHS_MM`,
  `LABEL_SIZE_PRESETS_MM`, `PrinterDpi`, `CutMode`; `SampleReceipt`, `SampleLabel` (Task 5).
- Produces:
  - Form giấy theo kiểu package: hoá đơn `paperWidthMm`, `cutMode`, `feedLines`; tem `labelWidthMm`, `labelHeightMm`,
    `labelsPerRow`, `columnGapMm`, `rowGapMm`; khả năng `hasCutter`, `dpi`. Bỏ loại giấy, `cutterMode`,
    `cashDrawer`, `color`, `image`, `enabled`.
  - `configUpdateOf(values: PrinterFormValues): PrinterConfigUpdate` đổi giá trị form sang bản cập nhật của package.
  - `applyFieldErrors(fieldErrors: FieldError[], setError: UseFormSetError<…>): void` gắn `paper.paperWidthMm`… vào
    ô tương ứng; dùng cho lỗi ném từ `withConfig` (đồng bộ) và reject của `saveAsync`, `updateAsync`.
  - `useAddPrinterFlow({ visible, kind, initialPrinter?: Printer, onSaved })`: thêm mới dùng `printerSetup`, sửa dùng
    `printerManager`.

- [ ] **Step 1: Viết lại test**:
  - `it('thêm máy: lưu gọi saveAsync với draft.withConfig(cấu hình form)')`.
  - `it('sửa máy: lưu gọi updateAsync với saved.withConfig(cấu hình form)')`.
  - `it('sửa máy LAN đổi IP: gọi updateLanAddressAsync, rồi updateAsync nếu cấu hình in cũng đổi')`.
  - `it('fieldErrors của package gắn vào đúng trường')`: `withConfig` ném
    `{ code: 'INPUT_INVALID', fieldErrors: [{ field: 'paper.paperWidthMm', reason: 'OUT_OF_RANGE' }] }` → ô khổ giấy
    có lỗi, giá trị đã nhập còn nguyên.
  - `it('in thử máy đang thêm truyền SampleReceipt')`, `it('in thử tem truyền SampleLabel đủ số hàng')`.
  - `it('in thử máy đã lưu dùng saved.withConfig(cấu hình đang chỉnh), không lưu')`.
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Viết lại form và hook. Gốc là `draft` (máy đang thêm) hoặc `initialPrinter` (máy đã lưu); in thử và
  lưu đều qua `base.withConfig(configUpdateOf(values))`, bắt `INPUT_INVALID` để `applyFieldErrors`. Số hàng tem in thử:
  `Array.from({ length: rows }, () => renderer)`.
- [ ] **Step 4:** Chạy → PASS; tsc, eslint sạch.
- [ ] **Step 5:** Commit `feat: printer configuration, test print and save through the printer package`.

### Task 11: App — gỡ phần máy in cũ

**Files:**
- Delete (JS): `src/features/printer/adapters/`, `connection/`, `detection/`, `discovery/DeviceDiscoveryService.ts`,
  `permissions/`, `printing/`, `storage/`, `languages/`, `rendering/`, `store/`, `logging/`, `exceptions/`, mã lỗi cũ
  trong `errors/` (giữ `PrinterErrorMessages.ts`), `hooks/usePrintImageCapture.tsx`, `hooks/useConnectionStatus.ts`,
  `utils/` không còn dùng, `models/` trừ `models/templates/`, test của các phần trên.
- Delete (native): `android/app/src/main/java/com/ndtcorepos/bridge/`, `common/`, `device/`;
  `android/app/src/test/java/com/ndtcorepos/`.
- Modify: `android/app/src/main/java/com/ndtcorepos/MainApplication.kt` (bỏ `NdtCorePosPackage`),
  `src/store/index.ts` (bỏ `printerReducer`), `package.json` (bỏ `upng-js` nếu không còn ai import),
  `webpack.config.js` (bỏ alias của thư viện cũ), `src/features/printer/ARCHITECTURE.md`, `CODING_STYLE.md`
  (ví dụ tên cũ).

- [ ] **Step 1:** Xoá; `grep -rn "features/printer/\(adapters\|connection\|printing\|storage\)" src` → không còn kết
  quả.
- [ ] **Step 2:** `npx tsc --noEmit`, `npx eslint src`, `npx jest` → toàn bộ PASS.
- [ ] **Step 3:** `npm run build:web` và `./gradlew :app:assembleDebug -PreactNativeArchitectures=x86_64` → thành công.
- [ ] **Step 4:** Viết lại `ARCHITECTURE.md` của feature: UI và mẫu ở App, mọi việc với máy in qua package, sơ đồ luồng
  thêm máy và in đơn.
- [ ] **Step 5:** Commit code `refactor: remove app printer core replaced by the printer package`, commit docs
  `docs: printer feature architecture on top of the package`.

### Task 12: Kiểm đầu cuối trên máy ảo

Không có test tự động; ghi kết quả vào `docs/superpowers/plans/2026-11-10-printer-package-migration-results.md`.

- [ ] **Step 1:** Chạy máy in LAN giả (cổng 9100):
  `node ../NDTCore.Package/NDTCore.Package.Printer.Native/example/scripts/fake-lan-printer.js`;
  máy ảo `Small_Tablet`, `adb reverse tcp:8081 tcp:8081`, `npm run android`.
- [ ] **Step 2:** Thêm máy hoá đơn LAN `10.0.2.2:9100` → kết nối, dò ra ESC/POS, in thử có đường bao, lưu; danh sách
  hiện `Đã kết nối`.
- [ ] **Step 3:** Thanh toán một đơn có tem → máy giả nhận dữ liệu hoá đơn (log số byte); không có máy tem → không cảnh
  báo; xoá máy hoá đơn rồi thanh toán → cảnh báo "Chưa thiết lập máy in cho Hoá đơn".
- [ ] **Step 4:** Tắt máy giả giữa lúc in → snackbar báo lỗi kết nối; bật lại → "Kết nối lại" đưa máy về `Đã kết nối`.
- [ ] **Step 5:** Sửa máy: đổi khổ 58 mm, in thử theo cấu hình đang chỉnh, huỷ → cấu hình đã lưu không đổi.
- [ ] **Step 6:** `npm run web` → mở màn máy in và thanh toán không crash; thêm máy báo không hỗ trợ.
- [ ] **Step 7:** Commit `docs: printer package migration emulator results`.
