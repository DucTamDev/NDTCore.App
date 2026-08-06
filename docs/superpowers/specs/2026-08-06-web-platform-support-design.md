# React Native Web Support — Design

> Mục tiêu ngắn hạn: cho phép xem NDTCore.App (React Native) trên trình duyệt để verify UI (đặc biệt Sales shell — xem `docs/superpowers/specs/2026-08-06-sales-shell-navigation-design.md`) khi không có emulator Android sẵn sàng. Không phải sản phẩm cuối cho khách hàng dùng — là công cụ dev/QA nội bộ.
>
> Làm trên branch `feature/pos-sales-screen` (không tách branch riêng, theo quyết định của người dùng).

## 1. Mục tiêu

Thêm khả năng build/chạy NDTCore.App trên browser bằng Webpack + `react-native-web`, song song với Metro (native) hiện có — không đổi bất kỳ hành vi nào trên Android/iOS.

Toàn bộ app (Sales + Settings) phải chạy được trên web. Riêng chức năng máy in vật lý (Bluetooth/USB/LAN) không thể hoạt động thật trên browser (không có Bluetooth classic API, không có raw TCP/USB) — trên web, thao tác kết nối/in báo lỗi "không khả dụng" thay vì crash, thay vì giả vờ hoạt động.

## 2. Bundler & entry point (Webpack)

Thêm devDependencies: `react-native-web`, `webpack`, `webpack-cli`, `webpack-dev-server`, `babel-loader`, `html-webpack-plugin`.

```
webpack.config.js (mới, root)
  resolve.alias: 'react-native$' → 'react-native-web'
  resolve.extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js']
  module.rules: babel-loader dùng lại babel.config.js hiện có (@react-native/babel-preset)
  devServer: historyApiFallback: true (React Navigation cần)
  plugins: HtmlWebpackPlugin trỏ tới web/index.html

web/index.html (mới) — HTML template tối thiểu, <div id="app-root"></div>, viewport meta chuẩn
index.web.tsx (mới, root, cạnh index.js hiện có)
  AppRegistry.registerComponent(appName, () => App)
  AppRegistry.runApplication(appName, { rootTag: document.getElementById('app-root') })
```

`package.json` thêm 2 script:
- `"web": "webpack serve --config webpack.config.js --mode development"`
- `"build:web": "webpack --config webpack.config.js --mode production"`

`metro.config.js`, `index.js`, và toàn bộ pipeline build native (`npm run android`/`npm run ios`) **không thay đổi** — Metro tự bỏ qua file `.web.ts`/`.web.tsx` vì không khớp platform suffix nào nó tìm (`.android.*`, `.ios.*`, `.native.*`, rồi mới tới file trần). Webpack là bundler hoàn toàn tách biệt, chỉ chạy khi gọi `npm run web`/`npm run build:web`.

## 3. Web-safe StorageService

`src/services/StorageService.web.ts` (mới) — cùng interface public (`getItem<T>`, `setItem<T>`, `removeItem`) như bản MMKV hiện tại (`src/services/StorageService.ts`), backend bằng `window.localStorage` thay vì `react-native-mmkv`, cùng logic JSON serialize/deserialize:

```ts
class StorageServiceImpl {
  getItem<T>(key: string): T | null {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  setItem<T>(key: string, value: T): void {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  removeItem(key: string): void {
    window.localStorage.removeItem(key);
  }
}

export const StorageService = new StorageServiceImpl();
```

Webpack tự ưu tiên resolve `StorageService.web.ts` thay vì `StorageService.ts` khi build web (nhờ `resolve.extensions` ở mục 2). Không sửa file gốc `StorageService.ts` hay bất kỳ call site nào — mọi import vẫn `from './StorageService'` hoặc `from '../../../services/StorageService'` như cũ.

## 4. Web-safe printer driver registry

`PrinterService.ts` (`createPrinterService(registry)`) đã hoàn toàn platform-agnostic — chỉ gọi method trên `registry` được truyền vào (`DriverRegistry`), không import native module nào trực tiếp. Vì vậy chỉ cần thay 1 file để toàn bộ tính năng máy in "an toàn" trên web: `DriverRegistry.ts`.

`src/features/printer/services/DriverRegistry.web.ts` (mới) — cùng shape `Record<Protocol, IPrinterDriver>`, cả hai protocol (`escpos`, `tspl`) trỏ vào chung một `WebUnsupportedDriver`:

```ts
class WebUnsupportedDriver implements IPrinterDriver {
  scan(): Unsubscribe {
    return () => {};
  }

  async connect(): Promise<void> {
    throw new AppErrorException({
      code: 'UNSUPPORTED_CONNECTION',
      message: 'Chức năng máy in không khả dụng trên trình duyệt web',
    });
  }

  async disconnect(): Promise<void> {
    // no-op — không có kết nối thật để ngắt trên web
  }

  getStatus(): PrinterStatus {
    return 'error';
  }

  onStatusChange(): Unsubscribe {
    return () => {};
  }

  async testPrint(): Promise<void> {
    throw new AppErrorException({
      code: 'UNSUPPORTED_CONNECTION',
      message: 'Chức năng máy in không khả dụng trên trình duyệt web',
    });
  }

  async identify(): Promise<null> {
    return null;
  }
}

const webUnsupportedDriver = new WebUnsupportedDriver();

export const DriverRegistry: Record<Protocol, IPrinterDriver> = {
  escpos: webUnsupportedDriver,
  tspl: webUnsupportedDriver,
};
```

File này không import `react-native-bluetooth-classic`, `react-native-esc-pos-printer`, `react-native-tcp-socket`, hay `react-native-nitro-modules` — khi build web, Webpack không bao giờ chạm các package native-only này qua đường `DriverRegistry`, nên không cần alias/stub riêng cho chúng.

`PrinterService = createPrinterService(DriverRegistry)` ở cuối `PrinterService.ts` tự dùng bản `.web.ts` khi build web qua cùng cơ chế resolve ở mục 2 — không sửa dòng nào trong `PrinterService.ts`.

UI (màn Settings/printer) khi gọi `connect`/`testPrint` trên web nhận `AppErrorException` như lỗi kết nối bình thường, xử lý qua đường lỗi đã có sẵn — không crash.

## 5. Rủi ro đã biết trước (không giả định — kiểm chứng khi build thật)

`react-native-reanimated`, `react-native-worklets`, `react-native-screens`, `@react-native-vector-icons/material-design-icons` không được import trực tiếp ở đâu trong `src/` (chỉ là dependency gián tiếp của `react-native-paper`/`@react-navigation/*`). Không có cách xác nhận trước liệu chúng tương thích 100% với `react-native-web` hay không — chỉ biết được khi Webpack build thật và báo lỗi resolve module cụ thể (nếu có).

Plan thực thi phải có một task riêng "chạy `npm run web` lần đầu, sửa lỗi build phát sinh" thay vì giả định mọi thứ chạy được ngay từ file cấu hình lý thuyết.

## 6. Testing

Theo convention hiện có của project: file logic thuần có test riêng, file cấu hình/scaffolding thì verify bằng chạy thật.

- `StorageService.web.ts` → `StorageService.web.test.ts` (mirror `StorageService.test.ts`: round-trip get/set/remove, chạy trong môi trường jest hiện tại vì `window.localStorage`/jsdom cần polyfill — xác nhận cách chạy test này khi vào task cụ thể).
- `DriverRegistry.web.ts` → `DriverRegistry.web.test.ts` — verify mỗi method của `WebUnsupportedDriver` trả về đúng hành vi "unavailable" nhất quán (connect/testPrint reject với `UNSUPPORTED_CONNECTION`, getStatus trả `'error'`, scan/onStatusChange trả unsubscribe no-op, identify trả `null`).
- `webpack.config.js`, `web/index.html`, `index.web.tsx` — không có test tự động, verify bằng chạy `npm run web` thật.

## 7. Manual verify (thay thế Task 6 của Sales shell đang bị block do thiếu emulator)

Sau khi `npm run web` chạy được:

- Mở browser, xác nhận `SalesScreen` render đúng — resize cửa sổ trình duyệt để giả lập tablet-landscape / tablet-portrait / phone thay vì cần emulator thật.
- Chuyển tab "Cài đặt", xác nhận màn Settings/Printer render bình thường, và các thao tác kết nối/test in báo lỗi "không khả dụng trên trình duyệt web" thay vì crash trắng màn hình.

## 8. Ngoài phạm vi

- Không làm cho chức năng in vật lý hoạt động thật trên web (không khả thi — browser không có Bluetooth classic API, raw TCP socket, hay USB serial theo cách các driver hiện tại cần).
- Không build/deploy production cho web (chỉ phục vụ dev/QA nội bộ ở giai đoạn này).
- Không đổi bất kỳ hành vi nào trên Android/iOS.
