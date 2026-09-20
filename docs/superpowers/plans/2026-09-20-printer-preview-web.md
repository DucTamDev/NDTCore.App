# Printer Preview Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Vite+React web app (`packages/printer-preview`) that lets a developer write a `printer-core` template in TypeScript, enter `PrintData` as JSON, and see a live SVG preview across all 9 printer languages, before ever touching a physical printer.

**Architecture:** User code is transpiled in-browser (`typescript.transpileModule`) and executed via `new Function` with a `require` shim exposing only `printer-core`. The resulting `PrintTemplate` flows through the existing `DocumentResolver` → `LayoutEngine` → `previewFor()` pipeline (all already built and tested in `printer-core`) to produce one SVG per resolved page, with per-page error isolation shown inline instead of aborting the whole preview.

**Tech Stack:** Vite, React 19, TypeScript, `@monaco-editor/react`, Vitest (this package's own test runner — separate from the root Jest config, which is React-Native-oriented and unsuitable for a browser package).

**Spec:** `docs/superpowers/specs/2026-09-20-printer-preview-web-design.md`

## Global Constraints

- New package lives at `packages/printer-preview`, matching the root `workspaces: ["packages/*"]` glob — no changes to root `package.json`'s `workspaces` field needed.
- `printer-core` is consumed as a real workspace dependency (`"printer-core": "*"`), never copied or reimplemented.
- The root `tsconfig.json`'s `**/*.ts`/`**/*.tsx` include would otherwise pull this package's browser/Vite-specific code into the React-Native-oriented root type-check — `packages/printer-preview/**` must be excluded there so `npm run type-check`/`npm run verify` at the root keeps working unaffected.
- The `new Function`-based code execution is **not a real security sandbox** (full access to the page's global scope) — acceptable because this is a local developer tool for trusted, self-authored template code, not a multi-tenant or public-facing service. Do not attempt to harden it further; that would be scope creep for this plan.
- Code comments stay short (one line, WHY not WHAT) — matches the project-wide convention already established for `packages/printer-core`.
- No database, no "save template" feature, no template library UI — everything lives only in the current browser session (explicit spec non-goal).

---

### Task 1: Scaffold the package and confirm `printer-core` imports resolve

**Files:**
- Create: `packages/printer-preview/package.json`
- Create: `packages/printer-preview/tsconfig.json`
- Create: `packages/printer-preview/vite.config.ts`
- Create: `packages/printer-preview/index.html`
- Create: `packages/printer-preview/src/main.tsx`
- Create: `packages/printer-preview/src/App.tsx`
- Modify: `tsconfig.json` (root) — add one entry to `exclude`

**Interfaces:**
- Produces: a working Vite dev server and production build for `packages/printer-preview`, proving `printer-core` (a zero-dependency, source-only workspace package) is importable and bundleable from a browser-targeted Vite project before any real UI is built on top.

- [ ] **Step 1: Create the package manifest**

```json
{
  "name": "printer-preview",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "type-check": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "printer-core": "*"
  },
  "devDependencies": {
    "@monaco-editor/react": "^4.6.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.8.3",
    "vite": "^6.0.0",
    "vitest": "^2.1.8"
  }
}
```

Save as `packages/printer-preview/package.json`. `@monaco-editor/react` is listed now (devDependency, bundled into the app at build time like any other UI dependency) even though it's first *used* in Task 4 — declaring it once here avoids a second `npm install` mid-plan.

- [ ] **Step 2: Create this package's own `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

Save as `packages/printer-preview/tsconfig.json`. Deliberately does **not** extend the root `tsconfig.json` (which extends `@react-native/typescript-config` — wrong `jsx` mode and missing `vite/client` types for a browser app).

- [ ] **Step 3: Exclude this package from the root type-check**

Read `tsconfig.json` at the repo root. Its `exclude` array is currently `["**/node_modules", "**/Pods"]`. Change it to:

```json
"exclude": ["**/node_modules", "**/Pods", "packages/printer-preview/**"]
```

Without this, `npm run type-check` / `npm run verify` at the root would try to type-check this package's browser-only code under the React-Native-oriented root config and fail on missing `vite/client` types and JSX mode mismatches.

- [ ] **Step 4: Create the Vite config**

```ts
// packages/printer-preview/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

- [ ] **Step 5: Create the HTML entry point**

```html
<!-- packages/printer-preview/index.html -->
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <title>Printer Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create the React entry point**

```tsx
// packages/printer-preview/src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 7: Create a minimal `App.tsx` that proves `printer-core` resolves**

```tsx
// packages/printer-preview/src/App.tsx
import { PrintTemplateType } from 'printer-core';

export function App() {
  return <div>printer-core loaded — PrintTemplateType.Label = {PrintTemplateType.Label}</div>;
}
```

This is a throwaway placeholder — Task 6 replaces it with the real UI.

- [ ] **Step 8: Install dependencies and verify the build**

Run: `npm install` (from repo root — npm workspaces will link `printer-core` and hoist shared deps).
Run: `npm run build -w printer-preview`
Expected: build succeeds, producing a `dist/` folder inside `packages/printer-preview` with no errors — this is the automatable proof that Vite's bundler correctly resolves and bundles `printer-core`'s TypeScript source through the workspace link.

Also run manually (not automatable, just for your own confirmation): `npm run dev -w printer-preview`, open the printed local URL, confirm the page shows `printer-core loaded — PrintTemplateType.Label = label`.

- [ ] **Step 9: Verify the root type-check still passes**

Run: `npm run type-check` (from repo root)
Expected: passes exactly as it did before this task — the new package is excluded, so this proves Step 3's exclusion is effective.

- [ ] **Step 10: Commit**

```bash
git add packages/printer-preview tsconfig.json
git commit -m "feat: scaffold printer-preview Vite app, verify printer-core import"
```

---

### Task 2: `evaluateTemplate.ts` — transpile and run user code

**Files:**
- Create: `packages/printer-preview/src/evaluateTemplate.ts`
- Test: `packages/printer-preview/src/__tests__/evaluateTemplate.test.ts`
- Modify: `packages/printer-preview/vite.config.ts` — add Vitest's `test` config
- Modify: `packages/printer-preview/tsconfig.json` — add `vitest/globals`... (not needed; this plan uses explicit imports from `vitest`, not globals, so no tsconfig change is required)

**Interfaces:**
- Consumes: `PrintTemplate`, `PrintTemplateType` (from `printer-core`, already built).
- Produces: `EvaluateResult`, `evaluateTemplate(code: string): EvaluateResult` — Task 6's `App.tsx` calls this on every code change.

- [ ] **Step 1: Switch the Vite config to Vitest's `defineConfig` so the `test` field type-checks**

```ts
// packages/printer-preview/vite.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
```

`vitest/config`'s `defineConfig` re-exports Vite's own, with the `test` field typed — using plain `vite`'s `defineConfig` here would make TypeScript reject the `test` key.

- [ ] **Step 2: Write the failing tests**

```ts
// packages/printer-preview/src/__tests__/evaluateTemplate.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateTemplate } from '../evaluateTemplate';

describe('evaluateTemplate', () => {
  it('evaluates valid code into a PrintTemplate', () => {
    const code = `
      import { labelTemplate, column, text } from 'printer-core';
      export default labelTemplate()
        .size({ widthDots: 400, heightDots: 240, dpi: 203 })
        .root(column().children(text.literal('Hello')))
        .build();
    `;
    const result = evaluateTemplate(code);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.template.type).toBe('label');
      expect(result.template.config).toEqual({ widthDots: 400, heightDots: 240, dpi: 203 });
    }
  });

  it('returns a transpile-stage error for invalid TypeScript syntax', () => {
    const code = `export default labelTemplate(`; // unbalanced parens
    const result = evaluateTemplate(code);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.stage).toBe('transpile');
  });

  it('returns a runtime-stage error when the code does not export a valid PrintTemplate', () => {
    const code = `export default { notATemplate: true };`;
    const result = evaluateTemplate(code);
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.stage).toBe('runtime');
      expect(result.message).toContain('PrintTemplate');
    }
  });

  it('returns a runtime-stage error when the code throws', () => {
    const code = `throw new Error('boom');`;
    const result = evaluateTemplate(code);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.message).toContain('boom');
  });

  it('blocks require() of anything other than "printer-core"', () => {
    const code = `const fs = require('fs'); export default fs;`;
    const result = evaluateTemplate(code);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.message).toContain('Cannot require');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test -w printer-preview`
Expected: FAIL — cannot find module `'../evaluateTemplate'`.

- [ ] **Step 4: Write the implementation**

```ts
// packages/printer-preview/src/evaluateTemplate.ts
import * as ts from 'typescript';
import * as PrinterCore from 'printer-core';
import type { PrintTemplate } from 'printer-core';

export type EvaluateResult =
  | { readonly status: 'ok'; readonly template: PrintTemplate }
  | { readonly status: 'error'; readonly stage: 'transpile' | 'runtime'; readonly message: string };

export function evaluateTemplate(code: string): EvaluateResult {
  let js: string;
  try {
    const result = ts.transpileModule(code, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      reportDiagnostics: true,
    });
    if (result.diagnostics && result.diagnostics.length > 0) {
      const message = result.diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n');
      return { status: 'error', stage: 'transpile', message };
    }
    js = result.outputText;
  } catch (error) {
    return { status: 'error', stage: 'transpile', message: error instanceof Error ? error.message : String(error) };
  }

  try {
    const moduleObj: { exports: { default?: unknown } } = { exports: {} };
    const requireShim = (name: string): unknown => {
      if (name === 'printer-core') return PrinterCore;
      throw new Error(`Cannot require "${name}" — only "printer-core" is available here.`);
    };
    const fn = new Function('module', 'exports', 'require', js);
    fn(moduleObj, moduleObj.exports, requireShim);

    const template = moduleObj.exports.default;
    if (!template || typeof template !== 'object' || !('root' in template) || !('config' in template)) {
      return { status: 'error', stage: 'runtime', message: 'Code phải export default 1 PrintTemplate (ví dụ: export default labelTemplate().size(...).root(...).build();).' };
    }
    return { status: 'ok', template: template as PrintTemplate };
  } catch (error) {
    return { status: 'error', stage: 'runtime', message: error instanceof Error ? error.message : String(error) };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -w printer-preview`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/printer-preview/src/evaluateTemplate.ts packages/printer-preview/src/__tests__/evaluateTemplate.test.ts packages/printer-preview/vite.config.ts
git commit -m "feat: add evaluateTemplate to transpile and run user template code"
```

---

### Task 3: `defaultSample.ts` — sample code and data shown on first load

**Files:**
- Create: `packages/printer-preview/src/defaultSample.ts`

**Interfaces:**
- Produces: `defaultCode: string`, `defaultData: string` — Task 6's `App.tsx` seeds initial editor state with these.

- [ ] **Step 1: Write the sample**

```ts
// packages/printer-preview/src/defaultSample.ts
export const defaultCode = `import { labelTemplate, column, text, repeat } from 'printer-core';

export default labelTemplate()
  .size({ widthDots: 400, heightDots: 240, dpi: 203 })
  .root(
    column()
      .padding({ top: 8, right: 8, bottom: 8, left: 8 })
      .gap(4)
      .children(
        text.binding('product.name').fontSize(24).bold(),
        text.binding('product.price'),
        repeat('toppings')
          .maxItemsPerPage(6)
          .template(column().children(text.binding('name'))),
      ),
  )
  .build();
`;

export const defaultData = JSON.stringify(
  {
    product: { name: 'Trà sữa trân châu', price: '45,000đ' },
    toppings: [{ name: 'Trân châu' }, { name: 'Thạch dừa' }],
  },
  null,
  2,
);
```

- [ ] **Step 2: Verify it evaluates cleanly**

This file has no logic to unit-test on its own (it's static data) — its correctness is proven by Task 6's manual verification (the app loads with this sample and shows a working preview with no errors on first render).

- [ ] **Step 3: Commit**

```bash
git add packages/printer-preview/src/defaultSample.ts
git commit -m "feat: add default sample template and data"
```

---

### Task 4: `CodeEditor` and `DataEditor` components

**Files:**
- Create: `packages/printer-preview/src/CodeEditor.tsx`
- Create: `packages/printer-preview/src/DataEditor.tsx`

**Interfaces:**
- Produces: `CodeEditor({ value, onChange })`, `DataEditor({ value, onChange })` — both `(value: string, onChange: (value: string) => void)` — Task 6's `App.tsx` wires these to its own state.

- [ ] **Step 1: Write `CodeEditor`**

```tsx
// packages/printer-preview/src/CodeEditor.tsx
import Editor from '@monaco-editor/react';

export interface CodeEditorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export function CodeEditor({ value, onChange }: CodeEditorProps) {
  return (
    <Editor
      height="100%"
      language="typescript"
      value={value}
      onChange={(next) => onChange(next ?? '')}
      options={{ minimap: { enabled: false }, fontSize: 13 }}
    />
  );
}
```

- [ ] **Step 2: Write `DataEditor`**

```tsx
// packages/printer-preview/src/DataEditor.tsx
import Editor from '@monaco-editor/react';

export interface DataEditorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export function DataEditor({ value, onChange }: DataEditorProps) {
  return (
    <Editor
      height="100%"
      language="json"
      value={value}
      onChange={(next) => onChange(next ?? '')}
      options={{ minimap: { enabled: false }, fontSize: 13 }}
    />
  );
}
```

- [ ] **Step 3: Verify types**

Run: `npm run type-check -w printer-preview`
Expected: clean, no errors. (No unit tests for these two components — per the spec's testing section, Monaco needs a real DOM/browser environment that Vitest's default `node` test environment doesn't provide; correctness is verified manually once wired into `App.tsx` in Task 6.)

- [ ] **Step 4: Commit**

```bash
git add packages/printer-preview/src/CodeEditor.tsx packages/printer-preview/src/DataEditor.tsx
git commit -m "feat: add CodeEditor and DataEditor Monaco wrapper components"
```

---

### Task 5: Pipeline logic + `PreviewPanel` + `ErrorPanel`

**Files:**
- Create: `packages/printer-preview/src/pipeline.ts`
- Test: `packages/printer-preview/src/__tests__/pipeline.test.ts`
- Create: `packages/printer-preview/src/PreviewPanel.tsx`
- Create: `packages/printer-preview/src/ErrorPanel.tsx`

**Interfaces:**
- Consumes: `createDocumentResolver`, `createLayoutEngine`, `ApproximateFontMetrics`, `previewFor`, `PrintTemplateType`, and the types `PrintTemplate`, `PrintData`, `TypographyProfile`, `PrinterLanguage`, `ResolvedPrintDocument` — all from `printer-core`, already built and tested.
- Produces: `PagePreview`, `renderPreviews(template, data, language): readonly PagePreview[]`, `defaultLanguageFor(template): PrinterLanguage` — Task 6's `App.tsx` calls `renderPreviews` on every successful `evaluateTemplate` + JSON parse, and `defaultLanguageFor` once on initial load to pick a sensible starting dropdown value. Also produces `PreviewPanel({ previews })` and `ErrorPanel({ message })` React components.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/printer-preview/src/__tests__/pipeline.test.ts
import { describe, it, expect } from 'vitest';
import { labelTemplate, receiptTemplate, column, text, repeat } from 'printer-core';
import { renderPreviews, defaultLanguageFor } from '../pipeline';

describe('renderPreviews', () => {
  it('renders a single-page SVG for a simple label', () => {
    const template = labelTemplate()
      .size({ widthDots: 400, heightDots: 240, dpi: 203 })
      .root(column().children(text.binding('name')))
      .build();
    const previews = renderPreviews(template, { name: 'Hello' }, 'tsc');
    expect(previews).toHaveLength(1);
    expect(previews[0].status).toBe('ok');
    if (previews[0].status === 'ok') expect(previews[0].svg).toContain('<svg');
  });

  it('isolates a per-page resolve error without affecting other pages', () => {
    const template = labelTemplate()
      .size({ widthDots: 400, heightDots: 240, dpi: 203 })
      .root(repeat('items').maxItemsPerPage(1).template(column().children(text.binding('name'))))
      .build();
    const previews = renderPreviews(template, { items: [{ name: 'A' }, {}, { name: 'C' }] }, 'tsc');
    expect(previews).toHaveLength(3);
    expect(previews[0].status).toBe('ok');
    expect(previews[1].status).toBe('error');
    expect(previews[2].status).toBe('ok');
  });

  it('defaultLanguageFor picks escpos for receipts, tsc for labels', () => {
    const label = labelTemplate().size({ widthDots: 1, heightDots: 1, dpi: 1 }).root(text.literal('x')).build();
    const receipt = receiptTemplate().size({ widthDots: 1, dpi: 1 }).root(text.literal('x')).build();
    expect(defaultLanguageFor(label)).toBe('tsc');
    expect(defaultLanguageFor(receipt)).toBe('escpos');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w printer-preview`
Expected: FAIL — cannot find module `'../pipeline'`.

- [ ] **Step 3: Write `pipeline.ts`**

```ts
// packages/printer-preview/src/pipeline.ts
import {
  createDocumentResolver,
  createLayoutEngine,
  ApproximateFontMetrics,
  previewFor,
  PrintTemplateType,
  type PrintTemplate,
  type PrintData,
  type TypographyProfile,
  type PrinterLanguage,
  type ResolvedPrintDocument,
} from 'printer-core';

const DEFAULT_TYPOGRAPHY: TypographyProfile = {
  fontScaleLevels: [
    { id: 'large', fontScale: 1, lineHeightScale: 1 },
    { id: 'medium', fontScale: 0.75, lineHeightScale: 0.85 },
    { id: 'small', fontScale: 0.5, lineHeightScale: 0.7 },
  ],
};

const fontMetrics = new ApproximateFontMetrics();
const resolver = createDocumentResolver();
const layoutEngine = createLayoutEngine();

export type PagePreview =
  | { readonly status: 'ok'; readonly pageIndex: number; readonly svg: string }
  | { readonly status: 'error'; readonly pageIndex: number; readonly message: string };

export function renderPreviews(template: PrintTemplate, data: PrintData, language: PrinterLanguage): readonly PagePreview[] {
  const pages = resolver.resolve(template, data);
  return pages.map((page) => {
    if (page.status === 'error') {
      return { status: 'error', pageIndex: page.pageIndex, message: `${page.nodeId}: ${page.message}` };
    }
    const elements = layoutEngine.resolve(page.node, template.config, DEFAULT_TYPOGRAPHY, fontMetrics);
    const heightDots = template.type === PrintTemplateType.Label ? template.config.heightDots : undefined;
    const document: ResolvedPrintDocument = {
      widthDots: template.config.widthDots,
      heightDots: heightDots ?? 0,
      dpi: template.config.dpi,
      gapDots: 0,
      speed: 4,
      density: 8,
      direction: 'forward',
      copies: 1,
      elements,
    };
    try {
      const svg = previewFor(language, document);
      return { status: 'ok', pageIndex: page.pageIndex, svg };
    } catch (error) {
      return { status: 'error', pageIndex: page.pageIndex, message: error instanceof Error ? error.message : String(error) };
    }
  });
}

export function defaultLanguageFor(template: PrintTemplate): PrinterLanguage {
  return template.type === PrintTemplateType.Receipt ? 'escpos' : 'tsc';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w printer-preview`
Expected: PASS (3 tests)

- [ ] **Step 5: Write `PreviewPanel.tsx`**

```tsx
// packages/printer-preview/src/PreviewPanel.tsx
import type { PagePreview } from './pipeline';

export interface PreviewPanelProps {
  readonly previews: readonly PagePreview[];
}

export function PreviewPanel({ previews }: PreviewPanelProps) {
  if (previews.length === 0) return <div>Chưa có preview</div>;
  return (
    <div>
      {previews.map((preview) =>
        preview.status === 'ok' ? (
          // eslint-disable-next-line react/no-danger -- previewFor() returns a trusted SVG string generated by printer-core itself, not user-controlled markup
          <div key={preview.pageIndex} dangerouslySetInnerHTML={{ __html: preview.svg }} />
        ) : (
          <div key={preview.pageIndex} style={{ color: 'red' }}>
            Trang {preview.pageIndex + 1}: {preview.message}
          </div>
        ),
      )}
    </div>
  );
}
```

- [ ] **Step 6: Write `ErrorPanel.tsx`**

```tsx
// packages/printer-preview/src/ErrorPanel.tsx
export interface ErrorPanelProps {
  readonly message: string | null;
}

export function ErrorPanel({ message }: ErrorPanelProps) {
  if (!message) return null;
  return <div style={{ color: 'red', whiteSpace: 'pre-wrap' }}>{message}</div>;
}
```

- [ ] **Step 7: Verify types**

Run: `npm run type-check -w printer-preview`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add packages/printer-preview/src/pipeline.ts packages/printer-preview/src/__tests__/pipeline.test.ts packages/printer-preview/src/PreviewPanel.tsx packages/printer-preview/src/ErrorPanel.tsx
git commit -m "feat: add resolve/layout/preview pipeline and preview/error panels"
```

---

### Task 6: Wire everything into `App.tsx`

**Files:**
- Modify: `packages/printer-preview/src/App.tsx` (replaces Task 1's placeholder entirely)

**Interfaces:**
- Consumes: `CodeEditor` (Task 4), `DataEditor` (Task 4), `PreviewPanel`/`ErrorPanel` (Task 5), `evaluateTemplate` (Task 2), `renderPreviews`/`defaultLanguageFor`/`PagePreview` (Task 5), `defaultCode`/`defaultData` (Task 3), `PrinterLanguage` (from `printer-core`).

- [ ] **Step 1: Replace `App.tsx` with the full wired UI**

```tsx
// packages/printer-preview/src/App.tsx
import { useEffect, useState } from 'react';
import type { PrinterLanguage } from 'printer-core';
import { CodeEditor } from './CodeEditor';
import { DataEditor } from './DataEditor';
import { PreviewPanel } from './PreviewPanel';
import { ErrorPanel } from './ErrorPanel';
import { evaluateTemplate } from './evaluateTemplate';
import { renderPreviews, defaultLanguageFor, type PagePreview } from './pipeline';
import { defaultCode, defaultData } from './defaultSample';

const LANGUAGES: readonly PrinterLanguage[] = ['tsc', 'zpl', 'epl', 'cpcl', 'dpl', 'sbpl', 'escpos', 'starprnt', 'ipl'];

export function App() {
  const [code, setCode] = useState(defaultCode);
  const [dataText, setDataText] = useState(defaultData);
  const [language, setLanguage] = useState<PrinterLanguage>(() => {
    const initial = evaluateTemplate(defaultCode);
    return initial.status === 'ok' ? defaultLanguageFor(initial.template) : 'tsc';
  });
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<readonly PagePreview[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const evaluated = evaluateTemplate(code);
      if (evaluated.status === 'error') {
        setError(`[${evaluated.stage}] ${evaluated.message}`);
        setPreviews([]);
        return;
      }
      let data: unknown;
      try {
        data = JSON.parse(dataText);
      } catch (parseError) {
        setError(`[data] ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        setPreviews([]);
        return;
      }
      setError(null);
      setPreviews(renderPreviews(evaluated.template, data as Record<string, unknown>, language));
    }, 500);
    return () => clearTimeout(timer);
  }, [code, dataText, language]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', height: '100vh' }}>
      <div style={{ borderRight: '1px solid #ccc' }}>
        <CodeEditor value={code} onChange={setCode} />
      </div>
      <div style={{ borderRight: '1px solid #ccc' }}>
        <DataEditor value={dataText} onChange={setDataText} />
      </div>
      <div style={{ overflow: 'auto', padding: 8 }}>
        <select value={language} onChange={(event) => setLanguage(event.target.value as PrinterLanguage)}>
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
        <ErrorPanel message={error} />
        <PreviewPanel previews={previews} />
      </div>
    </div>
  );
}
```

The 500ms debounce avoids re-running the whole pipeline on every keystroke; auto-run (no explicit "Run" button) matches the live-preview UX of tools like CodeSandbox/CodePen, which the spec's "xem preview trực quan ngay" goal implies.

- [ ] **Step 2: Manual verification**

Run: `npm run dev -w printer-preview`, open the printed URL. Confirm:
- The page loads with the default sample already showing a label preview (SVG visible on the right, no error).
- Editing the JSON data (e.g. changing `product.name`) updates the preview after ~500ms with no page reload.
- Introducing a syntax error in the code editor (e.g. deleting a closing paren) shows a `[transpile]`-prefixed error and clears the preview.
- Switching the language dropdown to `escpos` re-renders the preview using the ESC/POS-language SVG renderer.

- [ ] **Step 3: Full package verification**

Run: `npm run type-check -w printer-preview`
Expected: clean.
Run: `npm run test -w printer-preview`
Expected: all 8 tests (5 from `evaluateTemplate.test.ts` + 3 from `pipeline.test.ts`) still pass.
Run: `npm run build -w printer-preview`
Expected: production build succeeds.
Run: `npm run type-check` (repo root)
Expected: still clean (confirms Task 1's exclusion still holds after all the new files).

- [ ] **Step 4: Commit**

```bash
git add packages/printer-preview/src/App.tsx
git commit -m "feat: wire CodeEditor/DataEditor/PreviewPanel into a live template preview app"
```

---

## Final Verification

After Task 6, run once more from the repo root to confirm nothing outside this plan's scope regressed:

```bash
npm run type-check
npm run test -w printer-preview
npm run build -w printer-preview
```

All three must be clean before considering this plan done.
