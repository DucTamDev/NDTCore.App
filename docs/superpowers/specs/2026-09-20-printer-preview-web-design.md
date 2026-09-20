# Printer Preview Web — Design Spec

## Mục tiêu

Một trang web độc lập trong monorepo, cho phép viết template `printer-core`
(qua Builder DSL đã có: `labelTemplate()`/`receiptTemplate()`/`column()`/
`text()`/`repeat()`/...), nhập dữ liệu `PrintData`, và xem preview SVG trực
quan trước khi in thật — không cần máy in vật lý, không cần build app
React Native để thử template.

## Ngoài phạm vi

- Không phải công cụ kéo-thả (WYSIWYG) — người dùng viết code TypeScript
  trực tiếp, không có UI form-based để dựng cây node.
- Không lưu trữ template (không có database, không có "save"/"share") —
  mọi thứ chỉ tồn tại trong session trình duyệt hiện tại.
- Không cấu hình `TypographyProfile`/`FontMetrics` qua UI — dùng giá trị
  mặc định hợp lý có sẵn trong code.
- Không phải một phần của `NDTCore.FE` (Vue) — là 1 workspace package
  riêng biệt, chỉ phục vụ phát triển/kiểm thử `packages/printer-core`.

## Kiến trúc

```
packages/printer-preview/          (workspace package mới)
├── package.json                   (Vite + React, phụ thuộc "printer-core": "*")
├── vite.config.ts
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx                    (layout 3 vùng: code / data / preview+lỗi)
│   ├── evaluateTemplate.ts        (transpile + chạy code người dùng)
│   ├── CodeEditor.tsx             (Monaco, TypeScript)
│   ├── DataEditor.tsx             (Monaco, JSON)
│   ├── PreviewPanel.tsx           (render SVG string(s), chọn ngôn ngữ)
│   ├── ErrorPanel.tsx             (transpile/runtime/resolve error)
│   └── defaultSample.ts           (code + data mẫu load sẵn lúc mở trang)
└── __tests__/
    └── evaluateTemplate.test.ts
```

## Luồng dữ liệu

```
Code TS (Monaco)  ──┐
                    │  evaluateTemplate(code): PrintTemplate | EvaluateError
Data JSON (Monaco)──┤
                    ▼
              JSON.parse(data): PrintData | ParseError
                    │
                    ▼  (cả hai OK)
       createDocumentResolver().resolve(template, data)
                    │
                    ▼
          readonly ResolvedPage[]   (mỗi phần tử: {status:'ok', node} | {status:'error', ...})
                    │
        ┌───────────┴────────────┐
        ▼ (status: 'ok')          ▼ (status: 'error')
createLayoutEngine().resolve(...)   hiện lỗi trong ErrorPanel cho đúng trang đó
        │
        ▼
   PrintElement[]
        │
        ▼  ghép với template.config
   ResolvedPrintDocument
        │
        ▼  previewFor(language, document)   (language chọn từ dropdown)
      SVG string
        │
        ▼
PreviewPanel hiện SVG — nhiều trang thì hiện tuần tự nhiều SVG
```

## `evaluateTemplate.ts` — chạy code người dùng an toàn trong mức tool nội bộ

```ts
import * as ts from 'typescript';
import * as PrinterCoreTemplate from 'printer-core';

export type EvaluateResult =
  | { readonly status: 'ok'; readonly template: PrintTemplate }
  | { readonly status: 'error'; readonly stage: 'transpile' | 'runtime'; readonly message: string };

export function evaluateTemplate(code: string): EvaluateResult {
  let js: string;
  try {
    js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  } catch (error) {
    return { status: 'error', stage: 'transpile', message: String(error) };
  }

  try {
    const module = { exports: {} as { default?: unknown } };
    const fn = new Function('module', 'exports', 'require', js);
    fn(module, module.exports, (name: string) => {
      if (name === 'printer-core') return PrinterCoreTemplate;
      throw new Error(`Cannot require "${name}" — only "printer-core" is available in the preview sandbox.`);
    });
    const template = module.exports.default;
    if (!template || typeof template !== 'object' || !('root' in template)) {
      return { status: 'error', stage: 'runtime', message: 'Code phải export default 1 PrintTemplate (labelTemplate()/receiptTemplate()...build()).' };
    }
    return { status: 'ok', template: template as PrintTemplate };
  } catch (error) {
    return { status: 'error', stage: 'runtime', message: error instanceof Error ? error.message : String(error) };
  }
}
```

Người dùng viết code theo quy ước `export default`, ví dụ:

```ts
export default labelTemplate()
  .size({ widthDots: 400, heightDots: 240, dpi: 203 })
  .root(column().children(text.binding('product.name').fontSize(24)))
  .build();
```

`typescript.transpileModule()` giữ nguyên cú pháp `export default` khi biên
dịch sang CommonJS (`module.exports.default = ...`), nên convention này hoạt
động tự nhiên không cần code người dùng viết `module.exports` thủ công. Các
hàm DSL (`labelTemplate`, `column`, `text`,...) được đưa vào scope thực thi
qua chính `js` string — vì `transpileModule` không tự động resolve import
`from 'printer-core'` thành biến cục bộ, code người dùng cần viết
`const { labelTemplate, column, text, ... } = require('printer-core');`
ở đầu file (hoặc `import { ... } from 'printer-core'`, mà `transpileModule`
với `module: CommonJS` sẽ biên dịch thành `require('printer-core')` — khớp
đúng với `require` mock đã cung cấp ở trên).

**Về an toàn**: đây không phải sandbox bảo mật thật (code chạy bằng
`new Function` có quyền truy cập toàn bộ global scope của trang, kể cả
`fetch`/`document`/v.v.) — chấp nhận được vì đây là **tool nội bộ, chạy
local, cho chính người phát triển dùng để test template của họ**, không
phải chạy code không tin cậy từ người lạ.

## Panel ngôn ngữ preview

Dropdown 9 giá trị (`tsc`/`zpl`/`epl`/`cpcl`/`dpl`/`sbpl`/`escpos`/
`starprnt`/`ipl`), mặc định `escpos` nếu `template.type === 'receipt'`,
`tsc` nếu `template.type === 'label'` — đoán hợp lý theo loại template,
người dùng đổi được bất cứ lúc nào.

## Xử lý lỗi — 3 tầng, hiển thị riêng biệt trong `ErrorPanel`

1. **Transpile/runtime error** (code TS sai cú pháp, hoặc chạy lỗi, hoặc
   không export default đúng `PrintTemplate`) — chặn hoàn toàn, không có
   preview nào hiện ra, thông báo rõ giai đoạn lỗi.
2. **JSON parse error** (data nhập sai cú pháp JSON) — tương tự, chặn
   toàn bộ.
3. **Lỗi resolve theo từng trang** (`ResolvedPage.status === 'error'`) —
   **không chặn các trang khác**: trang lỗi hiện thông báo lỗi ngay tại vị
   trí của nó trong `PreviewPanel` (thay vì SVG), các trang `status:'ok'`
   khác vẫn hiện preview bình thường — đúng nguyên tắc cách ly lỗi theo
   trang đã có sẵn trong `DocumentResolver`.

## Mẫu mặc định lúc mở trang

`defaultSample.ts` xuất sẵn 1 code mẫu (label đơn giản: tên sản phẩm +
giá + 1 dòng topping lặp) và 1 data mẫu khớp — trang mở lên đã có preview
ngay, không phải màn hình trống.

## Testing

- `evaluateTemplate.test.ts`: test riêng hàm này — code hợp lệ trả về
  đúng `PrintTemplate`; code sai cú pháp TS trả `stage: 'transpile'`; code
  chạy được nhưng không export default trả lỗi runtime rõ ràng; code cố
  `require()` 1 module khác `printer-core` bị chặn với thông báo rõ ràng.
- Không cần test UI component (Monaco/React rendering) ở mức unit —
  đây là tool nội bộ, kiểm tra bằng cách chạy `npm run dev` và thử trực
  tiếp trong trình duyệt.

## Cấu hình mặc định (không có UI)

```ts
const DEFAULT_TYPOGRAPHY: TypographyProfile = {
  fontScaleLevels: [
    { id: 'large', fontScale: 1, lineHeightScale: 1 },
    { id: 'medium', fontScale: 0.75, lineHeightScale: 0.85 },
    { id: 'small', fontScale: 0.5, lineHeightScale: 0.7 },
  ],
};
const fontMetrics = new ApproximateFontMetrics();
```

## Tech Stack

- Vite + React + TypeScript
- `@monaco-editor/react` (Monaco editor, TS + JSON mode)
- `typescript` (package, dùng `transpileModule` — chạy được trong browser
  vì đây là pure JS/TS, không cần Node API)
- Phụ thuộc trực tiếp `printer-core` qua `workspace:*` (npm workspaces đã
  có sẵn, khớp `workspaces: ["packages/*"]` ở root `package.json`)
