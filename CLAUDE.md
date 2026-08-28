# NDTCore.App

React Native CLI (0.86, New Architecture) — app POS di động, chạy trên máy in nhiệt/tem qua USB, Bluetooth, LAN. Repo Git độc lập (tách ra từ monorepo `NDTCore`).

---

## Commands

```bash
npm start           # Metro bundler
npm run android      # Build + install + launch trên emulator/thiết bị Android
npm run ios          # Build + install + launch trên iOS
npm run type-check    # tsc --noEmit
npm run lint          # eslint .
npm test              # jest
npm run verify         # type-check + lint + test — chạy trước khi commit
```

Node: `>= 22.11.0`. Không có path alias (`@/...`) — toàn bộ import dùng relative path.

**Android build môi trường (Windows):** nếu `gradlew.bat`/`adb` báo "not recognized", kiểm tra trước khi thử lại nhiều lần:
- `$env:JAVA_HOME` phải trỏ tới thư mục thật sự tồn tại (ưu tiên JBR đi kèm Android Studio: `C:\Program Files\Android\Android Studio\jbr`, không phải JDK cài rời có thể đã gỡ)
- `$env:ANDROID_HOME\platform-tools` và `...\emulator` phải có trong `PATH`
- Nếu `NoDefaultCurrentDirectoryInExePath=1` (registry/env user-level), gọi `.\gradlew.bat` chứ không gọi `gradlew.bat` trần

**Chạy `adb` khi PowerShell báo "not recognized":**
```powershell
# Tạm thời — chỉ áp dụng cho cửa sổ PowerShell đang mở
$env:Path = "$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:Path"

# Cố định — set 1 lần, cần mở cửa sổ terminal mới để có hiệu lực
[System.Environment]::SetEnvironmentVariable("Path", "$env:LOCALAPPDATA\Android\Sdk\platform-tools;" + [System.Environment]::GetEnvironmentVariable("Path","User"), "User")
```
Kiểm tra thiết bị đã kết nối chưa: `adb devices` (trạng thái phải là `device`, không phải trống/`unauthorized`/`offline`).

Sau khi có `adb` trong `PATH`, nếu app bị màn hình đỏ do mất kết nối Metro: `adb reverse tcp:8081 tcp:8081` rồi chạy `npm start` (hoặc `npm run start:reverse` gộp cả 2 bước), sau đó reload app trên thiết bị.

---

## Architecture

### Tech Stack

React Native CLI + TypeScript (strict). UI: **React Native Paper** (Material Design 3). Form: **React Hook Form + Zod**. State: **Redux Toolkit**. Navigation: **React Navigation** (bottom-tabs, `@react-navigation/bottom-tabs`) — 2 tab: Sales, Application. Storage: **react-native-mmkv**. Async server state: **@tanstack/react-query** (provider đã wire ở `App.tsx`, chưa có domain nào dùng).

### Source Structure

```text
src/
├── components/         # UI dùng chung, không gắn business logic (AppInput, AppSelect,
│                        # AppSwitch, AppButton — đều có prop `disabled`; ConfirmDialog,
│                        # EmptyState, LoadingOverlay, StatusDot)
├── features/
│   ├── printer/         # Xem "Printer Module" bên dưới
│   ├── sales/           # Sales screen shell — hooks/, components/, screens/. Static,
│   │                    # responsive, chưa có product/cart data — xem
│   │                    # docs/superpowers/specs/2026-08-06-sales-shell-navigation-design.md
│   └── application/     # Application shell (tab "Ứng dụng") — sidebar + content theo
│                        # LayoutMode/activeMenuKey (Redux)
├── hooks/                # Hook dùng chung nhiều feature (vd: useLayoutMode — phone/tablet-portrait/tablet-landscape)
├── navigation/           # RootNavigator (bottom-tabs), 2 tab: Sales (initial route), Application
├── services/             # StorageService (MMKV wrapper), LoggerService
├── store/                 # Redux store gốc — gộp reducer từ mỗi feature module
├── theme/                 # React Native Paper theme
├── types/                 # ApiResponse dùng chung toàn app (AppError chuyển vào features/printer/types/ — chỉ printer dùng)
└── utils/
```

Mỗi feature module tự đóng gói theo layer con khi cần: `components/`, `services/`, `store/`, `types/`, `schemas/`, `hooks/`. Không tạo layer rỗng — `application` chỉ có `components/`, `screens/`, `store/` vì chưa cần các layer khác.

**2 kiểu feature module:**
- **Feature sở hữu data** (`auth`, `cart`, `catalog`, `store`, `printer`) — có `store/` slice và/hoặc `services/` riêng, giữ state dùng ở nhiều màn hình.
- **Feature shell/ghép** (`sales`, `application`) — không có `store/`/`services/`/`types/` riêng, đúng chủ đích: ghép screen/hook của các feature sở hữu data lại thành 1 màn hình. Riêng `application` có 1 slice Redux nhỏ cho state UI của chính nó (`activeMenuKey` — mục sidebar đang chọn).

### Printer Module (`src/features/printer/`)

Xem [`src/features/printer/ARCHITECTURE.md`](src/features/printer/ARCHITECTURE.md) để hiểu chi tiết toàn bộ layer, flow (discovery, in thật, in thử), resource key/identity key, và các giới hạn đã biết. Tóm tắt nhanh:

Kiến trúc theo hướng driver, UI **không bao giờ** gọi thẳng SDK/native module — luôn qua `PrinterService`:

```text
UI component → PrinterService (facade) → DriverRegistry[protocol] → IPrinterDriver impl → Transport → native SDK
```

- **`types/driver.types.ts`** — `IPrinterDriver`: `scan`, `connect`, `disconnect`, `getStatus`, `onStatusChange`, `testPrint`, `print`, `identify`. Mọi driver mới phải implement đủ interface này.
- **`drivers/`** — `ThermalReceiptDriver` (ESC/POS qua `@poriyaalar/react-native-thermal-receipt-printer` — thư viện export 3 namespace kết nối độc lập USB/BLE/Net thay vì 1 class dùng chung), `TsplDriver` (TSPL qua `LanTransport`/`BluetoothTransport`/`UsbTransport`, dùng `react-native-bluetooth-classic` + `react-native-tcp-socket`). `UsbTransport` của TSPL gọi thẳng native module `RNUSBPrinter.printRawData` (byte thô, không qua tầng JS `printText` của package) — xem `services/UsbPrinterNative.ts`. Native module này là singleton dùng chung giữa `ThermalReceiptDriver` và `TsplDriver` nên **không thể** kết nối 1 máy in ESC/POS và 1 máy in TSPL qua USB đồng thời (kết nối sau ngắt kết nối trước). Qua USB, `identify()` của **cả 2 driver** luôn trả `null` (native module không đọc được phản hồi — chỉ có bulk-OUT endpoint) — `device_name` từ USB descriptor không phải bằng chứng protocol thật, máy in tem cắm USB cũng có tên y hệt máy in hoá đơn. Nghĩa là `discoverProtocol()` **không bao giờ tự xác nhận được protocol qua USB** trừ khi rule table match đúng model với chỉ 1 candidate — mọi máy in USB không có rule riêng đều rơi vào `unknown_protocol`, bắt buộc chọn "Printer Language" thủ công khi thêm máy.
- **`services/DriverRegistry.ts`** — `Record<Protocol, IPrinterDriver>`, khởi tạo 1 lần.
- **`services/PrinterService.ts`** — facade duy nhất UI được gọi. Tách biệt các thao tác trên máy in đã lưu (storage-backed: `connect`, `disconnect`, `getStatus`...) và thao tác trên draft chưa lưu (`connectDraft`, `disconnectForProtocol`, `getStatusForProtocol` — dùng trong lúc modal "Thêm máy in" đang chạy, trước khi có `printerId` trong storage).
- **`services/discoverProtocol.ts`** — orchestration tự nhận diện protocol: thử lần lượt `CANDIDATE_ORDER` cố định (`['tspl', 'escpos']`) — `connect()` + `identify()` thật từng candidate → emit `DiscoveryEvent` (`connecting`/`identifying`/`identified`/`unknown_protocol`/`error`). Không còn rule table theo vendor/model — chỉ `identify()` thật từ driver mới xác nhận protocol.
- **`components/AddPrinterModal.tsx`** — modal cuộn 1 màn hình (không phải wizard nhiều bước). Xem chi tiết state machine ở `docs/superpowers/specs/2026-08-01-printer-modal-single-screen-design.md`.
- **`hooks/usePrinterConnection.ts`** — subscribe `PrinterService.onStatusChange` vào Redux, dùng trong danh sách máy in đã lưu.

---

## Key Conventions

- Toàn bộ text hiển thị cho người dùng: **tiếng Việt**
- TypeScript strict, không dùng `any`
- UI component không bao giờ gọi native module/SDK máy in trực tiếp — luôn qua `PrinterService`
- Trạng thái kết nối máy in là **event-driven** (`onStatusChange`/`DiscoveryEvent`) — không polling
- **Disable, không Hide** — component điều kiện theo trạng thái (chưa kết nối, đang xử lý...) dùng prop `disabled`, không unmount/remount (`{condition && <X/>}` là anti-pattern trong các form nhiều bước phụ thuộc trạng thái)
- Component UI thuần trình bày (`src/components/*`, các subcomponent nhỏ trong `features/*/components/`) **không có test file riêng** — verify qua `type-check` + `lint` + test thủ công trên thiết bị. Chỉ file logic (services, drivers, schemas, reducers, transports) mới có `.test.ts`, đặt trong thư mục con `__tests__/` cùng cấp với file logic nó test (vd `services/__tests__/XService.test.ts`) — không nằm chung thư mục với file logic. Jest tự nhận diện `__tests__/` mặc định, không cần cấu hình thêm.
- Không thêm feature/abstraction/error-handling vượt quá yêu cầu — xem `usePrinterConnection.ts` làm ví dụ: 1 hook, 1 trách nhiệm

---

## Docs

- Specs: `docs/superpowers/specs/YYYY-MM-DD-<topic>.md`
- Plans: `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`

Dùng skill chain `superpowers:brainstorming` → `superpowers:writing-plans` → `superpowers:subagent-driven-development` → `superpowers:finishing-a-development-branch` cho feature/refactor có quy mô — không bắt buộc cho việc nhỏ, mang tính máy móc (thêm 1 prop, sửa 1 dòng...).
