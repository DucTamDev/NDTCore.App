# Printer Module — Đề xuất cấu trúc lại (rà .ts, chuẩn prod)

> **Trạng thái:** đề xuất để review. Chưa có plan, chưa thực thi.
> Phạm vi: `src/features/printer/` (~6.1k dòng non-test, ~5.9k dòng test).
>
> **Nguyên tắc chỉ đạo (chốt với user 2026-08-31):**
> - **KHÔNG** áp layer DDD (`domain/` `application/` `infrastructure/` `ui/`).
>   Giữ nguyên taxonomy feature-module hiện có (`adapters/` `drivers/`
>   `services/` `hooks/` `components/` `types/` `schemas/` `store/` …) —
>   đúng convention trong `CLAUDE.md` ("tự đóng gói theo layer con khi cần").
> - Được phép **thêm folder / thêm file / đổi tên** khi nó làm tách bạch
>   trách nhiệm rõ hơn — miễn là folder mới vẫn nói lên "cái gì" chứ không
>   phải "tầng kiến trúc nào".

## 0. Kết luận ngắn

Module **không phải mớ hỗn độn** — taxonomy đã tốt (`adapters/` ports-and-adapters, `drivers/` + `strategies/` strategy pattern, `transports/` gọn, test colocate trong `__tests__/` nhất quán). Vấn đề gom vào **2 god-file** và **vài chỗ đặt sai folder**:

| # | Vấn đề | Mức | Đề xuất |
|---|--------|-----|---------|
| 1 | `hooks/useAddPrinterFlow.ts` — **581 dòng**, 21 `useState`, ~30 hàm, 6 concern trong 1 hook | 🔴 Cao | Tách 4 hook con vào `hooks/addPrinter/`, giữ coordinator |
| 2 | `printing/PrinterService.ts` — **402 dòng**, 5 concern (CRUD / connection / scan / config-mutation / 1 hàm print) trong 1 facade | 🔴 Cao | Tách 4 service theo trách nhiệm, chuyển sang `services/` |
| 3 | `printing/PrinterService.ts` cạnh `printing/PrintService.ts` — 2 tên gần trùng, việc khác hẳn, cùng folder | 🟠 Vừa | Tách #2 làm biến mất — `printing/` chỉ còn pipeline in |
| 4 | `utils/` là catch-all — rule nghiệp vụ (`cutter`, `mediaValidation`, `paperSize`, `driverConfig`) lẫn helper thuần (`cp1258`, `pngToMonochrome`, `formatRow`) | 🟡 Thấp | `media/` cho rule media; `driverConfig` → `drivers/` |
| 5 | `types/PrinterError.ts` lệch quy ước (`PascalCase`, không `.types`) so với 5 file `*.types.ts` còn lại | ⚪ Rất thấp | Cố ý (có code runtime) — ghi chú, không đổi (churn 49 file) |
| 6 | `components/PrinterInfoCard.tsx` — 230 dòng, 4 sub-section | 🟡 Thấp | Tách 2 sub-component còn lại (đã tách `DriverMediaSection`) |
| 7 | `config/` — 1 file, 1 hằng (`CONNECT_TIMEOUT_MS`) | ⚪ Rất thấp | Gộp vào `constants.ts` ở gốc module, xoá `config/` |

---

## 1. Cấu trúc hiện tại (đánh giá từng folder)

```text
printer/
├── adapters/          ✅ TỐT — IPrinterAdapter + native/library/vendor/testing. Ports & adapters.
│   └── native/utils/  ✅ EPToolkit / buffer-helper — encoder ESC/POS vendored, đúng chỗ.
├── components/        🟡 OK — 11 file, lớn nhất PrinterInfoCard (230). Không có god-component.
├── config/           ⚪ 1 hằng số → thừa 1 folder.
├── definitions/      ✅ TỐT — PRINTER_DRIVER_DEFINITIONS (capability tĩnh theo driver type).
├── discovery/        ✅ TỐT — PrinterDiscoveryService + PrinterResolver (orchestration nhận diện protocol).
├── drivers/          ✅ TỐT — escpos / tspl / tspl/strategies. Strategy pattern sạch.
├── hooks/            🔴 useAddPrinterFlow 581 dòng. usePrinterList / usePrinterConnection / useBillImageCapture OK.
├── printing/         🟠 Trộn 2 việc: (a) PrinterService (facade 402d — CRUD/connection/scan/config)
│                        (b) PrintService + PrintScheduler + PrintRoutingService (pipeline in thật)
│                        + DriverRegistry + PrinterConnectionLock.
├── schemas/          ✅ TỐT — printerFormSchema (Zod, safety net service layer).
├── services/         🟡 NetworkInfoService / PrinterLogger / PrinterPermissionService — đúng "service cắt ngang".
│                        Nhưng "PrinterService" thật lại nằm ở printing/.
├── storage/          ✅ TỐT — PrinterStorage (MMKV wrapper + version reset).
├── store/            ✅ TỐT — printerSlice (Redux cache).
├── testing/          ✅ printerFixtures (factory dùng chung test).
├── types/            🟡 5 file *.types.ts + 1 PrinterError.ts (có code runtime → cố ý lệch).
└── utils/            🟡 Catch-all: rule nghiệp vụ + helper thuần trộn lẫn.
```

---

## 2. Cấu trúc đích đề xuất (không layer DDD)

Chỉ **di chuyển và tách**, không dựng tầng. Mỗi folder vẫn trả lời "chứa cái gì".

```text
printer/
├── adapters/          ✅ giữ nguyên
├── components/        ✅ giữ — tách nốt sub-component của PrinterInfoCard (§6)
├── constants.ts       ⬅ MỚI (gốc module) — CONNECT_TIMEOUT_MS + hằng lẻ khác; xoá config/
├── definitions/       ✅ giữ
├── discovery/         ✅ giữ
├── drivers/
│   ├── escpos/        ✅ giữ
│   ├── tspl/          ✅ giữ
│   ├── DriverRegistry.ts   ⬅ CHUYỂN từ printing/ — registry map protocol→driver thuộc về drivers/
│   └── driverConfig.ts     ⬅ CHUYỂN từ utils/ — accessor đọc PrinterDriver.config + DEFAULT_TSPL_INTERNAL_FONT
│
├── hooks/
│   ├── useAddPrinterFlow.ts     ✅ GIỮ Ở ĐÂY (coordinator ~120d) — import path ngoài không đổi
│   ├── addPrinter/              ⬅ MỚI — 4 hook con của flow thêm máy in (§3)
│   │   ├── useConnectionSetup.ts
│   │   ├── useProtocolDiscovery.ts
│   │   ├── useDriverConfig.ts
│   │   ├── useTestPrint.ts
│   │   └── __tests__/
│   ├── usePrinterList.ts        ✅ giữ
│   ├── usePrinterConnection.ts  ✅ giữ
│   └── useBillImageCapture.tsx  ✅ giữ
│
├── media/            ⬅ MỚI — rule/hình học của PrintMedia (không phụ thuộc React/native)
│   ├── cutter.ts           (từ utils/) resolveEffectiveCutterMode
│   ├── validation.ts       (từ utils/mediaValidation.ts) dieCutRowOverflow / dieCutMediaError
│   ├── paperSpec.ts        (từ utils/paperSize.ts) PAPER_SIZE_SPECS / DOTS_PER_MM
│   └── __tests__/
│
├── printing/         🟢 SAU KHI TÁCH chỉ còn pipeline in thật — tên khớp nội dung
│   ├── PrintService.ts
│   ├── PrintScheduler.ts
│   ├── PrintRoutingService.ts
│   └── __tests__/
│
├── services/         🟢 nơi ở mới của "PrinterService" (đã tách làm 4) + service cắt ngang cũ
│   ├── PrinterRepository.ts        ⬅ (từ PrinterService) CRUD + identity dedup + schema.parse
│   ├── PrinterConnectionService.ts ⬅ (từ PrinterService) connect/disconnect/reconnect/status/draft
│   ├── PrinterConfigService.ts     ⬅ (từ PrinterService) installTsplFont / setTspl* / setDriverMedia
│   ├── DeviceScanService.ts        ⬅ (từ PrinterService) scanDevices / scanForConnectionType / discoverDriver
│   ├── PrinterConnectionLock.ts    ⬅ CHUYỂN từ printing/ — mutex đi cùng PrinterConnectionService
│   ├── NetworkInfoService.ts       ✅ giữ
│   ├── PrinterLogger.ts            ✅ giữ
│   ├── PrinterPermissionService.ts ✅ giữ
│   └── __tests__/
│
├── schemas/          ✅ giữ
├── storage/          ✅ giữ
├── store/            ✅ giữ
├── testing/          ✅ giữ
├── transports/       ✅ giữ
├── types/            ✅ giữ (xem §5 — chỉ ghi chú, không đổi)
└── utils/            🟢 chỉ còn helper THUẦN: cp1258 / monochromeBitmap / pngToMonochrome / formatRow / sampleDocuments
```

**Không có** `domain/` `application/` `infrastructure/` `ui/`. Folder mới (`media/`, `hooks/addPrinter/`, `constants.ts`) đều là "nhóm file cùng chủ đề", không phải "tầng".

---

## 3. Tách `useAddPrinterFlow.ts` (581 → coordinator + 4 hook)

Hiện 1 hook làm: (a) chọn loại kết nối + thiết bị + form LAN, (b) discovery + chọn protocol, (c) danh sách driver + content-type + cấu hình media + render mode/font TSPL, (d) in thử, (e) build draft + save. 21 `useState`.

| File | Trách nhiệm | State chính |
|------|-------------|-------------|
| `addPrinter/useConnectionSetup.ts` | loại kết nối, chọn thiết bị, form LAN, `identityKey`, fetch WiFi IP | `connectionType`, `selectedDevice`, `lanForm`, `detectedLanIp` |
| `addPrinter/useProtocolDiscovery.ts` | `startDiscovery`, `onChooseProtocol`, `connectionState`/`protocolState`, `deviceInfo` | `connectionState`, `protocolState`, `lastProtocol` |
| `addPrinter/useDriverConfig.ts` | `onToggleContentType`, `onChangeDriverMedia`, `onSelectTsplRenderMode`, `onChangeTsplInternalFont`, `installTsplFont` | `drivers`, `tsplFontPending` |
| `addPrinter/useTestPrint.ts` | `runTestPrint`, `testPrintRowsText`, pending/error | `testPrint*Pending`, `testPrintRowsText`, `testPrintErrorMessage` |
| `useAddPrinterFlow.ts` (coordinator, giữ nguyên vị trí) | ghép 4 hook trên + `buildDraftPrinter` + `onSave` + `liveStatus` + cleanup connection lúc unmount | `saveErrorMessage`, `savedRef`, `connectionRef` |

`drivers` state là chỗ chồng lấn (discovery khởi tạo, config sửa) → **coordinator sở hữu**, truyền xuống `useDriverConfig` + `useProtocolDiscovery` qua tham số. Mỗi hook con test độc lập trong `addPrinter/__tests__/`; `useAddPrinterFlow.test.tsx` hiện tại giữ vai trò integration test của coordinator.

**Import path ngoài (`components/AddPrinterForm.tsx`) không đổi** — vẫn `from '../hooks/useAddPrinterFlow'`.

**Rủi ro:** trung bình. Hook nội bộ 1 màn hình, không ảnh hưởng API module.

---

## 4. Tách `PrinterService.ts` (402 → 4 service trong `services/`)

`PrinterService` là "facade tất-cả-trong-một". Tách theo trách nhiệm, đặt vào `services/` (đúng ngữ nghĩa folder đó):

```ts
// services/PrinterRepository.ts        — nguồn: PrinterStorage. CRUD + identity dedup + schema.parse.
getPrinters / savePrinters / findOrThrow / addPrinter / updatePrinter / removePrinter / setEnabled

// services/PrinterConnectionService.ts  — nguồn: DriverRegistry + PrinterConnectionLock.
connect / disconnect / reconnect / reconnectAutoPrinters / connectDraft / disconnectForDriver
getStatus / onStatusChange / getStatusForDriver / onStatusChangeForDriver / resourceKeyFor

// services/PrinterConfigService.ts      — mutate driver config của printer đã lưu.
installTsplFont / setTsplRenderMode / setTsplInternalFont / setDriverMedia
// (3 setter đang gần như trùng cấu trúc — DRY thành 1 helper updateDriverInPrinter() ở đây)

// services/DeviceScanService.ts
scanDevices / scanForConnectionType / discoverDriver
```

Hàm `print(printerId, documents, printType)` hiện nằm trong `PrinterService` → chuyển hẳn về `printing/PrintService.ts` (nó đã sở hữu routing + scheduler). `testPrint(...)` đi theo `DeviceScanService`/`PrinterConnectionService` (nó chạy trên driver+adapter trực tiếp, không qua storage).

**Call site:** `PrinterService.` xuất hiện ở ~8 file (`useAddPrinterFlow`, `usePrinterList`, `usePrinterConnection`, `DeviceScanList`, `ApplicationSidebar`, + tests). Mỗi nơi đổi sang import service cụ thể. Thuần mechanical. **Không** dựng barrel `services/index.ts` (repo tránh barrel) — import trực tiếp file.

**Rủi ro:** trung bình — nhiều import nhưng mechanical; test của `PrinterService.test.ts` tách theo 4 file.

---

## 5. `types/` — chỉ ghi chú, KHÔNG đổi

Hiện: `printer.types.ts`, `driver.types.ts`, `printConfiguration.types.ts`, `printDocument.types.ts`, `printJob.types.ts`, `PrinterError.ts`.

`PrinterError.ts` lệch quy ước **có chủ đích**: nó chứa `enum PrinterErrorCode` + class/factory lỗi (code **runtime**, không phải pure type), nên không mang suffix `.types` và dùng `PascalCase` như file class khác trong repo.

Đổi tên cho "đồng phục" sẽ đụng **49 file** import — churn cao, giá trị gần như 0. **Đề xuất: để nguyên**, thêm 1 dòng comment đầu file giải thích vì sao khác. Nếu sau này có đợt đụng lớn `types/` thì gộp luôn.

---

## 6. Tách `PrinterInfoCard.tsx` (230)

Đã tách `DriverMediaSection`. Còn:
- `DriverRenderModeSection` — selector chế độ TSPL + toggle font TrueType + internalfont (codepage/fontName)
- `TestPrintPanel` — 2 nút in thử + ô số hàng

`PrinterInfoCard` còn lại ~80 dòng: tên hiển thị + info thiết bị + auto-reconnect + map `drivers` → `DriverMediaSection` + `DriverRenderModeSection` + `TestPrintPanel` + nút Lưu.

**Rủi ro:** thấp (component UI thuần, không có test file — theo convention).

---

## 7. Lộ trình đề xuất

| Gói | Nội dung | Effort | Rủi ro | Ghi chú |
|-----|----------|--------|--------|---------|
| **A — 2 god-file** | §3 (tách hook) + §4 (tách PrinterService) + §6 | 1 SP vừa (~4 task) | Trung | Xử lý toàn bộ SRP violation thực sự. Không đụng `utils/`. |
| **B — dọn folder** | §2 phần còn lại: `media/`, `DriverRegistry`→`drivers/`, `driverConfig`→`drivers/`, `constants.ts` + xoá `config/` | +1–2 task | Thấp–Trung (~14 file đổi import path) | Thuần di chuyển, mechanical. |
| **A + B** | Cả hai | 1 SP vừa–lớn (~6 task) | Trung | **Khuyến nghị.** Kết thúc trong 1 branch, review 1 lần. |

Bỏ hẳn khỏi phạm vi (so với bản trước): layer `domain/application/infrastructure/ui`, rename hàng loạt `types/`, gộp folder `adapters/transports/storage`.

**Khuyến nghị: gói `A + B`** — làm gọn 1 nhịp, giữ nguyên taxonomy, không churn 60-file. Nếu muốn nhỏ hơn nữa thì chỉ **A** (2 god-file là phần đau thật sự), để **B** cho đợt sau.

Nếu chốt, mình viết spec chi tiết + plan.
