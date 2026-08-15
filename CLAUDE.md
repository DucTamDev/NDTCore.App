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

---

## Architecture

### Tech Stack

React Native CLI + TypeScript (strict). UI: **React Native Paper** (Material Design 3). Form: **React Hook Form + Zod**. State: **Redux Toolkit**. Navigation: **React Navigation** (bottom-tabs, `@react-navigation/bottom-tabs`) — 2 tab: Sales, Settings. Storage: **react-native-mmkv**. Async server state: **@tanstack/react-query** (provider đã wire ở `App.tsx`, chưa có domain nào dùng).

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
│   └── settings/        # Settings shell — sidebar + content theo LayoutMode/activeMenuKey (Redux)
├── hooks/                # Hook dùng chung nhiều feature (vd: useLayoutMode — phone/tablet-portrait/tablet-landscape)
├── navigation/           # RootNavigator (bottom-tabs), 2 tab: Sales (initial route), Settings
├── services/             # StorageService (MMKV wrapper), LoggerService
├── store/                 # Redux store gốc — gộp reducer từ mỗi feature module
├── theme/                 # React Native Paper theme
├── types/                 # AppError dùng chung toàn app
└── utils/
```

Mỗi feature module tự đóng gói theo layer con khi cần: `components/`, `services/`, `store/`, `types/`, `schemas/`, `hooks/`. Không tạo layer rỗng — `settings` chỉ có `components/`, `screens/`, `store/` vì chưa cần các layer khác.

### Printer Module (`src/features/printer/`)

Kiến trúc theo hướng driver, UI **không bao giờ** gọi thẳng SDK/native module — luôn qua `PrinterService`:

```text
UI component → PrinterService (facade) → DriverRegistry[protocol] → IPrinterDriver impl → Transport → native SDK
```

- **`types/driver.types.ts`** — `IPrinterDriver`: `scan`, `connect`, `disconnect`, `getStatus`, `onStatusChange`, `testPrint`, `print`, `identify`. Mọi driver mới phải implement đủ interface này.
- **`drivers/`** — `ThermalReceiptDriver` (ESC/POS qua `@poriyaalar/react-native-thermal-receipt-printer` — thư viện export 3 namespace kết nối độc lập USB/BLE/Net thay vì 1 class dùng chung), `TsplDriver` (TSPL qua `LanTransport`/`BluetoothTransport`/`UsbTransport`, dùng `react-native-bluetooth-classic` + `react-native-tcp-socket`). TSPL qua USB **chưa hỗ trợ**.
- **`services/DriverRegistry.ts`** — `Record<Protocol, IPrinterDriver>`, khởi tạo 1 lần.
- **`services/PrinterService.ts`** — facade duy nhất UI được gọi. Tách biệt các thao tác trên máy in đã lưu (storage-backed: `connect`, `disconnect`, `getStatus`...) và thao tác trên draft chưa lưu (`connectDraft`, `disconnectForProtocol`, `getStatusForProtocol` — dùng trong lúc modal "Thêm máy in" đang chạy, trước khi có `printerId` trong storage).
- **`services/discoverProtocol.ts`** — orchestration tự nhận diện protocol: tra `PRINTER_DETECTION_RULES` (`constants/printerDetectionRules.ts`) ra danh sách **candidate** protocol theo độ ưu tiên → thử `connect()` + `identify()` thật từng candidate → emit `DiscoveryEvent` (`connecting`/`identifying`/`identified`/`unknown_protocol`/`error`). **Rule table không bao giờ tự quyết định protocol cuối cùng** — chỉ `identify()` thật từ driver mới xác nhận.
- **`components/AddPrinterModal.tsx`** — modal cuộn 1 màn hình (không phải wizard nhiều bước). Xem chi tiết state machine ở `docs/superpowers/specs/2026-08-01-printer-modal-single-screen-design.md`.
- **`hooks/usePrinterConnection.ts`** — subscribe `PrinterService.onStatusChange` vào Redux, dùng trong danh sách máy in đã lưu.

---

## Key Conventions

- Toàn bộ text hiển thị cho người dùng: **tiếng Việt**
- TypeScript strict, không dùng `any`
- UI component không bao giờ gọi native module/SDK máy in trực tiếp — luôn qua `PrinterService`
- Trạng thái kết nối máy in là **event-driven** (`onStatusChange`/`DiscoveryEvent`) — không polling
- **Disable, không Hide** — component điều kiện theo trạng thái (chưa kết nối, đang xử lý...) dùng prop `disabled`, không unmount/remount (`{condition && <X/>}` là anti-pattern trong các form nhiều bước phụ thuộc trạng thái)
- Component UI thuần trình bày (`src/components/*`, các subcomponent nhỏ trong `features/*/components/`) **không có test file riêng** — verify qua `type-check` + `lint` + test thủ công trên thiết bị. Chỉ file logic (services, drivers, schemas, reducers, transports) mới có `.test.ts`
- Không thêm feature/abstraction/error-handling vượt quá yêu cầu — xem `usePrinterConnection.ts` làm ví dụ: 1 hook, 1 trách nhiệm

---

## Docs

- Specs: `docs/superpowers/specs/YYYY-MM-DD-<topic>.md`
- Plans: `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`

Dùng skill chain `superpowers:brainstorming` → `superpowers:writing-plans` → `superpowers:subagent-driven-development` → `superpowers:finishing-a-development-branch` cho feature/refactor có quy mô — không bắt buộc cho việc nhỏ, mang tính máy móc (thêm 1 prop, sửa 1 dòng...).
