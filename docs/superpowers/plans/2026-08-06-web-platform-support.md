# React Native Web Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép chạy NDTCore.App trên trình duyệt (`npm run web`) bằng Webpack + `react-native-web`, làm công cụ dev/QA để xem UI (đặc biệt Sales shell) khi không có emulator Android — không đổi hành vi native.

**Architecture:** Webpack là bundler thứ hai, hoàn toàn tách biệt Metro (native). Hai file platform-specific (`StorageService.web.ts`, `DriverRegistry.web.ts`) thay thế bản MMKV/native-printer bằng bản browser-safe, tự động được Webpack resolve ưu tiên hơn bản `.ts` trần — không sửa file gốc hay call site nào.

**Tech Stack:** `react-native-web`, Webpack 5, `html-webpack-plugin`, `babel-loader` (dùng lại `@react-native/babel-preset` hiện có), `jest-environment-jsdom` (chỉ cho 1 test file cần `window`).

## Global Constraints

- TypeScript strict, không dùng `any`.
- Không có path alias — mọi import dùng relative path.
- Toàn bộ text hiển thị cho người dùng: tiếng Việt.
- File logic thuần (hook, service, driver) có test riêng. File cấu hình/scaffolding (webpack config, HTML template, entry point) không có test tự động — verify bằng chạy thật.
- Không đổi hành vi hay file build native (`metro.config.js`, `index.js`, `npm run android`/`ios`) — Metro tự bỏ qua file `.web.ts`/`.web.tsx`.
- Chức năng in vật lý không cần hoạt động thật trên web — chỉ cần báo lỗi "không khả dụng" thay vì crash.
- Chạy `npm run verify` (type-check + lint + test) trước mỗi commit khi task đó có file được `tsc`/`eslint`/`jest` quét tới.
- Ngoài phạm vi: build/deploy production cho web, làm chức năng in vật lý hoạt động thật trên browser.

---

### Task 1: Web-safe StorageService

**Files:**
- Create: `src/services/StorageService.web.ts`
- Create: `src/services/StorageService.web.test.ts`
- Modify: `tsconfig.json` (thêm `"dom"` vào `compilerOptions.lib`)
- Modify: `package.json` (thêm devDependency `jest-environment-jsdom`)

**Interfaces:**
- Consumes: không phụ thuộc task trước.
- Produces: `StorageService` với cùng public API bản native (`src/services/StorageService.ts`): `getItem<T>(key: string): T | null`, `setItem<T>(key: string, value: T): void`, `removeItem(key: string): void`. Webpack tự resolve file này thay vì `StorageService.ts` khi build web (nhờ `resolve.extensions` ở Task 3) — mọi call site giữ nguyên `import { StorageService } from '.../StorageService'`.

**Vì sao sửa `tsconfig.json`:** base config (`@react-native/typescript-config`) không có `"dom"` trong `lib` (đúng cho môi trường native thuần, không có `window`/`document`). File `.web.ts` này dùng `window.localStorage` nên cần `"dom"`. TypeScript `extends` **thay thế hoàn toàn** mảng `lib` của config cha khi config con khai báo lại — nên phải copy đủ mảng `lib` gốc rồi thêm `"dom"`, không phải chỉ thêm `"dom"` một mình.

- [ ] **Step 1: Cài `jest-environment-jsdom`**

Run: `npm install -D jest-environment-jsdom`

- [ ] **Step 2: Sửa `tsconfig.json`**

```json
{
  "extends": "@react-native/typescript-config",
  "compilerOptions": {
    "types": ["jest"],
    "lib": [
      "es2019",
      "es2020.bigint",
      "es2020.date",
      "es2020.number",
      "es2020.promise",
      "es2020.string",
      "es2020.symbol.wellknown",
      "es2021.promise",
      "es2021.string",
      "es2021.weakref",
      "es2022.array",
      "es2022.object",
      "es2022.string",
      "dom"
    ]
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["**/node_modules", "**/Pods"]
}
```

- [ ] **Step 3: Viết test cho `StorageService.web.ts` (thất bại trước vì file chưa tồn tại)**

```ts
// src/services/StorageService.web.test.ts
/**
 * @jest-environment jsdom
 */
import { StorageService } from './StorageService.web';

describe('StorageService (web)', () => {
  const key = 'test.key';

  afterEach(() => {
    StorageService.removeItem(key);
  });

  it('returns null when key is missing', () => {
    expect(StorageService.getItem(key)).toBeNull();
  });

  it('round-trips an object through setItem/getItem', () => {
    const value = { a: 1, b: 'two' };
    StorageService.setItem(key, value);
    expect(StorageService.getItem(key)).toEqual(value);
  });

  it('removeItem clears the key', () => {
    StorageService.setItem(key, { a: 1 });
    StorageService.removeItem(key);
    expect(StorageService.getItem(key)).toBeNull();
  });

  it('persists through window.localStorage directly', () => {
    StorageService.setItem(key, 'raw-value');
    expect(window.localStorage.getItem(key)).toBe(JSON.stringify('raw-value'));
  });
});
```

- [ ] **Step 4: Chạy test, xác nhận FAIL**

Run: `npx jest StorageService.web.test.ts`
Expected: FAIL — Cannot find module `./StorageService.web`.

- [ ] **Step 5: Viết implementation**

```ts
// src/services/StorageService.web.ts
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

- [ ] **Step 6: Chạy test, xác nhận PASS**

Run: `npx jest StorageService.web.test.ts`
Expected: PASS — 4 test đều xanh.

- [ ] **Step 7: Verify toàn bộ không vỡ gì**

Run: `npm run type-check`
Expected: 0 lỗi (bao gồm cả `StorageService.web.ts` dùng `window` hợp lệ nhờ `"dom"` mới thêm).

Run: `npm test`
Expected: toàn bộ suite hiện có + `StorageService.web.test.ts` đều PASS.

- [ ] **Step 8: Commit**

```bash
git add tsconfig.json package.json package-lock.json src/services/StorageService.web.ts src/services/StorageService.web.test.ts
git commit -m "feat: add web-safe StorageService backed by localStorage"
```

---

### Task 2: Web-safe printer driver registry

**Files:**
- Create: `src/features/printer/services/DriverRegistry.web.ts`
- Create: `src/features/printer/services/DriverRegistry.web.test.ts`

**Interfaces:**
- Consumes: `IPrinterDriver`, `Unsubscribe` (`src/features/printer/types/driver.types.ts`), `Protocol`, `PrinterStatus` (`src/features/printer/types/printer.types.ts`), `AppErrorException` (`src/types/AppError.ts`).
- Produces: `DriverRegistry: Record<Protocol, IPrinterDriver>` — Webpack resolve file này thay vì `DriverRegistry.ts` khi build web. `PrinterService.ts` (`export const PrinterService = createPrinterService(DriverRegistry);`) không cần sửa gì — nó chỉ gọi method trên registry được truyền vào.

Không cần sửa `jest.config.js`/`tsconfig.json` — file này không dùng `window`/`document`, chạy được trong môi trường jest mặc định (`node`).

- [ ] **Step 1: Viết test cho `DriverRegistry.web.ts` (thất bại trước vì file chưa tồn tại)**

```ts
// src/features/printer/services/DriverRegistry.web.test.ts
import { DriverRegistry } from './DriverRegistry.web';
import type { PrinterConfig } from '../types/printer.types';

const tsplConfig: PrinterConfig = {
  id: 'p1',
  printerName: 'Test TSPL',
  protocol: 'tspl',
  protocolSource: 'manual',
  connectionType: 'lan',
  paperSize: '58mm',
  autoReconnect: false,
  isDefault: false,
};

const escposConfig: PrinterConfig = {
  id: 'p2',
  printerName: 'Test ESC/POS',
  protocol: 'escpos',
  protocolSource: 'manual',
  connectionType: 'usb',
  paperSize: '80mm',
  autoReconnect: false,
  isDefault: false,
};

describe('DriverRegistry (web)', () => {
  it('registers both protocols', () => {
    expect(DriverRegistry.escpos).toBeDefined();
    expect(DriverRegistry.tspl).toBeDefined();
  });

  it('scan returns a no-op unsubscribe and never reports a device', () => {
    const onEvent = jest.fn();
    const unsubscribe = DriverRegistry.escpos.scan('usb', onEvent);
    expect(onEvent).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('connect rejects with UNSUPPORTED_CONNECTION', async () => {
    await expect(DriverRegistry.tspl.connect(tsplConfig)).rejects.toMatchObject({
      code: 'UNSUPPORTED_CONNECTION',
    });
  });

  it('testPrint rejects with UNSUPPORTED_CONNECTION', async () => {
    await expect(DriverRegistry.escpos.testPrint(escposConfig)).rejects.toMatchObject({
      code: 'UNSUPPORTED_CONNECTION',
    });
  });

  it('disconnect resolves without throwing', async () => {
    await expect(DriverRegistry.escpos.disconnect('p1')).resolves.toBeUndefined();
  });

  it('getStatus always returns "error"', () => {
    expect(DriverRegistry.escpos.getStatus('p1')).toBe('error');
  });

  it('onStatusChange returns a no-op unsubscribe', () => {
    const callback = jest.fn();
    const unsubscribe = DriverRegistry.tspl.onStatusChange('p1', callback);
    expect(callback).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('identify resolves null', async () => {
    await expect(DriverRegistry.tspl.identify('p1')).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest DriverRegistry.web.test.ts`
Expected: FAIL — Cannot find module `./DriverRegistry.web`.

- [ ] **Step 3: Viết implementation**

```ts
// src/features/printer/services/DriverRegistry.web.ts
import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type { Protocol, PrinterStatus } from '../types/printer.types';
import { AppErrorException } from '../../../types/AppError';

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

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx jest DriverRegistry.web.test.ts`
Expected: PASS — 8 test đều xanh.

- [ ] **Step 5: Verify toàn bộ**

Run: `npm run verify`
Expected: type-check + lint + toàn bộ test suite đều sạch.

- [ ] **Step 6: Commit**

```bash
git add src/features/printer/services/DriverRegistry.web.ts src/features/printer/services/DriverRegistry.web.test.ts
git commit -m "feat: add web-safe printer driver registry"
```

---

### Task 3: Webpack bundler & entry point

**Files:**
- Create: `webpack.config.js`
- Create: `web/index.html`
- Create: `index.web.tsx`
- Modify: `package.json` (thêm script `web`, `build:web`; thêm devDependencies)

**Interfaces:**
- Consumes: `App` (`./App.tsx`, đã có sẵn, không đổi), `name` từ `app.json` (đã có sẵn). Dùng lại `"dom"` lib đã thêm ở Task 1 (không cần sửa `tsconfig.json` lần nữa).
- Produces: `npm run web` khởi động dev server tại `http://localhost:8081`; `npm run build:web` build production bundle vào `dist-web/`. Không có export code nào cho task khác dùng — đây là entry point cuối.

Không có test tự động cho task này (scaffolding/config) — verify bằng chạy thật ở Task 4.

- [ ] **Step 1: Cài dependencies**

Run: `npm install -D react-native-web webpack webpack-cli webpack-dev-server babel-loader html-webpack-plugin`

- [ ] **Step 2: Tạo `web/index.html`**

```html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <title>NDTCore POS</title>
  </head>
  <body>
    <div id="app-root"></div>
  </body>
</html>
```

- [ ] **Step 3: Tạo `index.web.tsx`**

```tsx
// index.web.tsx
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);

AppRegistry.runApplication(appName, {
  rootTag: document.getElementById('app-root'),
});
```

- [ ] **Step 4: Tạo `webpack.config.js`**

```js
// webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: path.resolve(__dirname, 'index.web.tsx'),
  output: {
    path: path.resolve(__dirname, 'dist-web'),
    filename: 'bundle.js',
  },
  resolve: {
    alias: {
      'react-native$': 'react-native-web',
      // Các module native-thuần cho máy in — DriverRegistry.web.ts (Task 2)
      // không import chúng, nhưng alias sang `false` để Webpack không bao giờ
      // cố resolve chúng nếu có đường import gián tiếp nào khác chạm tới.
      'react-native-bluetooth-classic': false,
      'react-native-esc-pos-printer': false,
      'react-native-tcp-socket': false,
      'react-native-nitro-modules': false,
    },
    extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules\/(?!(react-native|@react-native|@react-navigation)[\w-]*\/)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['module:@react-native/babel-preset'],
          },
        },
      },
      {
        test: /\.ttf$/,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'web/index.html'),
    }),
  ],
  devServer: {
    historyApiFallback: true,
    port: 8081,
  },
};
```

- [ ] **Step 5: Thêm script vào `package.json`**

Thêm 2 dòng vào `"scripts"`:

```json
"web": "webpack serve --config webpack.config.js --mode development",
"build:web": "webpack --config webpack.config.js --mode production"
```

- [ ] **Step 6: Verify type-check và lint (chưa chạy dev server ở bước này)**

Run: `npm run type-check`
Expected: 0 lỗi — `index.web.tsx` dùng `document`/`window` hợp lệ nhờ `"dom"` lib đã thêm ở Task 1.

Run: `npm run lint`
Expected: 0 lỗi — `webpack.config.js` là CommonJS root-level file, cùng dạng với `metro.config.js`/`babel.config.js` đã lint sạch từ trước.

- [ ] **Step 7: Commit**

```bash
git add webpack.config.js web/index.html index.web.tsx package.json package-lock.json
git commit -m "feat: add Webpack bundler and entry point for web build"
```

---

### Task 4: Chạy thử web build đầu tiên và xử lý lỗi phát sinh

**Files:**
- Modify: `webpack.config.js` (nếu cần thêm alias/rule cho lỗi phát sinh)
- Modify hoặc Create: file cấu hình font nếu icon không hiển thị đúng (xem Step 3)

**Interfaces:** không tạo interface mới — task này chỉ làm cho pipeline dựng ở Task 1-3 chạy được thật.

Đây là task duy nhất trong plan không có code chính xác định trước (đúng như rủi ro đã nêu ở spec mục 5) — vì kết quả phụ thuộc lỗi thật từ Webpack/browser mà không thể biết trước khi chạy. Xử lý theo trình tự chẩn đoán dưới đây; nếu gặp lỗi không khớp bất kỳ nhánh nào, dừng lại và báo cáo cụ thể lỗi thay vì tự đoán sửa.

- [ ] **Step 1: Chạy dev server, ghi lại output**

Run: `npm run web`
Ghi lại toàn bộ output terminal. Nếu Webpack build lỗi ngay (không tới bước serve), dừng ở đây và xử lý theo Step 2 trước khi tiếp tục.

- [ ] **Step 2: Nếu có lỗi "Module not found" cho 1 trong 4 package sau — áp dụng alias tương ứng**

Các package rủi ro đã biết trước (spec mục 5): `react-native-reanimated`, `react-native-worklets`, `react-native-screens`, `@react-native-vector-icons/material-design-icons`. Đây là các package **thật sự cần dùng trên web** (không giống 4 package máy in ở Task 3 — không thể alias sang `false`).

Nếu lỗi là "Can't resolve 'react-native-reanimated'" (hoặc `worklets`/`screens`): kiểm tra package đó có export field `"browser"` hoặc `"module"` trong `package.json` của nó (`node_modules/<package>/package.json`) trỏ tới một entry point khác — nếu có, thêm alias trong `webpack.config.js`:

```js
resolve: {
  alias: {
    // ...alias hiện có
    'react-native-reanimated$': 'react-native-reanimated/lib/module/index.web.js', // ví dụ — thay bằng path thật đọc từ package.json
  },
}
```

Đường dẫn chính xác phải đọc từ `package.json` thật của package đó tại thời điểm chạy — không đoán path.

- [ ] **Step 3: Nếu build/serve thành công nhưng icon hiển thị ô vuông trống (tofu) thay vì glyph**

Mở tab Network của DevTools, kiểm tra file `.ttf` của `@react-native-vector-icons/material-design-icons` có tải thành công (status 200) không.

Nếu file `.ttf` tải thành công nhưng icon vẫn không hiển thị: `react-native-web` không tự đăng ký `@font-face` như native linking — cần khai báo thủ công. Tạo `web/fonts.css`:

```css
@font-face {
  font-family: 'MaterialDesignIcons';
  src: url('../node_modules/@react-native-vector-icons/material-design-icons/fonts/MaterialDesignIcons.ttf') format('truetype');
}
```

Import file này trong `index.web.tsx` (thêm dòng `import './web/fonts.css';` ở đầu file) và thêm rule xử lý `.css` vào `webpack.config.js` nếu chưa có (`{ test: /\.css$/, use: ['style-loader', 'css-loader'] }`, cần cài thêm `style-loader` và `css-loader` nếu áp dụng nhánh này: `npm install -D style-loader css-loader`).

Nếu file `.ttf` không tải được (404): kiểm tra lại rule `{ test: /\.ttf$/, type: 'asset/resource' }` ở `webpack.config.js` (Task 3) đã đúng, và đường import icon (`react-native-paper`'s `Icon` component) có tới được module đó không.

- [ ] **Step 4: Xác nhận điều kiện hoàn thành**

Mở `http://localhost:8081` trên trình duyệt. Điều kiện đạt:
- Không có lỗi màu đỏ trong console DevTools.
- Màn "Bán hàng" (SalesScreen) hiển thị đúng bố cục — Top App Bar, vùng sản phẩm trống, Cart Panel.
- Tab dưới cùng chuyển được giữa "Bán hàng" và "Cài đặt".

Nếu sau khi thử Step 2 và Step 3 vẫn còn lỗi không khớp 2 nhánh trên, dừng lại — không tự ý đoán sửa thêm. Ghi lại chính xác thông báo lỗi để báo cáo.

- [ ] **Step 5: Verify không vỡ native**

Run: `npm run verify`
Expected: type-check + lint + test suite (native) vẫn sạch như trước — task này chỉ nên sửa `webpack.config.js`/file cấu hình font, không đụng code native.

- [ ] **Step 6: Commit**

Commit message phải mô tả đúng fix thật đã áp dụng (không dùng message chung chung). Ví dụ nếu không cần sửa gì (mọi thứ chạy được ngay từ Task 3):

```bash
git commit --allow-empty -m "chore: confirm web build runs cleanly with no additional fixes needed"
```

Nếu có sửa `webpack.config.js`/thêm `web/fonts.css`, mô tả đúng nội dung đã sửa, ví dụ:

```bash
git add webpack.config.js web/fonts.css index.web.tsx package.json package-lock.json
git commit -m "fix: register MaterialDesignIcons @font-face for web build"
```

---

### Task 5: Manual verify trên trình duyệt

**Files:** không tạo/sửa file — bước xác nhận thủ công.

- [ ] **Step 1: Kiểm tra Sales screen qua các breakpoint**

Với `npm run web` đang chạy, mở `http://localhost:8081`. Resize cửa sổ trình duyệt:
- Rộng, ngang (≥ 900px, width > height): xác nhận layout 2 cột tỉ lệ ~68/32 (Product Area / Cart Panel).
- Cao, hẹp mô phỏng tablet portrait (≥ 600px chiều nhỏ nhất, height > width): xác nhận layout 2 cột tỉ lệ ~55/45.
- Nhỏ hơn 600px (mô phỏng phone): xác nhận Product Area chiếm toàn màn hình, có thanh tổng tiền cố định đáy, bấm vào mở modal Cart Panel.

- [ ] **Step 2: Kiểm tra điều hướng**

Bấm icon "cog" trên Top App Bar → chuyển sang tab "Cài đặt". Bấm tab "Bán hàng" ở thanh tab dưới cùng → quay lại Sales.

- [ ] **Step 3: Kiểm tra chức năng máy in báo lỗi đúng cách trên web**

Trong màn Cài đặt, thử thao tác thêm/kết nối máy in. Xác nhận: không có màn hình trắng/crash; thao tác kết nối báo lỗi (ví dụ toast hoặc thông báo) với nội dung liên quan "không khả dụng trên web" thay vì treo vô thời hạn hoặc ném lỗi không xử lý ra console.

- [ ] **Step 4: Xác nhận và báo cáo**

Nếu cả 3 bước trên đạt, coi sub-project "React Native Web support" hoàn tất. Đây cũng là cách thay thế Task 6 của plan Sales shell (`docs/superpowers/plans/2026-08-06-sales-shell-navigation.md`) vốn đang bị block do thiếu Android emulator — nếu Step 1 ở đây xác nhận cả 3 breakpoint của Sales shell render đúng, có thể coi phần layout của Task 6 (Sales shell) đã được verify qua đường web, chỉ còn phần kiểm tra riêng cho Android thật (safe-area inset dưới tab bar — không kiểm tra được qua web) là còn treo.
