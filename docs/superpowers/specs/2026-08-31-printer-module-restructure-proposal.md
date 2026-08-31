# Printer Module — Đề xuất cấu trúc lại (rà .ts, chuẩn prod)

> **Trạng thái:** đề xuất để review. Chưa có plan, chưa thực thi.
> Phạm vi: `src/features/printer/` (6.079 dòng non-test, 5.914 dòng test).

## 0. Kết luận ngắn

Module **không phải mớ hỗn độn** — folder taxonomy đã tốt (`adapters/` ports-and-adapters chuẩn sách, `drivers/` + `strategies/` strategy pattern sạch, `transports/` gọn, test colocate nhất quán). Vấn đề tập trung ở **2 god-file** và **vài chỗ đặt sai lớp**:

| # | Vấn đề | Mức | Đề xuất |
|---|--------|-----|---------|
| 1 | `hooks/useAddPrinterFlow.ts` — **581 dòng**, 21 `useState`, ~30 hàm, 6 concern trong 1 hook | 🔴 Cao | Tách 4–5 hook con |
| 2 | `printing/PrinterService.ts` — **402 dòng**, 5 concern (CRUD / connection / scan / print / driver-config) trong 1 facade | 🔴 Cao | Tách theo trách nhiệm + đổi tên |
| 3 | `printing/PrinterService.ts` vs `printing/PrintService.ts` — 2 tên gần trùng, việc khác nhau, cùng folder | 🟠 Vừa | Đổi tên + tách folder |
| 4 | `utils/` là catch-all — domain logic (`driverConfig`, `cutter`, `mediaValidation`) lẫn helper thuần (`cp1258`, `pngToMonochrome`, `formatRow`, `paperSize`) | 🟡 Thấp | Tách `domain/` |
| 5 | Đặt tên file không nhất quán: `printConfiguration.types.ts` vs `PrinterError.ts` vs `printer.types.ts` | 🟡 Thấp | Chuẩn hoá |
| 6 | `components/PrinterInfoCard.tsx` — 230 dòng, 4 sub-section (media / render-mode / internalfont / test-print) | 🟡 Thấp | Tách sub-component (đã tách `DriverMediaSection`) |
| 7 | `config/` — 1 file, 1 hằng (`CONNECT_TIMEOUT_MS`) | ⚪ Rất thấp | Để yên hoặc merge |

---

## 1. Cấu trúc hiện tại (đánh giá từng folder)

```text
printer/
├── adapters/          ✅ TỐT — IPrinterAdapter + native/library/vendor/testing. Ports & adapters chuẩn.
│   └── native/utils/  ✅ EPToolkit / buffer-helper — encoder ESC/POS vendored, đúng chỗ.
├── components/         🟡 OK — 11 file, lớn nhất PrinterInfoCard (230). Không có god-component.
├── config/            ⚪ 1 hằng số. Thừa 1 folder.
├── definitions/       ✅ TỐT — PRINTER_DRIVER_DEFINITIONS (capability tĩnh theo driver type).
├── discovery/         ✅ TỐT — PrinterDiscoveryService (orchestration nhận diện protocol).
├── drivers/           ✅ TỐT — escpos / tspl / tspl/strategies. Strategy pattern sạch.
├── hooks/             🔴 useAddPrinterFlow 581 dòng. usePrinterList / usePrinterConnection / useBillImageCapture OK.
├── printing/          🟠 Trộn: PrinterService (facade 402d, ít khi "in") + PrintService (routing in thật) + PrintScheduler + DriverRegistry + PrinterConnectionLock.
├── schemas/           ✅ TỐT — printerFormSchema (Zod, safety net service layer).
├── services/          🟡 Chỉ có PrinterLogger. `PrinterService` lại nằm ở `printing/`.
├── storage/           ✅ TỐT — PrinterStorage (MMKV wrapper + version reset).
├── store/             ✅ TỐT — printerSlice (Redux cache).
├── testing/           ✅ printerFixtures (factory dùng chung test).
├── types/             🟡 OK sau refactor gần đây, nhưng suffix `.types.ts` không nhất quán.
└── utils/             🟡 Catch-all: domain logic + helper thuần trộn lẫn.
```

---

## 2. Cấu trúc đích đề xuất

Giữ nguyên phần lớn. Layer hoá rõ theo hướng phụ thuộc **UI → application → domain ← infrastructure**:

```text
printer/
├── domain/                         # ⬅ MỚI — logic nghiệp vụ THUẦN, không phụ thuộc React / native / storage
│   ├── driverConfig.ts             #   (từ utils/) mediaOf / paperSizeOf / tsplRenderModeOf / DEFAULT_TSPL_INTERNAL_FONT
│   ├── cutter.ts                   #   (từ utils/) resolveEffectiveCutterMode
│   ├── mediaValidation.ts          #   (từ utils/) dieCutRowOverflow / dieCutMediaError
│   ├── identity.ts                 #   (từ discovery/PrinterResolver) resolveIdentityKey
│   └── driverDefinitions.ts        #   (từ definitions/) PRINTER_DRIVER_DEFINITIONS
│
├── application/                    # ⬅ MỚI — use-case / orchestration (thay 1 phần `printing/`)
│   ├── PrinterRepository.ts        #   (từ PrinterService) CRUD + identity dedup + schema.parse. Nguồn: storage.
│   ├── PrinterConnectionManager.ts #   (từ PrinterService) connect/disconnect/reconnect/status + draft + lock
│   ├── PrinterConfigService.ts     #   (từ PrinterService) installTsplFont / setTsplRenderMode / setTsplInternalFont / setDriverMedia
│   ├── DeviceScanService.ts        #   (từ PrinterService) scanDevices / scanForConnectionType / discoverDriver
│   ├── PrintService.ts             #   (giữ) print(printType, documents) — routing + scheduler
│   ├── PrintScheduler.ts           #   (giữ)
│   ├── PrintRoutingService.ts      #   (giữ)
│   └── PrinterConnectionLock.ts    #   (giữ)
│
├── infrastructure/                 # ⬅ đổi tên từ adapters/ + transports/ + storage/ (tuỳ chọn — xem §4)
│   ├── adapters/                   #   IPrinterAdapter + native/library/vendor
│   ├── transports/                 #   Lan / Bluetooth / Usb transport
│   ├── storage/                    #   PrinterStorage
│   └── native/                     #   PrinterNativeModule + EPToolkit
│
├── drivers/                        # ✅ giữ nguyên (escpos / tspl / strategies) — đây là "domain services" của in
│
├── ui/                             # ⬅ gộp components/ + hooks/
│   ├── components/
│   ├── hooks/
│   │   ├── useAddPrinterFlow/       #   ⬅ tách god-hook thành 1 folder nhiều hook con (xem §3)
│   │   ├── usePrinterList.ts
│   │   ├── usePrinterConnection.ts
│   │   └── useBillImageCapture.tsx
│   └── screens/                    #   (nếu SP-C's AddPrinterForm inline thành screen thật sau này)
│
├── store/                          # ✅ giữ (Redux slice)
├── schemas/                        # ✅ giữ (Zod — biên giới validate)
├── types/                          # ✅ giữ, chuẩn hoá tên (xem §5)
├── testing/                        # ✅ giữ
└── utils/                          # helper THUẦN generic còn lại: cp1258 / monochromeBitmap / pngToMonochrome / formatRow / paperSize / sampleDocuments
```

> **Lưu ý:** `infrastructure/` + `application/` + `domain/` + `ui/` là mức "đầy đủ". Có thể làm **bán phần** (chỉ §3 + §4) — xem §7.

---

## 3. Tách `useAddPrinterFlow.ts` (581 → ~5 hook)

Hiện 1 hook làm: (a) chọn loại kết nối + thiết bị + form LAN, (b) discovery + chọn protocol, (c) danh sách driver + content-type, (d) cấu hình media, (e) render mode + font TSPL, (f) in thử, (g) build draft + save. 21 `useState`.

Tách:

| Hook | Trách nhiệm | State chính |
|------|-------------|-------------|
| `useConnectionSetup` | loại kết nối, chọn thiết bị, form LAN, `identityKey`, fetch WiFi IP | `connectionType`, `selectedDevice`, `lanForm`, `detectedLanIp` |
| `useProtocolDiscovery` | `startDiscovery`, `onChooseProtocol`, `connectionState`/`protocolState`, `deviceInfo` | `connectionState`, `protocolState`, `lastProtocol`, `drivers` (thêm) |
| `useDriverConfig` | `onToggleContentType`, `onChangeDriverMedia`, `onSelectTsplRenderMode`, `onChangeTsplInternalFont`, `installTsplFont` | `drivers`, `tsplFontPending` |
| `useTestPrint` | `runTestPrint`, `testPrintRowsText`, pending/error | `testPrint*Pending`, `testPrintRowsText`, `testPrintErrorMessage` |
| `useAddPrinterFlow` (coordinator) | ghép 4 hook trên + `buildDraftPrinter` + `onSave` + `liveStatus` + cleanup connection | `saveErrorMessage`, `savedRef`, `connectionRef` |

`drivers` state là chỗ chồng lấn (discovery ghi, config sửa) → coordinator sở hữu, truyền xuống. Mỗi hook con testable độc lập.

**Rủi ro:** trung bình. `useAddPrinterFlow.test.tsx` (lớn) sẽ tách theo. Là hook nội bộ 1 màn hình → không ảnh hưởng API ngoài.

---

## 4. Tách `PrinterService.ts` (402 → 4 service) + đổi tên

`PrinterService` hiện là "facade tất-cả-trong-một". Tách theo trách nhiệm:

```ts
// application/PrinterRepository.ts   — nguồn: PrinterStorage. CRUD + identity dedup + schema.parse.
getPrinters / addPrinter / updatePrinter / removePrinter / setEnabled / findOrThrow

// application/PrinterConnectionManager.ts — nguồn: DriverRegistry + PrinterConnectionLock.
connect / disconnect / reconnect / reconnectAutoPrinters / connectDraft / disconnectForDriver
getStatus / onStatusChange / getStatusForDriver / onStatusChangeForDriver

// application/PrinterConfigService.ts — mutate driver config của printer đã lưu.
installTsplFont / setTsplRenderMode / setTsplInternalFont / setDriverMedia

// application/DeviceScanService.ts
scanDevices / scanForConnectionType / discoverDriver
```

Component/hook import service cụ thể thay vì 1 facade 30-method. Nếu muốn giữ 1 điểm vào cho tiện: 1 barrel `application/index.ts` re-export (nhưng repo hiện tránh barrel — cân nhắc).

**Đổi tên bắt buộc:** `PrinterService` ≠ `PrintService`. Đề xuất: các file trên + `PrintService` → `PrintDispatchService` (nó dispatch job in tới nhiều máy). Hoặc gom `PrintService`/`PrintScheduler`/`PrintRoutingService` vào `application/printing/`.

**Rủi ro:** cao về số file đụng (`PrinterService.` xuất hiện ~20 nơi), nhưng thuần mechanical (đổi import + gọi `xService.method`). Là refactor SP riêng.

---

## 5. Chuẩn hoá `types/`

Hiện: `printer.types.ts`, `driver.types.ts`, `printConfiguration.types.ts`, `printDocument.types.ts`, `printJob.types.ts`, `PrinterError.ts`.

Không nhất quán: suffix `.types` (4/6 file), PascalCase `PrinterError.ts` vs camelCase khác.

Chọn 1 quy ước, đề xuất **bỏ suffix `.types`** (folder đã tên `types/`):
```
types/printer.ts  driver.ts  printConfig.ts  printDocument.ts  printJob.ts  error.ts
```
Hoặc theo domain (nếu muốn nhỏ hơn): `printer.ts` (Printer/PrinterDriver), `media.ts` (PrintMedia/PaperSize/CutterMode), `connection.ts` (ConnectionType/PrinterDevice/DeviceScanEvent/PrinterStatus), `tspl.ts` (TsplRenderMode/TsplCodepage/Tspl*Config).

**Rủi ro:** thấp (đổi import path), nhưng đụng ~50 file. Chỉ nên làm cùng đợt lớn.

---

## 6. Tách `PrinterInfoCard.tsx` (230)

Đã tách `DriverMediaSection`. Còn:
- `DriverRenderModeSection` — selector chế độ TSPL + font TrueType toggle + internalfont (codepage/fontName)
- `TestPrintPanel` — 2 nút in thử + ô số hàng

Còn lại `PrinterInfoCard` ~80 dòng: tên hiển thị + info thiết bị + auto-reconnect + map `drivers` → 2 section trên + `TestPrintPanel` + nút Lưu.

**Rủi ro:** thấp (component UI thuần, không test).

---

## 7. Lộ trình đề xuất (chọn 1)

| Gói | Nội dung | Effort | Rủi ro | Giá trị |
|-----|----------|--------|--------|---------|
| **Chỉ #1** | Tách `useAddPrinterFlow` | 1 SP nhỏ | Trung | Cao (file khó nhất) |
| **Chỉ #2** | Tách + đổi tên `PrinterService` | 1 SP nhỏ | Cao (nhiều import) | Cao (facade 402d) |
| **#1 + #2 + #6** | 2 god-file + PrinterInfoCard | 1 SP vừa | Trung–Cao | Cao — xử lý hết SRP violation, KHÔNG đụng folder taxonomy |
| **Full (#1–#6)** | + layer `domain/application/infrastructure/ui` + rename types + move utils | 1 SP lớn (~3–4 task) | Cao | Cao nhưng churn lớn, ~60 file đổi import |

**Khuyến nghị: gói `#1 + #2 + #6`.** Xử lý toàn bộ SRP violation thực sự, giữ nguyên folder taxonomy (vốn đã tốt), tránh churn 60-file của việc rename `types/` + move sang `domain/`. Layer `domain/application/...` là "đẹp về lý thuyết" nhưng lợi ích thực tế thấp cho 1 feature RN 12k dòng — YAGNI.

Nếu chốt, mình viết spec chi tiết + plan cho gói đã chọn.
