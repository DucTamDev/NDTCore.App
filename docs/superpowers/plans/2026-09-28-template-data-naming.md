# printer-core Template Data Naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổi khái niệm "catalog" của `printer-core` thành "template data" (thư mục, file, kiểu, hàm, biến, field JSON `dataId`, câu chữ), thay registry bằng `TemplateDataReader`, không đổi hành vi.

**Architecture:**
- **Task 1:** thay `CatalogRegistry` bằng `TemplateDataReader` (+ `describeTemplateData`), còn trong thư mục `catalog/`.
- **Task 2:** `git mv` thư mục `catalog/` thành `template/data/` cùng các file và đổi mọi tên kiểu/hàm/hằng + đường import (không đụng `catalog` viết thường).
- **Task 3:** field JSON `catalog` → `dataId`, biến/tham số/option `catalog` → `templateData`, câu lỗi, comment, README, quy ước code trong `printer-preview`.
- Kết quả resolve/layout/compile/preview không đổi; test hiện có là bằng chứng.

**Tech Stack:**
- TypeScript 5.9 strict.
- Jest (preset react-native) cho `printer-core`.
- Vitest cho `printer-preview`.
- `printer-core` không có dependency.

**Spec:** `docs/superpowers/specs/2026-09-28-template-data-naming-design.md`.

## Global Constraints

**Quy ước code (bắt buộc cho mọi sub-spec)** — chép nguyên văn từ `docs/superpowers/specs/2026-09-24-print-template-pipeline-overview.md`:

1. **Field summary:** mỗi field của type/interface export có 1 dòng JSDoc **tiếng Việt** nêu ý nghĩa, đơn vị (dots, mm, `Length`...), mặc định/ràng buộc nếu có. Chỉ bỏ qua field mà tên đã hiển nhiên tuyệt đối (VD `bold`).
2. **Cách dòng:** 1 dòng trống giữa các field (kèm JSDoc của nó) trong interface; dòng trống giữa các khối logic trong hàm.
3. **Comment trong implementation:** tiếng Việt, ngắn, chỉ giải thích WHY (constraint protocol, giới hạn phần cứng, hành vi không hiển nhiên). Không mô tả lại code, không kể lịch sử.
4. **Độ dài dòng ≤ 120 ký tự**, đo bằng số ký tự thật (Node `line.length`), không đo bằng byte.
5. **Nesting ≤ 3 cấp**, dùng guard clause/early return.
6. **1 hàm 1 trách nhiệm:** switch theo loại node/element thì mỗi case là 1 hàm riêng, switch chỉ điều phối. Không hàm lồng trong hàm.
7. **Không magic number:** hằng số `UPPER_SNAKE_CASE`, tên nói rõ đơn vị.
8. **Tên đầy đủ, không viết tắt** (`options` không `o`); identifier và tên file bằng tiếng Anh.
9. **Import module khác qua barrel `index.ts`**, không deep import vào file implementation.
10. **Hàm ≥ 3 tham số** viết mỗi tham số 1 dòng.
11. **Verify trước mỗi commit:** type-check, test, eslint 0 error, line-length.

**Quy tắc chung của đợt tái cấu trúc** (từ file tổng):

- **Test giữ nguyên như hiện tại:**
  - Chỉ sửa đường import khi file nguồn bị tách hoặc chuyển.
  - Chỉ sửa kỳ vọng khi API đổi có chủ đích (đợt này: tên mới, field `dataId`, câu chữ lỗi).
  - Test của code bị xoá thì xoá theo.
- **Không đổi hành vi in** của TSPL và ESC/POS: cùng document → cùng lệnh máy in và cùng cảnh báo.
- **`printer-preview` phải còn chạy được:** type-check + Vitest xanh.
- Đợt này chỉ đổi tên (và thay registry bằng reader); tách file nhiều khái niệm để R5.

**Ràng buộc khác:**

- **Branch:** làm trên `refactor/template-data-naming` (đã có commit spec và commit của plan này). Checkout thẳng trong working directory chính — **không dùng git worktree**, không commit thẳng `main`.
- **Stage file:**
  - File chuyển/xoá được stage bởi chính `git mv`/`git rm` trong task; file sửa/thêm stage bằng lệnh `git add` cho sẵn.
  - **Không bao giờ** `git add -A` hay `git add .`. `.claude/worktrees/` giữ untracked.
- **Commit message:** dùng đúng 2 tham số `-m` cho trong task; dòng cuối là `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, nguyên văn.
- **Nơi chạy lệnh:** mọi lệnh chạy từ `C:\NDTCORE\NDTCore\NDTCore.App` bằng Git Bash.

### Cách áp code của plan

Phần **chuyển/xoá file** dùng lệnh `git mv`/`git rm` ghi sẵn trong task. Phần **sửa/thêm** nằm trong khối patch của chính file này: mỗi khối có đánh dấu `<!-- patch:<id> -->` đứng ngay trước khối `~~~diff`. Task có TDD tách 2 patch: `tNtest` (test) và `tNimpl` (code); Task 2 dùng 1 patch `t2`.

**Lệnh áp 1 patch** (mỗi step đã ghi sẵn lệnh đầy đủ):

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-28-template-data-naming.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" <id> | git apply --ignore-whitespace -
```

- `--ignore-whitespace` cần vì working tree có file CRLF lẫn LF.
- Lúc lập plan, cả 3 task đã được áp lần lượt lên clone của branch này (checkout CRLF) và cho ra đúng nội dung đã kiểm chứng.
- **Nếu `git mv`, `git rm` hoặc `git apply` báo lỗi: dừng lại, báo BLOCKED kèm nguyên văn lỗi.** Không tự sửa tay.

### Lệnh verify dùng chung

Chạy từ `NDTCore.App`:

- **Type-check `printer-core`:**
  ```bash
  npx tsc --noEmit -p packages/printer-core
  ```
  Expected: không in gì.

- **Test `printer-core`:**
  ```bash
  npx jest packages/printer-core
  ```
  Expected: con số ghi trong task, không suite fail. Lần chạy đầu khi cache nguội có thể có 1 suite lỗi — chạy lại 1 lần.

- **`printer-preview`:**
  ```bash
  (cd packages/printer-preview && npx tsc --noEmit && npx vitest run)
  ```
  Expected: tsc không in gì; Vitest `12 passed`.

- **ESLint:**
  ```bash
  npx eslint packages/printer-core/src packages/printer-preview/src
  ```
  Expected: `0 errors`. 6 warning `react-native/no-inline-styles` trong `printer-preview` là có sẵn.

- **Line-length cho dòng đã stage:**
  ```bash
  git diff --cached -U0 -- '*.ts' '*.tsx' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
  ```
  Expected: không in gì, exit 0.


## Review Focus

Các trường hợp spec ngụ ý nhưng dễ bị bỏ sót, xếp theo khả năng gây hại cao nhất trước:

1. **Template JSON còn field `catalog`** (tạo trước đợt này, VD lưu tay trong `printer-preview`).
   - Mong đợi: `parseTemplate` từ chối với lỗi ở `dataId` (thiếu field), không âm thầm chạy.
   - Chốt bằng: test `parseTemplate` dùng fixture `dataId`; `validateTemplateStructure` kiểm `dataId` không rỗng (Task 3).
2. **Resolve template khác dữ liệu template truyền vào.**
   - Mong đợi: vẫn throw, thông báo nêu đúng 2 mã (`Template dùng dữ liệu "kitchen", không phải "test-order"`).
   - Chốt bằng: test `DocumentResolver — dữ liệu template` (Task 3).
3. **Tên biến/collection trùng ở bất kỳ cấp nào, hoặc bắt đầu bằng `$`** sau khi bỏ registry.
   - Mong đợi: `defineTemplateData` vẫn throw ngay khi khai báo, như trước.
   - Chốt bằng: test `TemplateDataReader` + test `defineTemplateData` (Task 1).
4. **Code người dùng trong `printer-preview` còn viết `export const catalog`.**
   - Mong đợi: báo lỗi runtime kèm gợi ý `export const templateData = defineTemplateData(...)`.
   - Chốt bằng: test `evaluateTemplate` "báo lỗi runtime khi thiếu export templateData" (Task 3).
5. **Sót chữ `catalog`** ở code, test, comment hoặc README.
   - Mong đợi: không còn.
   - Chốt bằng: grep ở mục Kiểm tra cuối.

## Các quyết định lệch khỏi spec (đã chốt khi lập plan)

| # | Spec | Plan | Lý do |
|---|---|---|---|
| 1 | `TemplateDataReader`, `createTemplateDataReader` thay registry | Chỉ `type TemplateDataReader` export qua barrel; `createTemplateDataReader` và `describeTemplateData` dùng nội bộ thư mục `template/data/` | Registry/`describeCatalog` trước đây cũng không export; không có nơi nào ngoài thư mục cần gọi |
| 2 | "Tổng số test không đổi" | +4 test (`TemplateDataReader.test.ts`): 315 → 319 | Reader là file mới có logic riêng (tra tên, báo trùng); test trực tiếp thay vì chỉ qua `defineTemplateData` |
| 3 | Resolver dùng `TemplateDataDefinition` | Field `ResolveContext.templateData: TemplateDataDefinition<unknown>` (bỏ alias `CatalogReader`) | Đúng spec; ghi rõ vì `DocumentResolver` nhận `TemplateDataDefinition<TData>` và gán vào context kiểu `unknown` |
| 4 | — | Câu lỗi resolver/validate: `Template dùng dữ liệu "x", không phải "y"`, `dữ liệu template không có biến/collection …` | Spec chỉ nêu câu lỗi của reader; các câu còn lại đổi theo cùng cách |

---

### Task 1: `TemplateDataReader` thay registry, `describeTemplateData`

Làm trong thư mục `catalog/` còn tên cũ; Task 2 mới đổi tên thư mục và các kiểu khác.

**Files:**
- Delete: `packages/printer-core/src/catalog/CatalogRegistry.ts`, `packages/printer-core/src/catalog/describeCatalog.ts`
- Create: `packages/printer-core/src/catalog/TemplateDataReader.ts`, `packages/printer-core/src/catalog/describeTemplateData.ts`
- Modify: `packages/printer-core/src/catalog/Catalog.ts`, `packages/printer-core/src/catalog/defineCatalog.ts`, `packages/printer-core/src/catalog/index.ts`
- Test: `packages/printer-core/src/catalog/__tests__/TemplateDataReader.test.ts` (mới), `packages/printer-core/src/catalog/__tests__/defineCatalog.test.ts` (câu lỗi trùng tên)

**Interfaces:**
- Consumes: không có.
- Produces:
  - `interface TemplateDataReader { readVariable(name: string, source: unknown): unknown; readCollection(name: string, source: unknown): unknown }` — export type qua barrel.
  - `createTemplateDataReader(variables: VariableSpecMap<unknown>, collections: CatalogCollectionMap<unknown>): TemplateDataReader` — throw `Tên "x" bị trùng trong dữ liệu template`, `Tên "$x" không hợp lệ: tiền tố "$" dành cho biến có sẵn`; đọc thiếu thì throw `Dữ liệu template không có biến "x"` / `… collection "x"`.
  - `describeTemplateData(definition: Pick<Catalog<unknown>, 'id' | 'version' | 'variables' | 'collections'>): CatalogDescription`.
  - `Catalog` extends `TemplateDataReader`.

- [ ] **Step 1: Kiểm tra branch và working tree**

```bash
git branch --show-current
git status --short
```

Expected: `refactor/template-data-naming`; `git status` chỉ có `?? .claude/worktrees/`.

- [ ] **Step 2: Viết test (patch `t1test`)**

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-28-template-data-naming.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t1test | git apply --ignore-whitespace -
```

<!-- patch:t1test -->
~~~diff
diff --git a/packages/printer-core/src/catalog/__tests__/TemplateDataReader.test.ts b/packages/printer-core/src/catalog/__tests__/TemplateDataReader.test.ts
new file mode 100644
index 0000000..e9d7d7b
--- /dev/null
+++ b/packages/printer-core/src/catalog/__tests__/TemplateDataReader.test.ts
@@ -0,0 +1,57 @@
+import { defineCollection } from '..';
+import { createTemplateDataReader } from '../TemplateDataReader';
+
+interface TestItem {
+  readonly name: string;
+  readonly toppings: readonly string[];
+}
+
+const TOPPINGS = defineCollection({
+  label: 'Topping',
+  get: (item: TestItem) => item.toppings,
+  variables: { toppingName: { label: 'Tên topping', type: 'string', get: (topping) => topping } },
+});
+
+const ITEMS = defineCollection({
+  label: 'Món',
+  get: (order: { readonly items: readonly TestItem[] }) => order.items,
+  variables: { itemName: { label: 'Tên món', type: 'string', get: (item) => item.name } },
+  collections: { toppings: TOPPINGS },
+});
+
+const ORDER = { code: 'HD001', items: [{ name: 'Trà sữa', toppings: ['Trân châu'] }] };
+
+describe('createTemplateDataReader', () => {
+  const reader = createTemplateDataReader(
+    { orderCode: { label: 'Mã đơn', type: 'string', get: (order: typeof ORDER) => order.code } },
+    { items: ITEMS },
+  );
+
+  it('đọc biến và collection ở mọi cấp theo tên', () => {
+    const firstItem = ORDER.items[0];
+
+    expect(reader.readVariable('orderCode', ORDER)).toBe('HD001');
+    expect(reader.readVariable('itemName', firstItem)).toBe('Trà sữa');
+    expect(reader.readCollection('items', ORDER)).toEqual(ORDER.items);
+    expect(reader.readCollection('toppings', firstItem)).toEqual(['Trân châu']);
+  });
+
+  it('throw khi đọc biến hoặc collection không tồn tại', () => {
+    expect(() => reader.readVariable('missing', ORDER)).toThrow('Dữ liệu template không có biến "missing"');
+    expect(() => reader.readCollection('missing', ORDER)).toThrow('Dữ liệu template không có collection "missing"');
+  });
+
+  it('throw khi tên trùng ở bất kỳ cấp nào', () => {
+    const duplicated = { itemName: { label: 'Tên', type: 'string', get: () => '' } } as const;
+
+    expect(() => createTemplateDataReader(duplicated, { items: ITEMS })).toThrow(
+      'Tên "itemName" bị trùng trong dữ liệu template',
+    );
+  });
+
+  it('throw khi tên bắt đầu bằng "$"', () => {
+    const reserved = { $page: { label: 'Trang', type: 'number', get: () => 1 } } as const;
+
+    expect(() => createTemplateDataReader(reserved, {})).toThrow('tiền tố "$" dành cho biến có sẵn');
+  });
+});
diff --git a/packages/printer-core/src/catalog/__tests__/defineCatalog.test.ts b/packages/printer-core/src/catalog/__tests__/defineCatalog.test.ts
index c333340..f5be1cf 100644
--- a/packages/printer-core/src/catalog/__tests__/defineCatalog.test.ts
+++ b/packages/printer-core/src/catalog/__tests__/defineCatalog.test.ts
@@ -38,7 +38,7 @@ describe('defineCatalog', () => {
         variables: { name: { label: 'Tên', type: 'string', get: (order) => order.name } },
         collections: { items },
       }),
-    ).toThrow('Tên "name" bị trùng trong catalog');
+    ).toThrow('Tên "name" bị trùng trong dữ liệu template');
   });
 
   it('throw khi tên collection trùng tên biến', () => {
@@ -56,7 +56,7 @@ describe('defineCatalog', () => {
         variables: { items: { label: 'Món', type: 'string', get: () => '' } },
         collections: { items },
       }),
-    ).toThrow('Tên "items" bị trùng trong catalog');
+    ).toThrow('Tên "items" bị trùng trong dữ liệu template');
   });
 
   it('throw khi tên biến bắt đầu bằng "$"', () => {
~~~

- [ ] **Step 3: Chạy test, xác nhận FAIL**

```bash
npx jest packages/printer-core/src/catalog
```

Expected: `Test Suites: 2 failed` — `TemplateDataReader.test.ts` báo `Cannot find module '../TemplateDataReader'`; `defineCatalog.test.ts` fail 2 ca vì câu lỗi vẫn là `bị trùng trong catalog`.

- [ ] **Step 4: Viết code (git rm + patch `t1impl`)**

```bash
git rm -q packages/printer-core/src/catalog/CatalogRegistry.ts packages/printer-core/src/catalog/describeCatalog.ts
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-28-template-data-naming.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t1impl | git apply --ignore-whitespace -
```

<!-- patch:t1impl -->
~~~diff
diff --git a/packages/printer-core/src/catalog/Catalog.ts b/packages/printer-core/src/catalog/Catalog.ts
index d04a646..769a60d 100644
--- a/packages/printer-core/src/catalog/Catalog.ts
+++ b/packages/printer-core/src/catalog/Catalog.ts
@@ -1,5 +1,6 @@
 import type { CatalogCollectionMap } from './CatalogCollection';
 import type { CatalogDescription } from './CatalogDescription';
+import type { TemplateDataReader } from './TemplateDataReader';
 import type { VariableSpecMap } from './VariableSpec';
 
 /** Catalog đã khai báo — cầu nối duy nhất giữa template và data nội bộ của app. */
@@ -7,7 +8,7 @@ export interface Catalog<
   TData,
   TVariables extends VariableSpecMap<TData> = VariableSpecMap<TData>,
   TCollections extends CatalogCollectionMap<TData> = CatalogCollectionMap<TData>,
-> {
+> extends TemplateDataReader {
   /** Mã catalog, VD 'product-label'; template tham chiếu qua `TemplateDocument.catalog`. */
   readonly id: string;
 
@@ -25,15 +26,6 @@ export interface Catalog<
 
   /** Metadata JSON thuần (không có hàm) cho designer/BE và cho validate template. */
   describe(): CatalogDescription;
-
-  /**
-   * Đọc giá trị raw của biến `name` từ `source`. `source` có kiểu `unknown` vì resolver chỉ biết
-   * tên biến lúc chạy. Throw nếu catalog không có biến này.
-   */
-  readVariable(name: string, source: unknown): unknown;
-
-  /** Đọc mảng phần tử của collection `name` từ `source`. Throw nếu catalog không có collection này. */
-  readCollection(name: string, source: unknown): unknown;
 }
 
 /** Input của `defineCatalog`. */
diff --git a/packages/printer-core/src/catalog/TemplateDataReader.ts b/packages/printer-core/src/catalog/TemplateDataReader.ts
new file mode 100644
index 0000000..3db8ac9
--- /dev/null
+++ b/packages/printer-core/src/catalog/TemplateDataReader.ts
@@ -0,0 +1,79 @@
+import { RESERVED_NAME_PREFIX } from './BuiltInVariable';
+import type { CatalogCollection, CatalogCollectionMap } from './CatalogCollection';
+import type { VariableSpec, VariableSpecMap } from './VariableSpec';
+
+/** Đọc giá trị biến/collection theo tên lúc chạy — resolver chỉ biết tên, không biết kiểu data. */
+export interface TemplateDataReader {
+  /** Đọc giá trị raw của biến `name` từ `source`. Throw nếu không có biến này. */
+  readVariable(name: string, source: unknown): unknown;
+
+  /** Đọc mảng phần tử của collection `name` từ `source`. Throw nếu không có collection này. */
+  readCollection(name: string, source: unknown): unknown;
+}
+
+/** Bảng tra phẳng tên → khai báo ở mọi cấp. */
+interface NameLookup {
+  readonly variables: Map<string, VariableSpec<unknown>>;
+  readonly collections: Map<string, CatalogCollection<unknown, unknown>>;
+}
+
+/** Dựng reader từ biến/collection đã khai báo; throw nếu tên trùng ở bất kỳ cấp nào hoặc dùng tiền tố `$`. */
+export function createTemplateDataReader(
+  variables: VariableSpecMap<unknown>,
+  collections: CatalogCollectionMap<unknown>,
+): TemplateDataReader {
+  const lookup: NameLookup = { variables: new Map(), collections: new Map() };
+  registerScope(lookup, variables, collections);
+
+  return {
+    readVariable: (name, source) => readVariableByName(lookup, name, source),
+    readCollection: (name, source) => readCollectionByName(lookup, name, source),
+  };
+}
+
+function registerScope(
+  lookup: NameLookup,
+  variables: VariableSpecMap<unknown>,
+  collections: CatalogCollectionMap<unknown>,
+): void {
+  for (const [name, spec] of Object.entries(variables)) {
+    assertNameAvailable(lookup, name);
+    lookup.variables.set(name, spec);
+  }
+
+  for (const [name, collection] of Object.entries(collections)) {
+    assertNameAvailable(lookup, name);
+    lookup.collections.set(name, collection);
+    registerScope(lookup, collection.variables, collection.collections);
+  }
+}
+
+// Tên duy nhất trên toàn bộ dữ liệu template là điều kiện để resolver biết chắc 1 biến thuộc scope nào.
+function assertNameAvailable(lookup: NameLookup, name: string): void {
+  if (name.startsWith(RESERVED_NAME_PREFIX)) {
+    throw new Error(`Tên "${name}" không hợp lệ: tiền tố "${RESERVED_NAME_PREFIX}" dành cho biến có sẵn`);
+  }
+  if (lookup.variables.has(name) || lookup.collections.has(name)) {
+    throw new Error(`Tên "${name}" bị trùng trong dữ liệu template`);
+  }
+}
+
+function readVariableByName(
+  lookup: NameLookup,
+  name: string,
+  source: unknown,
+): unknown {
+  const spec = lookup.variables.get(name);
+  if (!spec) throw new Error(`Dữ liệu template không có biến "${name}"`);
+  return spec.get(source);
+}
+
+function readCollectionByName(
+  lookup: NameLookup,
+  name: string,
+  source: unknown,
+): unknown {
+  const collection = lookup.collections.get(name);
+  if (!collection) throw new Error(`Dữ liệu template không có collection "${name}"`);
+  return collection.get(source);
+}
diff --git a/packages/printer-core/src/catalog/defineCatalog.ts b/packages/printer-core/src/catalog/defineCatalog.ts
index ec0b9e9..ed018d3 100644
--- a/packages/printer-core/src/catalog/defineCatalog.ts
+++ b/packages/printer-core/src/catalog/defineCatalog.ts
@@ -1,8 +1,7 @@
 import type { Catalog, CatalogDefinition } from './Catalog';
 import type { CatalogCollectionMap, EmptyCollectionMap } from './CatalogCollection';
-import type { CatalogDescription } from './CatalogDescription';
-import { createCatalogRegistry, readRegisteredCollection, readRegisteredVariable } from './CatalogRegistry';
-import { describeCollections, describeVariables } from './describeCatalog';
+import { describeTemplateData } from './describeTemplateData';
+import { createTemplateDataReader } from './TemplateDataReader';
 import type { VariableSpecMap } from './VariableSpec';
 
 /**
@@ -15,13 +14,13 @@ export function defineCatalog<
   TCollections extends CatalogCollectionMap<TData> = EmptyCollectionMap,
 >(definition: CatalogDefinition<TData, TVariables, TCollections>): Catalog<TData, TVariables, TCollections> {
   const collections = definition.collections ?? ({} as TCollections);
-  const registry = createCatalogRegistry(definition.variables, collections);
-  const description: CatalogDescription = {
+  const reader = createTemplateDataReader(definition.variables, collections);
+  const description = describeTemplateData({
     id: definition.id,
     version: definition.version,
-    variables: describeVariables(definition.variables),
-    collections: describeCollections(collections),
-  };
+    variables: definition.variables,
+    collections,
+  });
 
   return Object.freeze({
     id: definition.id,
@@ -30,7 +29,7 @@ export function defineCatalog<
     variables: definition.variables,
     collections,
     describe: () => description,
-    readVariable: (name: string, source: unknown) => readRegisteredVariable(registry, name, source),
-    readCollection: (name: string, source: unknown) => readRegisteredCollection(registry, name, source),
+    readVariable: reader.readVariable,
+    readCollection: reader.readCollection,
   });
 }
diff --git a/packages/printer-core/src/catalog/describeTemplateData.ts b/packages/printer-core/src/catalog/describeTemplateData.ts
new file mode 100644
index 0000000..f68c393
--- /dev/null
+++ b/packages/printer-core/src/catalog/describeTemplateData.ts
@@ -0,0 +1,39 @@
+import type { Catalog } from './Catalog';
+import type { CatalogCollectionMap } from './CatalogCollection';
+import type { CatalogDescription, CollectionDescription, VariableDescription } from './CatalogDescription';
+import type { VariableSpec, VariableSpecMap } from './VariableSpec';
+
+/** Metadata JSON thuần (bỏ mọi hàm `get`) của phần khai báo, cho designer/BE và cho validate template. */
+export function describeTemplateData(
+  definition: Pick<Catalog<unknown>, 'id' | 'version' | 'variables' | 'collections'>,
+): CatalogDescription {
+  return {
+    id: definition.id,
+    version: definition.version,
+    variables: describeVariables(definition.variables),
+    collections: describeCollections(definition.collections),
+  };
+}
+
+function describeVariables(variables: VariableSpecMap<unknown>): readonly VariableDescription[] {
+  return Object.entries(variables).map(([name, spec]) => describeVariable(name, spec));
+}
+
+function describeCollections(collections: CatalogCollectionMap<unknown>): readonly CollectionDescription[] {
+  return Object.entries(collections).map(([name, collection]) => ({
+    name,
+    label: collection.label,
+    variables: describeVariables(collection.variables),
+    collections: describeCollections(collection.collections),
+  }));
+}
+
+function describeVariable(name: string, spec: VariableSpec<unknown>): VariableDescription {
+  return {
+    name,
+    label: spec.label,
+    type: spec.type,
+    optional: spec.optional ?? false,
+    ...(spec.deprecated !== undefined ? { deprecated: spec.deprecated } : {}),
+  };
+}
diff --git a/packages/printer-core/src/catalog/index.ts b/packages/printer-core/src/catalog/index.ts
index e79cbaf..c97be1d 100644
--- a/packages/printer-core/src/catalog/index.ts
+++ b/packages/printer-core/src/catalog/index.ts
@@ -5,4 +5,5 @@ export * from './CatalogDescription';
 export * from './Catalog';
 export * from './BuiltInVariable';
 export * from './CatalogIndex';
+export type { TemplateDataReader } from './TemplateDataReader';
 export { defineCatalog } from './defineCatalog';
~~~

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
npx eslint packages/printer-core/src packages/printer-preview/src
```

Expected: tsc không in gì; jest `319 passed, 319 total`; eslint `0 errors`.

- [ ] **Step 6: Stage, line-length, commit**

```bash
git add \
  packages/printer-core/src/catalog/Catalog.ts \
  packages/printer-core/src/catalog/TemplateDataReader.ts \
  packages/printer-core/src/catalog/__tests__/TemplateDataReader.test.ts \
  packages/printer-core/src/catalog/__tests__/defineCatalog.test.ts \
  packages/printer-core/src/catalog/defineCatalog.ts \
  packages/printer-core/src/catalog/describeTemplateData.ts \
  packages/printer-core/src/catalog/index.ts
git diff --cached -U0 -- '*.ts' '*.tsx' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "refactor: replace catalog registry with TemplateDataReader" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log -1 --format=%B
git status --short
```

Expected: line-length không in gì; commit thành công đúng 2 dòng message; `git status` chỉ còn `?? .claude/worktrees/`.

---

### Task 2: Đổi tên thư mục, file và kiểu/hàm sang "template data"

Chỉ đổi định danh viết hoa/hàm/hằng và đường import. Từ `catalog` viết thường (biến, tham số, field JSON, comment) để Task 3.

**Files:**
- Move: `catalog/` → `template/data/`; trong đó `Catalog.ts` → `TemplateDataDefinition.ts`, `CatalogCollection.ts` → `CollectionDefinition.ts`, `CatalogDescription.ts` → `TemplateDataDescription.ts`, `CatalogIndex.ts` → `TemplateDataIndex.ts`, `VariableSpec.ts` → `VariableDefinition.ts`, `defineCatalog.ts` → `defineTemplateData.ts`, `__tests__/CatalogIndex.test.ts` → `__tests__/TemplateDataIndex.test.ts`, `__tests__/defineCatalog.test.ts` → `__tests__/defineTemplateData.test.ts`; `template/parse/validateTemplateAgainstCatalog.ts` (+ test) → `validateTemplateAgainstData.ts`; `testing/OrderTestCatalog.ts` → `testing/OrderTestData.ts`
- Modify: mọi file import/dùng các tên cũ trong `packages/printer-core/src` và `packages/printer-preview/src` (danh sách đủ ở khối `git add` của Step 5)

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: `TemplateDataReader` (Task 1).
- Produces (tên mới, barrel `template/data`, được `template/index.ts` export; `src/index.ts` bỏ `export * from './catalog'`):
  - `TemplateDataDefinition<TData, TVariables, TCollections>` (extends `TemplateDataReader`), `TemplateDataDefinitionInput`, `defineTemplateData()`.
  - `CollectionDefinition`, `CollectionDefinitionInput` (input của `defineCollection`), `CollectionDefinitionMap`, `EmptyCollectionMap`, `defineCollection()`.
  - `VariableDefinition`, `VariableDefinitionMap`, `TemplateDataDescription`, `TemplateDataIndex`, `createTemplateDataIndex`.
  - `TemplateDataShape` (builder), `readFromTemplateData` (resolution), `validateTemplateAgainstData`, `TemplateDataValidationResult`, `TEST_ORDER_DATA`, type param `TTemplateData`.
  - Bỏ `CatalogReader`; `ResolveContext.catalog` có kiểu `TemplateDataDefinition<unknown>` (field đổi tên ở Task 3).

- [ ] **Step 1: Chuyển file bằng git mv**

```bash
git mv packages/printer-core/src/catalog packages/printer-core/src/template/data
git mv packages/printer-core/src/template/data/Catalog.ts packages/printer-core/src/template/data/TemplateDataDefinition.ts
git mv packages/printer-core/src/template/data/CatalogCollection.ts packages/printer-core/src/template/data/CollectionDefinition.ts
git mv packages/printer-core/src/template/data/CatalogDescription.ts packages/printer-core/src/template/data/TemplateDataDescription.ts
git mv packages/printer-core/src/template/data/CatalogIndex.ts packages/printer-core/src/template/data/TemplateDataIndex.ts
git mv packages/printer-core/src/template/data/VariableSpec.ts packages/printer-core/src/template/data/VariableDefinition.ts
git mv packages/printer-core/src/template/data/defineCatalog.ts packages/printer-core/src/template/data/defineTemplateData.ts
git mv packages/printer-core/src/template/data/__tests__/CatalogIndex.test.ts packages/printer-core/src/template/data/__tests__/TemplateDataIndex.test.ts
git mv packages/printer-core/src/template/data/__tests__/defineCatalog.test.ts packages/printer-core/src/template/data/__tests__/defineTemplateData.test.ts
git mv packages/printer-core/src/template/parse/validateTemplateAgainstCatalog.ts packages/printer-core/src/template/parse/validateTemplateAgainstData.ts
git mv packages/printer-core/src/template/parse/__tests__/validateTemplateAgainstCatalog.test.ts packages/printer-core/src/template/parse/__tests__/validateTemplateAgainstData.test.ts
git mv packages/printer-core/src/testing/OrderTestCatalog.ts packages/printer-core/src/testing/OrderTestData.ts
ls packages/printer-core/src/catalog
```

Expected: các lệnh `git mv` không lỗi; `ls` báo không có thư mục `catalog`.

- [ ] **Step 2: Type-check, xác nhận FAIL**

```bash
npx tsc --noEmit -p packages/printer-core
```

Expected: nhiều lỗi `Cannot find module` (đường import cũ tới `catalog`, `./Catalog`, `./CatalogCollection`…).

- [ ] **Step 3: Áp patch `t2`**

Patch đổi toàn bộ định danh theo bảng của spec (đổi `CollectionDefinition` cũ thành `CollectionDefinitionInput` trước khi `CatalogCollection` nhận tên `CollectionDefinition`), đường import tới `catalog` → đường tương đối tới `template/data`, `template/index.ts` export `./data` và `src/index.ts` bỏ export `./catalog`, test trong `template/data/__tests__` đi tới `testing/` sâu thêm 1 cấp, bỏ alias `CatalogReader`, và xuống dòng 2 chỗ vượt 120 ký tự vì tên dài hơn.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-28-template-data-naming.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t2 | git apply --ignore-whitespace -
```

<!-- patch:t2 -->
~~~diff
diff --git a/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts b/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts
index bc065c8..921c13f 100644
--- a/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts
+++ b/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts
@@ -16,7 +16,7 @@ import {
   row,
   text,
 } from '../template';
-import { TEST_ORDER_CATALOG, TEST_ORDER_SAMPLE, type TestOrder } from '../testing';
+import { TEST_ORDER_DATA, TEST_ORDER_SAMPLE, type TestOrder } from '../testing';
 import type { Bitmap } from '../types';
 
 // Không có @types/node trong package RN; require() chỉ dùng để khẳng định module cũ đã bị xoá.
@@ -27,7 +27,7 @@ const TYPOGRAPHY: TypographyProfile = { fontScaleLevels: [{ id: 'default', fontS
 const PRINTER_DPI = 203;
 
 function buildReceipt() {
-  return receiptTemplate(TEST_ORDER_CATALOG)
+  return receiptTemplate(TEST_ORDER_DATA)
     .id('receipt-default')
     .name('Hoá đơn mặc định')
     .paper({ widthMm: 72 })
@@ -54,10 +54,10 @@ describe('pipeline template → resolve → layout → compile', () => {
     if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
     const template = parsed.template;
 
-    expect(collectAssetIds(template, TEST_ORDER_CATALOG, TEST_ORDER_SAMPLE)).toEqual(['store-logo@v1']);
+    expect(collectAssetIds(template, TEST_ORDER_DATA, TEST_ORDER_SAMPLE)).toEqual(['store-logo@v1']);
     const assets: AssetProvider = { get: (assetId) => (assetId === 'store-logo@v1' ? LOGO : undefined) };
 
-    const resolveOptions = { catalog: TEST_ORDER_CATALOG, assets };
+    const resolveOptions = { catalog: TEST_ORDER_DATA, assets };
     const pages = createDocumentResolver().resolve(template, TEST_ORDER_SAMPLE, resolveOptions);
     expect(pages).toHaveLength(1);
     if (pages[0].status !== 'ok') throw new Error(pages[0].message);
@@ -97,7 +97,7 @@ describe('pipeline template → resolve → layout → compile', () => {
   });
 
   it('tem món nhiều topping tách sang tem tiếp: JSON round-trip → resolve → layout từng tem', () => {
-    const built = labelTemplate(TEST_ORDER_CATALOG)
+    const built = labelTemplate(TEST_ORDER_DATA)
       .id('split-label')
       .name('Tem tách topping')
       .paper({ widthMm: 50, heightMm: 30 })
@@ -130,7 +130,7 @@ describe('pipeline template → resolve → layout → compile', () => {
       items: [{ name: 'Trà sữa', quantity: 1, price: 45000, toppings }],
     };
     const pages = createDocumentResolver().resolve(template, order, {
-      catalog: TEST_ORDER_CATALOG,
+      catalog: TEST_ORDER_DATA,
       assets: { get: () => undefined },
     });
 
diff --git a/packages/printer-core/src/index.ts b/packages/printer-core/src/index.ts
index add46fb..491b020 100644
--- a/packages/printer-core/src/index.ts
+++ b/packages/printer-core/src/index.ts
@@ -10,7 +10,6 @@ export * from './preview';
 export * from './validation';
 export * from './registry';
 export * from './convert';
-export * from './catalog';
 export * from './template';
 export * from './resolution';
 export * from './layout';
diff --git a/packages/printer-core/src/resolution/DocumentResolver.ts b/packages/printer-core/src/resolution/DocumentResolver.ts
index 32f6fd5..cd350f1 100644
--- a/packages/printer-core/src/resolution/DocumentResolver.ts
+++ b/packages/printer-core/src/resolution/DocumentResolver.ts
@@ -1,4 +1,4 @@
-import { createCatalogIndex, type Catalog } from '../catalog';
+import { createTemplateDataIndex, type TemplateDataDefinition } from '../template/data';
 import type { TemplateDocument, TemplateNode } from '../template';
 import type { AssetProvider } from './AssetProvider';
 import { planPages } from './planPages';
@@ -9,8 +9,8 @@ import { resolveNode } from './resolveNode';
 
 /** Nguồn phụ trợ cho 1 lần resolve. */
 export interface ResolveOptions<TData> {
-  /** Catalog mà template dùng; `id` phải khớp `template.catalog`. */
-  readonly catalog: Catalog<TData>;
+  /** TemplateDataDefinition mà template dùng; `id` phải khớp `template.catalog`. */
+  readonly catalog: TemplateDataDefinition<TData>;
 
   /** Ảnh đã tải + decode sẵn. */
   readonly assets: AssetProvider;
@@ -33,7 +33,7 @@ export class DocumentResolver {
 
     const baseContext: ResolveContext = {
       catalog: options.catalog,
-      index: createCatalogIndex(options.catalog.describe()),
+      index: createTemplateDataIndex(options.catalog.describe()),
       assets: options.assets,
       frames: [createRootFrame(data)],
       page: COUNTING_PAGE,
diff --git a/packages/printer-core/src/resolution/ResolveContext.ts b/packages/printer-core/src/resolution/ResolveContext.ts
index ac43f09..5583307 100644
--- a/packages/printer-core/src/resolution/ResolveContext.ts
+++ b/packages/printer-core/src/resolution/ResolveContext.ts
@@ -1,9 +1,6 @@
-import type { Catalog, CatalogIndex } from '../catalog';
+import type { TemplateDataDefinition, TemplateDataIndex } from '../template/data';
 import type { AssetProvider } from './AssetProvider';
 
-/** Phần catalog mà resolver cần — không phụ thuộc kiểu data. */
-export type CatalogReader = Pick<Catalog<unknown>, 'id' | 'describe' | 'readVariable' | 'readCollection'>;
-
 /** 1 tầng scope: data gốc, hoặc 1 phần tử đang lặp. */
 export interface ScopeFrame {
   /** Collection của phần tử; `null` là data gốc. */
@@ -63,11 +60,11 @@ export const COUNTING_PAGE: PageInfo = { pageNumber: 1, pageCount: 1 };
 
 /** Trạng thái khi resolve 1 node. */
 export interface ResolveContext {
-  /** Catalog dùng để đọc biến/collection từ data. */
-  readonly catalog: CatalogReader;
+  /** TemplateDataDefinition dùng để đọc biến/collection từ data. */
+  readonly catalog: TemplateDataDefinition<unknown>;
 
   /** Bảng tra biến/collection dựng từ `catalog.describe()`. */
-  readonly index: CatalogIndex;
+  readonly index: TemplateDataIndex;
 
   /** Nguồn tra bitmap ảnh. */
   readonly assets: AssetProvider;
diff --git a/packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts b/packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
index d3ee5eb..ea60be8 100644
--- a/packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
+++ b/packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
@@ -1,8 +1,8 @@
 import { createDocumentResolver, type AssetProvider, type ResolvedNode, type ResolvedPage } from '..';
-import { defineCatalog, defineCollection } from '../../catalog';
+import { defineTemplateData, defineCollection } from '../../template/data';
 import type { TemplateDocument, TemplateMedia, TemplateNode, TextNode } from '../../template';
 import {
-  TEST_ORDER_CATALOG,
+  TEST_ORDER_DATA,
   TEST_ORDER_SAMPLE,
   type TestOrder,
   type TestOrderItem,
@@ -34,7 +34,7 @@ function resolvePages(
   data: TestOrder = TEST_ORDER_SAMPLE,
   assets: AssetProvider = NO_ASSETS,
 ): readonly ResolvedPage[] {
-  return resolver.resolve(documentWith(root), data, { catalog: TEST_ORDER_CATALOG, assets });
+  return resolver.resolve(documentWith(root), data, { catalog: TEST_ORDER_DATA, assets });
 }
 
 /** Mọi chuỗi text trong cây, theo thứ tự duyệt. */
@@ -147,7 +147,7 @@ describe('DocumentResolver — scope tường minh', () => {
       get: (order: { readonly lines: readonly { readonly code: string }[] }) => order.lines,
       variables: { lineCode: { label: 'Mã dòng', type: 'string', get: (line) => line.code } },
     });
-    const catalog = defineCatalog({
+    const catalog = defineTemplateData({
       id: 'shadow',
       version: 1,
       sample: { code: 'ORDER', lines: [{ code: 'LINE' }] },
@@ -683,7 +683,7 @@ describe('DocumentResolver — catalog', () => {
   it('throw khi template dùng catalog khác catalog truyền vào', () => {
     const template = { ...documentWith({ type: 'text', id: 't', content: [] }), catalog: 'kitchen' };
 
-    const options = { catalog: TEST_ORDER_CATALOG, assets: NO_ASSETS };
+    const options = { catalog: TEST_ORDER_DATA, assets: NO_ASSETS };
 
     expect(() => resolver.resolve(template, TEST_ORDER_SAMPLE, options)).toThrow(
       'Template dùng catalog "kitchen", không phải "test-order"',
diff --git a/packages/printer-core/src/resolution/__tests__/collectAssetIds.test.ts b/packages/printer-core/src/resolution/__tests__/collectAssetIds.test.ts
index 35c0449..550952b 100644
--- a/packages/printer-core/src/resolution/__tests__/collectAssetIds.test.ts
+++ b/packages/printer-core/src/resolution/__tests__/collectAssetIds.test.ts
@@ -1,6 +1,6 @@
 import { collectAssetIds } from '..';
 import type { TemplateDocument } from '../../template';
-import { TEST_ORDER_CATALOG, TEST_ORDER_SAMPLE } from '../../testing';
+import { TEST_ORDER_DATA, TEST_ORDER_SAMPLE } from '../../testing';
 
 const TEMPLATE: TemplateDocument = {
   schemaVersion: 1,
@@ -34,7 +34,7 @@ const TEMPLATE: TemplateDocument = {
 
 describe('collectAssetIds', () => {
   it('thu asset tĩnh + giá trị biến asset, bỏ qua điều kiện ẩn/hiện, không trùng lặp', () => {
-    expect(collectAssetIds(TEMPLATE, TEST_ORDER_CATALOG, TEST_ORDER_SAMPLE)).toEqual([
+    expect(collectAssetIds(TEMPLATE, TEST_ORDER_DATA, TEST_ORDER_SAMPLE)).toEqual([
       'store-logo@v1',
       'icon@v1',
       'cup@v2',
@@ -44,6 +44,6 @@ describe('collectAssetIds', () => {
   it('bỏ qua biến asset rỗng', () => {
     const noLogo = { ...TEST_ORDER_SAMPLE, storeLogo: undefined };
 
-    expect(collectAssetIds(TEMPLATE, TEST_ORDER_CATALOG, noLogo)).toEqual(['icon@v1', 'cup@v2']);
+    expect(collectAssetIds(TEMPLATE, TEST_ORDER_DATA, noLogo)).toEqual(['icon@v1', 'cup@v2']);
   });
 });
diff --git a/packages/printer-core/src/resolution/collectAssetIds.ts b/packages/printer-core/src/resolution/collectAssetIds.ts
index 093040f..3eb585c 100644
--- a/packages/printer-core/src/resolution/collectAssetIds.ts
+++ b/packages/printer-core/src/resolution/collectAssetIds.ts
@@ -1,4 +1,4 @@
-import { createCatalogIndex, type Catalog } from '../catalog';
+import { createTemplateDataIndex, type TemplateDataDefinition } from '../template/data';
 import type { ImageNode, RepeatNode, TemplateDocument, TemplateNode } from '../template';
 import type { AssetProvider } from './AssetProvider';
 import { readCollectionItems } from './readRepeatEntries';
@@ -15,12 +15,12 @@ const NO_ASSETS: AssetProvider = { get: () => undefined };
  */
 export function collectAssetIds<TData>(
   template: TemplateDocument,
-  catalog: Catalog<TData>,
+  catalog: TemplateDataDefinition<TData>,
   data: TData,
 ): readonly string[] {
   const context: ResolveContext = {
     catalog,
-    index: createCatalogIndex(catalog.describe()),
+    index: createTemplateDataIndex(catalog.describe()),
     assets: NO_ASSETS,
     frames: [createRootFrame(data)],
     page: COUNTING_PAGE,
diff --git a/packages/printer-core/src/resolution/readRepeatEntries.ts b/packages/printer-core/src/resolution/readRepeatEntries.ts
index 924b349..1ca8a99 100644
--- a/packages/printer-core/src/resolution/readRepeatEntries.ts
+++ b/packages/printer-core/src/resolution/readRepeatEntries.ts
@@ -1,5 +1,5 @@
 import type { RepeatNode } from '../template';
-import { readFromCatalog } from './readVariable';
+import { readFromTemplateData } from './readVariable';
 import { findScopeFrame, type ResolveContext, type ScopeFrame } from './ResolveContext';
 import { ResolveError } from './ResolveError';
 
@@ -52,7 +52,7 @@ export function readCollectionItems(node: RepeatNode, context: ResolveContext):
     throw new ResolveError(node.id, message);
   }
 
-  const items = readFromCatalog(node.id, node.collection, () =>
+  const items = readFromTemplateData(node.id, node.collection, () =>
     context.catalog.readCollection(node.collection, parentFrame.item),
   );
   if (!Array.isArray(items)) throw new ResolveError(node.id, `collection "${node.collection}" không phải mảng`);
@@ -82,7 +82,7 @@ function readExpandCount(
   item: unknown,
   context: ResolveContext,
 ): number {
-  const count = readFromCatalog(node.id, expand, () => context.catalog.readVariable(expand, item));
+  const count = readFromTemplateData(node.id, expand, () => context.catalog.readVariable(expand, item));
   if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
     throw new ResolveError(node.id, `expand "${expand}" phải là số nguyên dương, nhận "${String(count)}"`);
   }
diff --git a/packages/printer-core/src/resolution/readVariable.ts b/packages/printer-core/src/resolution/readVariable.ts
index d119156..a9dd0c5 100644
--- a/packages/printer-core/src/resolution/readVariable.ts
+++ b/packages/printer-core/src/resolution/readVariable.ts
@@ -3,7 +3,7 @@ import {
   isBuiltInVariableName,
   type BuiltInVariableName,
   type VariableType,
-} from '../catalog';
+} from '../template/data';
 import { findScopeFrame, innermostFrame, type ResolveContext } from './ResolveContext';
 import { errorMessage, ResolveError } from './ResolveError';
 
@@ -40,7 +40,7 @@ export function readVariableValue(
   const frame = findScopeFrame(context, variable.collection);
   if (!frame) throw new ResolveError(nodeId, `biến "${name}" chỉ dùng được trong vòng lặp "${variable.collection}"`);
 
-  return readFromCatalog(nodeId, name, () => context.catalog.readVariable(name, frame.item));
+  return readFromTemplateData(nodeId, name, () => context.catalog.readVariable(name, frame.item));
 }
 
 /** Chặn biến có sẵn dùng sai scope (VD `$position` ở ngoài repeat) — nếu không sẽ âm thầm in giá trị `0`. */
@@ -69,7 +69,7 @@ export function isOptionalVariable(context: ResolveContext, name: string): boole
 }
 
 /** Gọi hàm `get` của catalog; lỗi trong `get` (data sai cấu trúc) thành lỗi trang thay vì làm hỏng cả lần in. */
-export function readFromCatalog(
+export function readFromTemplateData(
   nodeId: string,
   name: string,
   read: () => unknown,
diff --git a/packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts b/packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts
index 1108ccd..ffc9430 100644
--- a/packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts
+++ b/packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts
@@ -1,5 +1,5 @@
-import type { CatalogDescription } from '../../catalog';
-import { validateTemplateAgainstCatalog, validateTemplateStructure, type TemplateIssue } from '../parse';
+import type { TemplateDataDescription } from '../data';
+import { validateTemplateAgainstData, validateTemplateStructure, type TemplateIssue } from '../parse';
 import {
   TEMPLATE_SCHEMA_VERSION,
   type PaperSize,
@@ -11,7 +11,7 @@ import type { TemplateNodeBuilder } from './NodeBuilder';
 import { TemplateScope } from './TemplateScope';
 
 /** Phần catalog mà DSL cần: tên biến/collection để kiểm tra kiểu, `id` + `describe()` để validate. */
-export interface CatalogShape {
+export interface TemplateDataShape {
   readonly id: string;
 
   /** Biến gốc — chỉ dùng phần kiểu (tên biến) để TypeScript kiểm tra DSL, không đọc giá trị. */
@@ -21,13 +21,13 @@ export interface CatalogShape {
   readonly collections: object;
 
   /** Metadata JSON thuần dùng để validate template lúc `build()`. */
-  describe(): CatalogDescription;
+  describe(): TemplateDataDescription;
 }
 
 /** Scope gốc của template: biến gốc + collection cấp 1 của catalog. */
-export type RootScope<TCatalog extends CatalogShape> = TemplateScope<
-  Extract<keyof TCatalog['variables'], string>,
-  TCatalog['collections']
+export type RootScope<TTemplateData extends TemplateDataShape> = TemplateScope<
+  Extract<keyof TTemplateData['variables'], string>,
+  TTemplateData['collections']
 >;
 
 /** Khổ giấy theo loại: label bắt buộc có chiều cao, receipt không có. */
@@ -36,9 +36,9 @@ export type PaperFor<TMedia extends TemplateMedia> = TMedia extends 'label'
   : Omit<PaperSize, 'heightMm'>;
 
 /** Nội dung gốc: 1 builder, hoặc callback nhận scope gốc để dùng `scope.var`/`scope.repeat`. */
-export type RootContent<TCatalog extends CatalogShape> =
+export type RootContent<TTemplateData extends TemplateDataShape> =
   | TemplateNodeBuilder
-  | ((scope: RootScope<TCatalog>) => TemplateNodeBuilder);
+  | ((scope: RootScope<TTemplateData>) => TemplateNodeBuilder);
 
 /** Lỗi khi `build()` gặp template không hợp lệ; `issues` chứa từng lỗi kèm vị trí. */
 export class TemplateBuildError extends Error {
@@ -50,17 +50,17 @@ export class TemplateBuildError extends Error {
 }
 
 /** Builder của `TemplateDocument`; tạo qua `labelTemplate(catalog)` hoặc `receiptTemplate(catalog)`. */
-export class TemplateDocumentBuilder<TCatalog extends CatalogShape, TMedia extends TemplateMedia> {
+export class TemplateDocumentBuilder<TTemplateData extends TemplateDataShape, TMedia extends TemplateMedia> {
   private templateId?: string;
 
   private templateName?: string;
 
   private paperSize?: PaperFor<TMedia>;
 
-  private rootContent?: RootContent<TCatalog>;
+  private rootContent?: RootContent<TTemplateData>;
 
   constructor(
-    private readonly catalog: TCatalog,
+    private readonly catalog: TTemplateData,
     private readonly media: TMedia,
   ) {}
 
@@ -83,7 +83,7 @@ export class TemplateDocumentBuilder<TCatalog extends CatalogShape, TMedia exten
   }
 
   /** Node gốc (bắt buộc). */
-  root(content: RootContent<TCatalog>): this {
+  root(content: RootContent<TTemplateData>): this {
     this.rootContent = content;
     return this;
   }
@@ -97,7 +97,7 @@ export class TemplateDocumentBuilder<TCatalog extends CatalogShape, TMedia exten
     const structureIssues = validateTemplateStructure(document);
     if (structureIssues.length > 0) throw new TemplateBuildError(structureIssues);
 
-    const catalogResult = validateTemplateAgainstCatalog(document, this.catalog.describe());
+    const catalogResult = validateTemplateAgainstData(document, this.catalog.describe());
     if (catalogResult.errors.length > 0) throw new TemplateBuildError(catalogResult.errors);
 
     return Object.freeze(document);
@@ -127,15 +127,15 @@ export class TemplateDocumentBuilder<TCatalog extends CatalogShape, TMedia exten
 }
 
 /** Template tem nhãn (chiều cao cố định, có phân trang) dùng biến của `catalog`. */
-export function labelTemplate<TCatalog extends CatalogShape>(
-  catalog: TCatalog,
-): TemplateDocumentBuilder<TCatalog, 'label'> {
+export function labelTemplate<TTemplateData extends TemplateDataShape>(
+  catalog: TTemplateData,
+): TemplateDocumentBuilder<TTemplateData, 'label'> {
   return new TemplateDocumentBuilder(catalog, 'label');
 }
 
 /** Template hoá đơn giấy cuộn dùng biến của `catalog`. */
-export function receiptTemplate<TCatalog extends CatalogShape>(
-  catalog: TCatalog,
-): TemplateDocumentBuilder<TCatalog, 'receipt'> {
+export function receiptTemplate<TTemplateData extends TemplateDataShape>(
+  catalog: TTemplateData,
+): TemplateDocumentBuilder<TTemplateData, 'receipt'> {
   return new TemplateDocumentBuilder(catalog, 'receipt');
 }
diff --git a/packages/printer-core/src/template/builder/TemplateScope.ts b/packages/printer-core/src/template/builder/TemplateScope.ts
index 20705e1..deeb526 100644
--- a/packages/printer-core/src/template/builder/TemplateScope.ts
+++ b/packages/printer-core/src/template/builder/TemplateScope.ts
@@ -1,4 +1,4 @@
-import type { BuiltInVariableName } from '../../catalog';
+import type { BuiltInVariableName } from '../data';
 import type { VariableSegment } from '../content/Segment';
 import type { ValueFormat } from '../content/ValueFormat';
 import type { TemplateNodeBuilder } from './NodeBuilder';
diff --git a/packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts b/packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts
index 7da434e..679a83c 100644
--- a/packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts
+++ b/packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts
@@ -11,10 +11,10 @@ import {
   text,
   TemplateBuildError,
 } from '../..';
-import { TEST_ORDER_CATALOG } from '../../../testing';
+import { TEST_ORDER_DATA } from '../../../testing';
 
 function buildProductLabel() {
-  return labelTemplate(TEST_ORDER_CATALOG)
+  return labelTemplate(TEST_ORDER_DATA)
     .id('product-label-default')
     .name('Tem món mặc định')
     .paper({ widthMm: 50, heightMm: 30 })
@@ -89,7 +89,7 @@ describe('labelTemplate / receiptTemplate', () => {
   });
 
   it('receipt không có chiều cao giấy', () => {
-    const template = receiptTemplate(TEST_ORDER_CATALOG)
+    const template = receiptTemplate(TEST_ORDER_DATA)
       .id('receipt')
       .name('Hoá đơn')
       .paper({ widthMm: 72 })
@@ -101,7 +101,7 @@ describe('labelTemplate / receiptTemplate', () => {
   });
 
   it('throw TemplateBuildError khi segment viết tay dùng biến sai scope', () => {
-    const builder = receiptTemplate(TEST_ORDER_CATALOG)
+    const builder = receiptTemplate(TEST_ORDER_DATA)
       .id('receipt')
       .name('Hoá đơn')
       .paper({ widthMm: 72 })
@@ -113,7 +113,7 @@ describe('labelTemplate / receiptTemplate', () => {
 
   it('không throw khi chỉ có cảnh báo deprecated', () => {
     const build = () =>
-      receiptTemplate(TEST_ORDER_CATALOG)
+      receiptTemplate(TEST_ORDER_DATA)
         .id('receipt')
         .name('Hoá đơn')
         .paper({ widthMm: 72 })
@@ -124,10 +124,10 @@ describe('labelTemplate / receiptTemplate', () => {
   });
 
   it('throw khi thiếu id, name, paper hoặc root', () => {
-    expect(() => receiptTemplate(TEST_ORDER_CATALOG).build()).toThrow('Template cần .id(...)');
-    expect(() => receiptTemplate(TEST_ORDER_CATALOG).id('x').build()).toThrow('Template cần .name(...)');
-    expect(() => receiptTemplate(TEST_ORDER_CATALOG).id('x').name('x').build()).toThrow('Template cần .paper(...)');
-    expect(() => receiptTemplate(TEST_ORDER_CATALOG).id('x').name('x').paper({ widthMm: 72 }).build()).toThrow(
+    expect(() => receiptTemplate(TEST_ORDER_DATA).build()).toThrow('Template cần .id(...)');
+    expect(() => receiptTemplate(TEST_ORDER_DATA).id('x').build()).toThrow('Template cần .name(...)');
+    expect(() => receiptTemplate(TEST_ORDER_DATA).id('x').name('x').build()).toThrow('Template cần .paper(...)');
+    expect(() => receiptTemplate(TEST_ORDER_DATA).id('x').name('x').paper({ widthMm: 72 }).build()).toThrow(
       'Template cần .root(...)',
     );
   });
@@ -135,11 +135,11 @@ describe('labelTemplate / receiptTemplate', () => {
   it('TypeScript chặn tên biến sai, biến sai scope và khổ giấy sai loại', () => {
     const checkTypesOnly = () => {
       // @ts-expect-error label bắt buộc heightMm
-      labelTemplate(TEST_ORDER_CATALOG).paper({ widthMm: 50 });
+      labelTemplate(TEST_ORDER_DATA).paper({ widthMm: 50 });
       // @ts-expect-error receipt không có heightMm
-      receiptTemplate(TEST_ORDER_CATALOG).paper({ widthMm: 72, heightMm: 30 });
+      receiptTemplate(TEST_ORDER_DATA).paper({ widthMm: 72, heightMm: 30 });
 
-      receiptTemplate(TEST_ORDER_CATALOG).root((scope) => {
+      receiptTemplate(TEST_ORDER_DATA).root((scope) => {
         // @ts-expect-error tên biến sai
         scope.var('orderCod');
         // @ts-expect-error biến của collection không dùng được ở gốc
@@ -159,7 +159,7 @@ describe('labelTemplate / receiptTemplate', () => {
   });
 
   it('maxItemsPerPage trên repeat lồng và biến $part/$partCount ra đúng JSON, qua được parseTemplate', () => {
-    const template = labelTemplate(TEST_ORDER_CATALOG)
+    const template = labelTemplate(TEST_ORDER_DATA)
       .id('split-label')
       .name('Tem tách topping')
       .paper({ widthMm: 50, heightMm: 30 })
diff --git a/packages/printer-core/src/template/builder/index.ts b/packages/printer-core/src/template/builder/index.ts
index edb4ec9..54591bb 100644
--- a/packages/printer-core/src/template/builder/index.ts
+++ b/packages/printer-core/src/template/builder/index.ts
@@ -16,7 +16,7 @@ export {
   receiptTemplate,
   TemplateDocumentBuilder,
   TemplateBuildError,
-  type CatalogShape,
+  type TemplateDataShape,
   type RootScope,
   type PaperFor,
   type RootContent,
diff --git a/packages/printer-core/src/template/data/CollectionDefinition.ts b/packages/printer-core/src/template/data/CollectionDefinition.ts
index cd578f6..621243d 100644
--- a/packages/printer-core/src/template/data/CollectionDefinition.ts
+++ b/packages/printer-core/src/template/data/CollectionDefinition.ts
@@ -1,11 +1,11 @@
-import type { VariableSpecMap } from './VariableSpec';
+import type { VariableDefinitionMap } from './VariableDefinition';
 
 /** 1 danh sách lặp được trong catalog (VD danh sách món), kèm biến và collection con của từng phần tử. */
-export interface CatalogCollection<
+export interface CollectionDefinition<
   TSource,
   TItem,
-  TVariables extends VariableSpecMap<TItem> = VariableSpecMap<TItem>,
-  TCollections extends CatalogCollectionMap<TItem> = CatalogCollectionMap<TItem>,
+  TVariables extends VariableDefinitionMap<TItem> = VariableDefinitionMap<TItem>,
+  TCollections extends CollectionDefinitionMap<TItem> = CollectionDefinitionMap<TItem>,
 > {
   /** Tên hiển thị, VD 'Danh sách món'. */
   readonly label: string;
@@ -21,15 +21,15 @@ export interface CatalogCollection<
 }
 
 /** Tập collection theo tên của 1 scope. */
-export interface CatalogCollectionMap<TSource> {
-  readonly [name: string]: CatalogCollection<TSource, unknown>;
+export interface CollectionDefinitionMap<TSource> {
+  readonly [name: string]: CollectionDefinition<TSource, unknown>;
 }
 
 /** Tập collection rỗng — kiểu mặc định khi scope không có collection con. */
 export type EmptyCollectionMap = Readonly<Record<never, never>>;
 
-/** Input của `defineCollection`: giống `CatalogCollection` nhưng được bỏ trống `collections`. */
-export interface CollectionDefinition<TSource, TItem, TVariables, TCollections> {
+/** Input của `defineCollection`: giống `CollectionDefinition` nhưng được bỏ trống `collections`. */
+export interface CollectionDefinitionInput<TSource, TItem, TVariables, TCollections> {
   /** Tên hiển thị, VD 'Danh sách món'. */
   readonly label: string;
 
@@ -50,12 +50,12 @@ export interface CollectionDefinition<TSource, TItem, TVariables, TCollections>
 export function defineCollection<
   TSource,
   TItem,
-  TVariables extends VariableSpecMap<TItem>,
-  TCollections extends CatalogCollectionMap<TItem> = EmptyCollectionMap,
+  TVariables extends VariableDefinitionMap<TItem>,
+  TCollections extends CollectionDefinitionMap<TItem> = EmptyCollectionMap,
 >(
-  definition: CollectionDefinition<TSource, TItem, TVariables, TCollections>,
-): NoInfer<CatalogCollection<TSource, TItem, TVariables, TCollections>> {
-  // NoInfer: khi khai báo lồng trong defineCatalog, kiểu mong đợi ở chỗ gọi có phần tử `unknown`
+  definition: CollectionDefinitionInput<TSource, TItem, TVariables, TCollections>,
+): NoInfer<CollectionDefinition<TSource, TItem, TVariables, TCollections>> {
+  // NoInfer: khi khai báo lồng trong defineTemplateData, kiểu mong đợi ở chỗ gọi có phần tử `unknown`
   // và sẽ lấn át kiểu suy từ `get` nếu không chặn.
   return {
     label: definition.label,
diff --git a/packages/printer-core/src/template/data/TemplateDataDefinition.ts b/packages/printer-core/src/template/data/TemplateDataDefinition.ts
index 769a60d..bb5e99f 100644
--- a/packages/printer-core/src/template/data/TemplateDataDefinition.ts
+++ b/packages/printer-core/src/template/data/TemplateDataDefinition.ts
@@ -1,13 +1,13 @@
-import type { CatalogCollectionMap } from './CatalogCollection';
-import type { CatalogDescription } from './CatalogDescription';
+import type { CollectionDefinitionMap } from './CollectionDefinition';
+import type { TemplateDataDescription } from './TemplateDataDescription';
 import type { TemplateDataReader } from './TemplateDataReader';
-import type { VariableSpecMap } from './VariableSpec';
+import type { VariableDefinitionMap } from './VariableDefinition';
 
-/** Catalog đã khai báo — cầu nối duy nhất giữa template và data nội bộ của app. */
-export interface Catalog<
+/** TemplateDataDefinition đã khai báo — cầu nối duy nhất giữa template và data nội bộ của app. */
+export interface TemplateDataDefinition<
   TData,
-  TVariables extends VariableSpecMap<TData> = VariableSpecMap<TData>,
-  TCollections extends CatalogCollectionMap<TData> = CatalogCollectionMap<TData>,
+  TVariables extends VariableDefinitionMap<TData> = VariableDefinitionMap<TData>,
+  TCollections extends CollectionDefinitionMap<TData> = CollectionDefinitionMap<TData>,
 > extends TemplateDataReader {
   /** Mã catalog, VD 'product-label'; template tham chiếu qua `TemplateDocument.catalog`. */
   readonly id: string;
@@ -25,11 +25,11 @@ export interface Catalog<
   readonly collections: TCollections;
 
   /** Metadata JSON thuần (không có hàm) cho designer/BE và cho validate template. */
-  describe(): CatalogDescription;
+  describe(): TemplateDataDescription;
 }
 
-/** Input của `defineCatalog`. */
-export interface CatalogDefinition<TData, TVariables, TCollections> {
+/** Input của `defineTemplateData`. */
+export interface TemplateDataDefinitionInput<TData, TVariables, TCollections> {
   /** Mã catalog, VD 'product-label'. */
   readonly id: string;
 
diff --git a/packages/printer-core/src/template/data/TemplateDataDescription.ts b/packages/printer-core/src/template/data/TemplateDataDescription.ts
index 24339c4..17a6033 100644
--- a/packages/printer-core/src/template/data/TemplateDataDescription.ts
+++ b/packages/printer-core/src/template/data/TemplateDataDescription.ts
@@ -34,7 +34,7 @@ export interface CollectionDescription {
 }
 
 /** Metadata JSON của cả catalog — kết quả của `catalog.describe()`. */
-export interface CatalogDescription {
+export interface TemplateDataDescription {
   /** Mã catalog, khớp với `TemplateDocument.catalog`. */
   readonly id: string;
 
diff --git a/packages/printer-core/src/template/data/TemplateDataIndex.ts b/packages/printer-core/src/template/data/TemplateDataIndex.ts
index ff1b336..8e8448d 100644
--- a/packages/printer-core/src/template/data/TemplateDataIndex.ts
+++ b/packages/printer-core/src/template/data/TemplateDataIndex.ts
@@ -1,4 +1,4 @@
-import type { CatalogDescription, CollectionDescription, VariableDescription } from './CatalogDescription';
+import type { TemplateDataDescription, CollectionDescription, VariableDescription } from './TemplateDataDescription';
 
 /** 1 biến trong bảng tra, kèm collection sở hữu. */
 export interface IndexedVariable {
@@ -19,7 +19,7 @@ export interface IndexedCollection {
 }
 
 /** Bảng tra phẳng theo tên, dựng từ metadata — dùng chung cho resolver, validate và designer/BE. */
-export interface CatalogIndex {
+export interface TemplateDataIndex {
   /** Mọi biến ở mọi cấp, theo tên. */
   readonly variables: ReadonlyMap<string, IndexedVariable>;
 
@@ -27,20 +27,20 @@ export interface CatalogIndex {
   readonly collections: ReadonlyMap<string, IndexedCollection>;
 }
 
-interface MutableCatalogIndex {
+interface MutableTemplateDataIndex {
   readonly variables: Map<string, IndexedVariable>;
   readonly collections: Map<string, IndexedCollection>;
 }
 
 /** Dựng bảng tra từ `catalog.describe()`. */
-export function createCatalogIndex(description: CatalogDescription): CatalogIndex {
-  const index: MutableCatalogIndex = { variables: new Map(), collections: new Map() };
+export function createTemplateDataIndex(description: TemplateDataDescription): TemplateDataIndex {
+  const index: MutableTemplateDataIndex = { variables: new Map(), collections: new Map() };
   indexScope(index, description.variables, description.collections, null);
   return index;
 }
 
 function indexScope(
-  index: MutableCatalogIndex,
+  index: MutableTemplateDataIndex,
   variables: readonly VariableDescription[],
   collections: readonly CollectionDescription[],
   owner: string | null,
diff --git a/packages/printer-core/src/template/data/TemplateDataReader.ts b/packages/printer-core/src/template/data/TemplateDataReader.ts
index 3db8ac9..a2616d0 100644
--- a/packages/printer-core/src/template/data/TemplateDataReader.ts
+++ b/packages/printer-core/src/template/data/TemplateDataReader.ts
@@ -1,6 +1,6 @@
 import { RESERVED_NAME_PREFIX } from './BuiltInVariable';
-import type { CatalogCollection, CatalogCollectionMap } from './CatalogCollection';
-import type { VariableSpec, VariableSpecMap } from './VariableSpec';
+import type { CollectionDefinition, CollectionDefinitionMap } from './CollectionDefinition';
+import type { VariableDefinition, VariableDefinitionMap } from './VariableDefinition';
 
 /** Đọc giá trị biến/collection theo tên lúc chạy — resolver chỉ biết tên, không biết kiểu data. */
 export interface TemplateDataReader {
@@ -13,14 +13,14 @@ export interface TemplateDataReader {
 
 /** Bảng tra phẳng tên → khai báo ở mọi cấp. */
 interface NameLookup {
-  readonly variables: Map<string, VariableSpec<unknown>>;
-  readonly collections: Map<string, CatalogCollection<unknown, unknown>>;
+  readonly variables: Map<string, VariableDefinition<unknown>>;
+  readonly collections: Map<string, CollectionDefinition<unknown, unknown>>;
 }
 
 /** Dựng reader từ biến/collection đã khai báo; throw nếu tên trùng ở bất kỳ cấp nào hoặc dùng tiền tố `$`. */
 export function createTemplateDataReader(
-  variables: VariableSpecMap<unknown>,
-  collections: CatalogCollectionMap<unknown>,
+  variables: VariableDefinitionMap<unknown>,
+  collections: CollectionDefinitionMap<unknown>,
 ): TemplateDataReader {
   const lookup: NameLookup = { variables: new Map(), collections: new Map() };
   registerScope(lookup, variables, collections);
@@ -33,8 +33,8 @@ export function createTemplateDataReader(
 
 function registerScope(
   lookup: NameLookup,
-  variables: VariableSpecMap<unknown>,
-  collections: CatalogCollectionMap<unknown>,
+  variables: VariableDefinitionMap<unknown>,
+  collections: CollectionDefinitionMap<unknown>,
 ): void {
   for (const [name, spec] of Object.entries(variables)) {
     assertNameAvailable(lookup, name);
diff --git a/packages/printer-core/src/template/data/VariableDefinition.ts b/packages/printer-core/src/template/data/VariableDefinition.ts
index 15392be..8ed8213 100644
--- a/packages/printer-core/src/template/data/VariableDefinition.ts
+++ b/packages/printer-core/src/template/data/VariableDefinition.ts
@@ -1,7 +1,7 @@
 import type { VariableType } from './VariableType';
 
 /** Khai báo 1 biến trong catalog: tên hiển thị, kiểu, và cách lấy giá trị từ data nguồn. */
-export interface VariableSpec<TSource> {
+export interface VariableDefinition<TSource> {
   /** Tên hiển thị cho người dùng, VD 'Tên bàn'. */
   readonly label: string;
 
@@ -23,4 +23,4 @@ export interface VariableSpec<TSource> {
 }
 
 /** Tập biến theo tên của 1 scope (data gốc hoặc phần tử của 1 collection). */
-export type VariableSpecMap<TSource> = Readonly<Record<string, VariableSpec<TSource>>>;
+export type VariableDefinitionMap<TSource> = Readonly<Record<string, VariableDefinition<TSource>>>;
diff --git a/packages/printer-core/src/template/data/__tests__/TemplateDataIndex.test.ts b/packages/printer-core/src/template/data/__tests__/TemplateDataIndex.test.ts
index b586153..6615dc9 100644
--- a/packages/printer-core/src/template/data/__tests__/TemplateDataIndex.test.ts
+++ b/packages/printer-core/src/template/data/__tests__/TemplateDataIndex.test.ts
@@ -1,8 +1,8 @@
-import { createCatalogIndex, isBuiltInVariableName } from '..';
-import { TEST_ORDER_CATALOG } from '../../testing';
+import { createTemplateDataIndex, isBuiltInVariableName } from '..';
+import { TEST_ORDER_DATA } from '../../../testing';
 
-describe('createCatalogIndex', () => {
-  const index = createCatalogIndex(TEST_ORDER_CATALOG.describe());
+describe('createTemplateDataIndex', () => {
+  const index = createTemplateDataIndex(TEST_ORDER_DATA.describe());
 
   it('ghi collection sở hữu của từng biến', () => {
     expect(index.variables.get('orderCode')?.collection).toBeNull();
diff --git a/packages/printer-core/src/template/data/__tests__/defineTemplateData.test.ts b/packages/printer-core/src/template/data/__tests__/defineTemplateData.test.ts
index f5be1cf..fbb03d8 100644
--- a/packages/printer-core/src/template/data/__tests__/defineTemplateData.test.ts
+++ b/packages/printer-core/src/template/data/__tests__/defineTemplateData.test.ts
@@ -1,24 +1,24 @@
-import { defineCatalog, defineCollection } from '..';
-import { TEST_ORDER_CATALOG, TEST_ORDER_SAMPLE } from '../../testing';
+import { defineTemplateData, defineCollection } from '..';
+import { TEST_ORDER_DATA, TEST_ORDER_SAMPLE } from '../../../testing';
 
-describe('defineCatalog', () => {
+describe('defineTemplateData', () => {
   it('đọc giá trị biến gốc và biến tính toán của collection', () => {
     const firstItem = TEST_ORDER_SAMPLE.items[0];
 
-    expect(TEST_ORDER_CATALOG.readVariable('orderCode', TEST_ORDER_SAMPLE)).toBe('HD001');
-    expect(TEST_ORDER_CATALOG.readVariable('itemTotal', firstItem)).toBe(135000);
+    expect(TEST_ORDER_DATA.readVariable('orderCode', TEST_ORDER_SAMPLE)).toBe('HD001');
+    expect(TEST_ORDER_DATA.readVariable('itemTotal', firstItem)).toBe(135000);
   });
 
   it('đọc mảng phần tử của collection cấp 1 và collection lồng', () => {
     const firstItem = TEST_ORDER_SAMPLE.items[0];
 
-    expect(TEST_ORDER_CATALOG.readCollection('items', TEST_ORDER_SAMPLE)).toHaveLength(2);
-    expect(TEST_ORDER_CATALOG.readCollection('toppings', firstItem)).toEqual([{ name: 'Trân châu', price: 5000 }]);
+    expect(TEST_ORDER_DATA.readCollection('items', TEST_ORDER_SAMPLE)).toHaveLength(2);
+    expect(TEST_ORDER_DATA.readCollection('toppings', firstItem)).toEqual([{ name: 'Trân châu', price: 5000 }]);
   });
 
   it('throw khi đọc biến hoặc collection không tồn tại', () => {
-    expect(() => TEST_ORDER_CATALOG.readVariable('missing', TEST_ORDER_SAMPLE)).toThrow('không có biến "missing"');
-    expect(() => TEST_ORDER_CATALOG.readCollection('missing', TEST_ORDER_SAMPLE)).toThrow(
+    expect(() => TEST_ORDER_DATA.readVariable('missing', TEST_ORDER_SAMPLE)).toThrow('không có biến "missing"');
+    expect(() => TEST_ORDER_DATA.readCollection('missing', TEST_ORDER_SAMPLE)).toThrow(
       'không có collection "missing"',
     );
   });
@@ -31,7 +31,7 @@ describe('defineCatalog', () => {
     });
 
     expect(() =>
-      defineCatalog({
+      defineTemplateData({
         id: 'duplicate',
         version: 1,
         sample: { name: 'A', items: [] as readonly string[] },
@@ -49,7 +49,7 @@ describe('defineCatalog', () => {
     });
 
     expect(() =>
-      defineCatalog({
+      defineTemplateData({
         id: 'duplicate',
         version: 1,
         sample: { items: [] as readonly string[] },
@@ -61,7 +61,7 @@ describe('defineCatalog', () => {
 
   it('throw khi tên biến bắt đầu bằng "$"', () => {
     expect(() =>
-      defineCatalog({
+      defineTemplateData({
         id: 'reserved',
         version: 1,
         sample: {},
@@ -71,7 +71,7 @@ describe('defineCatalog', () => {
   });
 
   it('describe() trả metadata JSON thuần, không lộ hàm get', () => {
-    const description = TEST_ORDER_CATALOG.describe();
+    const description = TEST_ORDER_DATA.describe();
 
     expect(JSON.parse(JSON.stringify(description))).toEqual(description);
     expect(description.variables.map((variable) => variable.name)).toEqual([
diff --git a/packages/printer-core/src/template/data/defineTemplateData.ts b/packages/printer-core/src/template/data/defineTemplateData.ts
index ed018d3..7856f73 100644
--- a/packages/printer-core/src/template/data/defineTemplateData.ts
+++ b/packages/printer-core/src/template/data/defineTemplateData.ts
@@ -1,18 +1,20 @@
-import type { Catalog, CatalogDefinition } from './Catalog';
-import type { CatalogCollectionMap, EmptyCollectionMap } from './CatalogCollection';
+import type { TemplateDataDefinition, TemplateDataDefinitionInput } from './TemplateDataDefinition';
+import type { CollectionDefinitionMap, EmptyCollectionMap } from './CollectionDefinition';
 import { describeTemplateData } from './describeTemplateData';
 import { createTemplateDataReader } from './TemplateDataReader';
-import type { VariableSpecMap } from './VariableSpec';
+import type { VariableDefinitionMap } from './VariableDefinition';
 
 /**
  * Khai báo catalog cho 1 loại nội dung in. Kiểu data suy ra từ `sample`.
  * Throw ngay nếu tên biến/collection trùng ở bất kỳ cấp nào hoặc bắt đầu bằng `$`.
  */
-export function defineCatalog<
+export function defineTemplateData<
   TData,
-  TVariables extends VariableSpecMap<TData>,
-  TCollections extends CatalogCollectionMap<TData> = EmptyCollectionMap,
->(definition: CatalogDefinition<TData, TVariables, TCollections>): Catalog<TData, TVariables, TCollections> {
+  TVariables extends VariableDefinitionMap<TData>,
+  TCollections extends CollectionDefinitionMap<TData> = EmptyCollectionMap,
+>(
+  definition: TemplateDataDefinitionInput<TData, TVariables, TCollections>,
+): TemplateDataDefinition<TData, TVariables, TCollections> {
   const collections = definition.collections ?? ({} as TCollections);
   const reader = createTemplateDataReader(definition.variables, collections);
   const description = describeTemplateData({
diff --git a/packages/printer-core/src/template/data/describeTemplateData.ts b/packages/printer-core/src/template/data/describeTemplateData.ts
index f68c393..92fc967 100644
--- a/packages/printer-core/src/template/data/describeTemplateData.ts
+++ b/packages/printer-core/src/template/data/describeTemplateData.ts
@@ -1,12 +1,12 @@
-import type { Catalog } from './Catalog';
-import type { CatalogCollectionMap } from './CatalogCollection';
-import type { CatalogDescription, CollectionDescription, VariableDescription } from './CatalogDescription';
-import type { VariableSpec, VariableSpecMap } from './VariableSpec';
+import type { TemplateDataDefinition } from './TemplateDataDefinition';
+import type { CollectionDefinitionMap } from './CollectionDefinition';
+import type { TemplateDataDescription, CollectionDescription, VariableDescription } from './TemplateDataDescription';
+import type { VariableDefinition, VariableDefinitionMap } from './VariableDefinition';
 
 /** Metadata JSON thuần (bỏ mọi hàm `get`) của phần khai báo, cho designer/BE và cho validate template. */
 export function describeTemplateData(
-  definition: Pick<Catalog<unknown>, 'id' | 'version' | 'variables' | 'collections'>,
-): CatalogDescription {
+  definition: Pick<TemplateDataDefinition<unknown>, 'id' | 'version' | 'variables' | 'collections'>,
+): TemplateDataDescription {
   return {
     id: definition.id,
     version: definition.version,
@@ -15,11 +15,11 @@ export function describeTemplateData(
   };
 }
 
-function describeVariables(variables: VariableSpecMap<unknown>): readonly VariableDescription[] {
+function describeVariables(variables: VariableDefinitionMap<unknown>): readonly VariableDescription[] {
   return Object.entries(variables).map(([name, spec]) => describeVariable(name, spec));
 }
 
-function describeCollections(collections: CatalogCollectionMap<unknown>): readonly CollectionDescription[] {
+function describeCollections(collections: CollectionDefinitionMap<unknown>): readonly CollectionDescription[] {
   return Object.entries(collections).map(([name, collection]) => ({
     name,
     label: collection.label,
@@ -28,7 +28,7 @@ function describeCollections(collections: CatalogCollectionMap<unknown>): readon
   }));
 }
 
-function describeVariable(name: string, spec: VariableSpec<unknown>): VariableDescription {
+function describeVariable(name: string, spec: VariableDefinition<unknown>): VariableDescription {
   return {
     name,
     label: spec.label,
diff --git a/packages/printer-core/src/template/data/index.ts b/packages/printer-core/src/template/data/index.ts
index c97be1d..b33e12f 100644
--- a/packages/printer-core/src/template/data/index.ts
+++ b/packages/printer-core/src/template/data/index.ts
@@ -1,9 +1,9 @@
 export * from './VariableType';
-export * from './VariableSpec';
-export * from './CatalogCollection';
-export * from './CatalogDescription';
-export * from './Catalog';
+export * from './VariableDefinition';
+export * from './CollectionDefinition';
+export * from './TemplateDataDescription';
+export * from './TemplateDataDefinition';
 export * from './BuiltInVariable';
-export * from './CatalogIndex';
+export * from './TemplateDataIndex';
 export type { TemplateDataReader } from './TemplateDataReader';
-export { defineCatalog } from './defineCatalog';
+export { defineTemplateData } from './defineTemplateData';
diff --git a/packages/printer-core/src/template/format/formatValue.ts b/packages/printer-core/src/template/format/formatValue.ts
index 5219462..962fba0 100644
--- a/packages/printer-core/src/template/format/formatValue.ts
+++ b/packages/printer-core/src/template/format/formatValue.ts
@@ -1,4 +1,4 @@
-import type { VariableType } from '../../catalog';
+import type { VariableType } from '../data';
 import type { ValueFormat } from '../content/ValueFormat';
 import { formatCurrency } from './formatCurrency';
 import { formatDateTime } from './formatDateTime';
diff --git a/packages/printer-core/src/template/index.ts b/packages/printer-core/src/template/index.ts
index d689576..0b6504d 100644
--- a/packages/printer-core/src/template/index.ts
+++ b/packages/printer-core/src/template/index.ts
@@ -1,4 +1,5 @@
 export * from './TemplateDocument';
+export * from './data';
 export * from './style/Length';
 export * from './style/Dimension';
 export * from './style/Insets';
diff --git a/packages/printer-core/src/template/parse/__tests__/validateTemplateAgainstData.test.ts b/packages/printer-core/src/template/parse/__tests__/validateTemplateAgainstData.test.ts
index 8664bfe..5208248 100644
--- a/packages/printer-core/src/template/parse/__tests__/validateTemplateAgainstData.test.ts
+++ b/packages/printer-core/src/template/parse/__tests__/validateTemplateAgainstData.test.ts
@@ -1,8 +1,8 @@
-import { validateTemplateAgainstCatalog } from '..';
-import { TEST_ORDER_CATALOG } from '../../../testing';
+import { validateTemplateAgainstData } from '..';
+import { TEST_ORDER_DATA } from '../../../testing';
 import type { TemplateDocument, TemplateNode } from '../..';
 
-const description = TEST_ORDER_CATALOG.describe();
+const description = TEST_ORDER_DATA.describe();
 
 function documentWithRoot(root: TemplateNode): TemplateDocument {
   return {
@@ -26,10 +26,10 @@ function repeatItems(template: TemplateNode, expand?: string): TemplateNode {
 }
 
 function errorsOf(root: TemplateNode): readonly string[] {
-  return validateTemplateAgainstCatalog(documentWithRoot(root), description).errors.map((issue) => issue.message);
+  return validateTemplateAgainstData(documentWithRoot(root), description).errors.map((issue) => issue.message);
 }
 
-describe('validateTemplateAgainstCatalog', () => {
+describe('validateTemplateAgainstData', () => {
   it('không có lỗi với template dùng đúng biến và scope', () => {
     const root: TemplateNode = {
       type: 'container',
@@ -54,13 +54,13 @@ describe('validateTemplateAgainstCatalog', () => {
       ],
     };
 
-    const result = validateTemplateAgainstCatalog(documentWithRoot(root), description);
+    const result = validateTemplateAgainstData(documentWithRoot(root), description);
 
     expect(result).toEqual({ errors: [], warnings: [] });
   });
 
   it('báo lỗi khi template dùng catalog khác', () => {
-    const result = validateTemplateAgainstCatalog(
+    const result = validateTemplateAgainstData(
       { ...documentWithRoot(textOf('orderCode')), catalog: 'kitchen-ticket' },
       description,
     );
@@ -75,7 +75,7 @@ describe('validateTemplateAgainstCatalog', () => {
   });
 
   it('báo lỗi biến của collection dùng ngoài vòng lặp, kèm tên hiển thị của collection', () => {
-    const result = validateTemplateAgainstCatalog(documentWithRoot(textOf('itemName')), description);
+    const result = validateTemplateAgainstData(documentWithRoot(textOf('itemName')), description);
 
     expect(result.errors).toEqual([
       { path: 'root.content[0]', message: 'biến "itemName" chỉ dùng được trong vòng lặp "Danh sách món"' },
@@ -137,7 +137,7 @@ describe('validateTemplateAgainstCatalog', () => {
   });
 
   it('biến deprecated chỉ cảnh báo, không phải lỗi', () => {
-    const result = validateTemplateAgainstCatalog(
+    const result = validateTemplateAgainstData(
       documentWithRoot(repeatItems(textOf('legacyItemName'))),
       description,
     );
diff --git a/packages/printer-core/src/template/parse/index.ts b/packages/printer-core/src/template/parse/index.ts
index 03424d0..1da3149 100644
--- a/packages/printer-core/src/template/parse/index.ts
+++ b/packages/printer-core/src/template/parse/index.ts
@@ -1,4 +1,4 @@
 export type { TemplateIssue, ParseResult } from './TemplateIssue';
 export { parseTemplate } from './parseTemplate';
 export { validateTemplateStructure } from './validateTemplateStructure';
-export { validateTemplateAgainstCatalog, type CatalogValidationResult } from './validateTemplateAgainstCatalog';
+export { validateTemplateAgainstData, type TemplateDataValidationResult } from './validateTemplateAgainstData';
diff --git a/packages/printer-core/src/template/parse/parseTemplate.ts b/packages/printer-core/src/template/parse/parseTemplate.ts
index c5c2d31..24aa374 100644
--- a/packages/printer-core/src/template/parse/parseTemplate.ts
+++ b/packages/printer-core/src/template/parse/parseTemplate.ts
@@ -4,7 +4,7 @@ import { validateTemplateStructure } from './validateTemplateStructure';
 
 /**
  * Đọc template từ nguồn không có kiểu (BE, file import) và kiểm tra cấu trúc. Template khác schema hiện tại bị từ
- * chối, không migrate. Không kiểm tra biến có khớp catalog — việc đó là của `validateTemplateAgainstCatalog`.
+ * chối, không migrate. Không kiểm tra biến có khớp catalog — việc đó là của `validateTemplateAgainstData`.
  */
 export function parseTemplate(json: unknown): ParseResult {
   const issues = validateTemplateStructure(json);
diff --git a/packages/printer-core/src/template/parse/validateTemplateAgainstData.ts b/packages/printer-core/src/template/parse/validateTemplateAgainstData.ts
index 6b9ea4f..d2da0a3 100644
--- a/packages/printer-core/src/template/parse/validateTemplateAgainstData.ts
+++ b/packages/printer-core/src/template/parse/validateTemplateAgainstData.ts
@@ -1,12 +1,12 @@
 import {
   BUILT_IN_VARIABLE_SCOPES,
-  createCatalogIndex,
+  createTemplateDataIndex,
   isBuiltInVariableName,
   type BuiltInVariableName,
-  type CatalogDescription,
-  type CatalogIndex,
+  type TemplateDataDescription,
+  type TemplateDataIndex,
   type VariableType,
-} from '../../catalog';
+} from '../data';
 import type { Condition } from '../content/Condition';
 import type { Segment } from '../content/Segment';
 import type { ValueFormat } from '../content/ValueFormat';
@@ -17,7 +17,7 @@ import type { TemplateDocument } from '../TemplateDocument';
 import type { TemplateIssue } from './TemplateIssue';
 
 /** Kết quả kiểm tra template theo catalog. */
-export interface CatalogValidationResult {
+export interface TemplateDataValidationResult {
   /** Lỗi chặn — template không resolve đúng được. */
   readonly errors: readonly TemplateIssue[];
 
@@ -35,10 +35,10 @@ interface ValidationScope {
 }
 
 /** Trạng thái 1 lần kiểm tra: bảng tra catalog + lỗi/cảnh báo gom được. */
-interface CatalogCheck {
-  readonly description: CatalogDescription;
+interface TemplateDataCheck {
+  readonly description: TemplateDataDescription;
 
-  readonly index: CatalogIndex;
+  readonly index: TemplateDataIndex;
 
   readonly errors: TemplateIssue[];
 
@@ -62,11 +62,12 @@ const ROOT_SCOPE: ValidationScope = { collections: [], expanded: false };
  * Kiểm tra template khớp catalog: biến tồn tại và dùng đúng scope, collection/expand hợp lệ, ảnh dùng biến
  * kiểu `asset`, format hợp kiểu biến. Nhận metadata (`describe()`) nên BE/designer dùng chung được.
  */
-export function validateTemplateAgainstCatalog(
+export function validateTemplateAgainstData(
   template: TemplateDocument,
-  description: CatalogDescription,
-): CatalogValidationResult {
-  const check: CatalogCheck = { description, index: createCatalogIndex(description), errors: [], warnings: [] };
+  description: TemplateDataDescription,
+): TemplateDataValidationResult {
+  const index = createTemplateDataIndex(description);
+  const check: TemplateDataCheck = { description, index, errors: [], warnings: [] };
   if (template.catalog !== description.id) {
     addError(check, 'catalog', `template dùng catalog "${template.catalog}", không phải "${description.id}"`);
   }
@@ -75,19 +76,19 @@ export function validateTemplateAgainstCatalog(
 }
 
 function addError(
-  check: CatalogCheck,
+  check: TemplateDataCheck,
   path: string,
   message: string,
 ): void {
   check.errors.push({ path, message });
 }
 
-function collectionLabel(check: CatalogCheck, collection: string): string {
+function collectionLabel(check: TemplateDataCheck, collection: string): string {
   return check.index.collections.get(collection)?.description.label ?? collection;
 }
 
 function checkNode(
-  check: CatalogCheck,
+  check: TemplateDataCheck,
   node: TemplateNode,
   path: string,
   scope: ValidationScope,
@@ -115,7 +116,7 @@ function checkNode(
 }
 
 function checkSegments(
-  check: CatalogCheck,
+  check: TemplateDataCheck,
   segments: readonly Segment[],
   path: string,
   scope: ValidationScope,
@@ -130,7 +131,7 @@ function checkSegments(
 }
 
 function checkFormat(
-  check: CatalogCheck,
+  check: TemplateDataCheck,
   format: ValueFormat,
   type: VariableType,
   path: string,
@@ -140,7 +141,7 @@ function checkFormat(
 }
 
 function checkImage(
-  check: CatalogCheck,
+  check: TemplateDataCheck,
   node: ImageNode,
   path: string,
   scope: ValidationScope,
@@ -155,7 +156,7 @@ function checkImage(
 }
 
 function checkRepeat(
-  check: CatalogCheck,
+  check: TemplateDataCheck,
   node: RepeatNode,
   path: string,
   scope: ValidationScope,
@@ -180,7 +181,7 @@ function checkRepeat(
 }
 
 function checkExpand(
-  check: CatalogCheck,
+  check: TemplateDataCheck,
   node: RepeatNode,
   path: string,
 ): void {
@@ -195,7 +196,7 @@ function checkExpand(
 }
 
 function checkCondition(
-  check: CatalogCheck,
+  check: TemplateDataCheck,
   condition: Condition,
   path: string,
   scope: ValidationScope,
@@ -217,7 +218,7 @@ function checkCondition(
 
 /** Kiểm tra 1 lần dùng biến; trả kiểu biến nếu biến tồn tại. */
 function checkVariableUse(
-  check: CatalogCheck,
+  check: TemplateDataCheck,
   name: string,
   path: string,
   scope: ValidationScope,
@@ -243,7 +244,7 @@ function checkVariableUse(
 }
 
 function checkBuiltInVariableScope(
-  check: CatalogCheck,
+  check: TemplateDataCheck,
   name: BuiltInVariableName,
   path: string,
   scope: ValidationScope,
diff --git a/packages/printer-core/src/testing/OrderTestData.ts b/packages/printer-core/src/testing/OrderTestData.ts
index e61fd77..17ef6e8 100644
--- a/packages/printer-core/src/testing/OrderTestData.ts
+++ b/packages/printer-core/src/testing/OrderTestData.ts
@@ -1,4 +1,4 @@
-import { defineCatalog, defineCollection } from '../catalog';
+import { defineTemplateData, defineCollection } from '../template/data';
 
 /** Topping của 1 món trong data test. */
 export interface TestTopping {
@@ -83,8 +83,8 @@ export const TEST_ORDER_SAMPLE: TestOrder = {
   ],
 };
 
-/** Catalog đơn hàng dùng chung cho test của catalog, template, resolution, layout. */
-export const TEST_ORDER_CATALOG = defineCatalog({
+/** TemplateDataDefinition đơn hàng dùng chung cho test của catalog, template, resolution, layout. */
+export const TEST_ORDER_DATA = defineTemplateData({
   id: 'test-order',
   version: 1,
   sample: TEST_ORDER_SAMPLE,
diff --git a/packages/printer-core/src/testing/index.ts b/packages/printer-core/src/testing/index.ts
index bf5d7ab..b19a0cf 100644
--- a/packages/printer-core/src/testing/index.ts
+++ b/packages/printer-core/src/testing/index.ts
@@ -1 +1 @@
-export * from './OrderTestCatalog';
+export * from './OrderTestData';
diff --git a/packages/printer-preview/src/__tests__/evaluateTemplate.test.ts b/packages/printer-preview/src/__tests__/evaluateTemplate.test.ts
index 312b408..e07ac1c 100644
--- a/packages/printer-preview/src/__tests__/evaluateTemplate.test.ts
+++ b/packages/printer-preview/src/__tests__/evaluateTemplate.test.ts
@@ -2,7 +2,7 @@ import { describe, it, expect } from 'vitest';
 import { evaluateTemplate } from '../evaluateTemplate';
 
 const CATALOG_CODE = `
-  import { defineCatalog, defineCollection } from 'printer-core';
+  import { defineTemplateData, defineCollection } from 'printer-core';
 
   const items = defineCollection({
     label: 'Món',
@@ -10,7 +10,7 @@ const CATALOG_CODE = `
     variables: { itemName: { label: 'Tên món', type: 'string', get: (item) => item.name } },
   });
 
-  export const catalog = defineCatalog({
+  export const catalog = defineTemplateData({
     id: 'demo',
     version: 1,
     sample: { title: 'Xin chào', items: [{ name: 'A' }] },
diff --git a/packages/printer-preview/src/__tests__/pipeline.test.ts b/packages/printer-preview/src/__tests__/pipeline.test.ts
index aa45ad1..d101eb7 100644
--- a/packages/printer-preview/src/__tests__/pipeline.test.ts
+++ b/packages/printer-preview/src/__tests__/pipeline.test.ts
@@ -1,5 +1,5 @@
 import { describe, it, expect } from 'vitest';
-import { column, defineCatalog, defineCollection, labelTemplate, receiptTemplate, text } from 'printer-core';
+import { column, defineTemplateData, defineCollection, labelTemplate, receiptTemplate, text } from 'printer-core';
 import { defaultLanguageFor, renderPreviews } from '../pipeline';
 
 interface DemoData {
@@ -13,7 +13,7 @@ const items = defineCollection({
   variables: { itemName: { label: 'Tên món', type: 'string', get: (item) => item.name } },
 });
 
-const catalog = defineCatalog({
+const catalog = defineTemplateData({
   id: 'demo',
   version: 1,
   sample: { title: 'Xin chào', items: [] } as DemoData,
diff --git a/packages/printer-preview/src/defaultSample.ts b/packages/printer-preview/src/defaultSample.ts
index 565dad9..6379b98 100644
--- a/packages/printer-preview/src/defaultSample.ts
+++ b/packages/printer-preview/src/defaultSample.ts
@@ -1,6 +1,6 @@
 export const defaultCode = `import {
   column,
-  defineCatalog,
+  defineTemplateData,
   defineCollection,
   eq,
   gt,
@@ -53,7 +53,7 @@ const products = defineCollection({
   collections: { toppings },
 });
 
-export const catalog = defineCatalog({
+export const catalog = defineTemplateData({
   id: 'product-label',
   version: 1,
   sample,
diff --git a/packages/printer-preview/src/evaluateTemplate.ts b/packages/printer-preview/src/evaluateTemplate.ts
index fad9e4d..84a2003 100644
--- a/packages/printer-preview/src/evaluateTemplate.ts
+++ b/packages/printer-preview/src/evaluateTemplate.ts
@@ -1,9 +1,9 @@
 import * as ts from 'typescript';
 import * as PrinterCore from 'printer-core';
-import { parseTemplate, type Catalog, type TemplateDocument } from 'printer-core';
+import { parseTemplate, type TemplateDataDefinition, type TemplateDocument } from 'printer-core';
 
 export type EvaluateResult =
-  | { readonly status: 'ok'; readonly template: TemplateDocument; readonly catalog: Catalog<unknown> }
+  | { readonly status: 'ok'; readonly template: TemplateDocument; readonly catalog: TemplateDataDefinition<unknown> }
   | { readonly status: 'error'; readonly stage: 'transpile' | 'runtime'; readonly message: string };
 
 /** Module mà code người dùng xuất ra: `export const catalog` + `export default` template. */
@@ -13,7 +13,7 @@ interface EvaluatedModule {
 }
 
 const EXPORT_HINT =
-  'Code phải `export const catalog = defineCatalog(...)` và `export default labelTemplate(catalog)...build()` ' +
+  'Code phải `export const catalog = defineTemplateData(...)` và `export default labelTemplate(catalog)...build()` ' +
   '(hoặc receiptTemplate) — default export phải là 1 TemplateDocument.';
 
 function errorMessage(error: unknown): string {
@@ -41,10 +41,10 @@ function requireShim(name: string): unknown {
   throw new Error(`Cannot require "${name}" — only "printer-core" is available here.`);
 }
 
-function isCatalog(value: unknown): value is Catalog<unknown> {
+function isTemplateDataDefinition(value: unknown): value is TemplateDataDefinition<unknown> {
   if (typeof value !== 'object' || value === null) return false;
 
-  const candidate = value as Partial<Record<keyof Catalog<unknown>, unknown>>;
+  const candidate = value as Partial<Record<keyof TemplateDataDefinition<unknown>, unknown>>;
   return (
     typeof candidate.id === 'string' &&
     typeof candidate.describe === 'function' &&
@@ -54,7 +54,7 @@ function isCatalog(value: unknown): value is Catalog<unknown> {
 }
 
 function toEvaluateResult(exported: EvaluatedModule): EvaluateResult {
-  if (!isCatalog(exported.catalog)) return { status: 'error', stage: 'runtime', message: EXPORT_HINT };
+  if (!isTemplateDataDefinition(exported.catalog)) return { status: 'error', stage: 'runtime', message: EXPORT_HINT };
 
   const parsed = parseTemplate(exported.default);
   if (!parsed.ok) {
diff --git a/packages/printer-preview/src/pipeline.ts b/packages/printer-preview/src/pipeline.ts
index 696c419..4ceb90a 100644
--- a/packages/printer-preview/src/pipeline.ts
+++ b/packages/printer-preview/src/pipeline.ts
@@ -5,7 +5,7 @@ import {
   paperSizeToDots,
   previewFor,
   type AssetProvider,
-  type Catalog,
+  type TemplateDataDefinition,
   type PrinterLanguage,
   type ResolvedPage,
   type ResolvedPrintDocument,
@@ -74,7 +74,7 @@ function renderPage(
 
 export function renderPreviews(
   template: TemplateDocument,
-  catalog: Catalog<unknown>,
+  catalog: TemplateDataDefinition<unknown>,
   data: unknown,
   language: PrinterLanguage,
 ): readonly PagePreview[] {
~~~

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
(cd packages/printer-preview && npx tsc --noEmit && npx vitest run)
npx eslint packages/printer-core/src packages/printer-preview/src
```

Expected: tsc không in gì; jest `319 passed, 319 total`; `printer-preview` tsc sạch, Vitest `12 passed`; eslint `0 errors`.

- [ ] **Step 5: Stage, line-length, commit**

```bash
git add \
  packages/printer-core/src/__tests__/template-pipeline-integration.test.ts \
  packages/printer-core/src/index.ts \
  packages/printer-core/src/resolution/DocumentResolver.ts \
  packages/printer-core/src/resolution/ResolveContext.ts \
  packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts \
  packages/printer-core/src/resolution/__tests__/collectAssetIds.test.ts \
  packages/printer-core/src/resolution/collectAssetIds.ts \
  packages/printer-core/src/resolution/readRepeatEntries.ts \
  packages/printer-core/src/resolution/readVariable.ts \
  packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts \
  packages/printer-core/src/template/builder/TemplateScope.ts \
  packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts \
  packages/printer-core/src/template/builder/index.ts \
  packages/printer-core/src/template/data/CollectionDefinition.ts \
  packages/printer-core/src/template/data/TemplateDataDefinition.ts \
  packages/printer-core/src/template/data/TemplateDataDescription.ts \
  packages/printer-core/src/template/data/TemplateDataIndex.ts \
  packages/printer-core/src/template/data/TemplateDataReader.ts \
  packages/printer-core/src/template/data/VariableDefinition.ts \
  packages/printer-core/src/template/data/__tests__/TemplateDataIndex.test.ts \
  packages/printer-core/src/template/data/__tests__/defineTemplateData.test.ts \
  packages/printer-core/src/template/data/defineTemplateData.ts \
  packages/printer-core/src/template/data/describeTemplateData.ts \
  packages/printer-core/src/template/data/index.ts \
  packages/printer-core/src/template/format/formatValue.ts \
  packages/printer-core/src/template/index.ts \
  packages/printer-core/src/template/parse/__tests__/validateTemplateAgainstData.test.ts \
  packages/printer-core/src/template/parse/index.ts \
  packages/printer-core/src/template/parse/parseTemplate.ts \
  packages/printer-core/src/template/parse/validateTemplateAgainstData.ts \
  packages/printer-core/src/testing/OrderTestData.ts \
  packages/printer-core/src/testing/index.ts \
  packages/printer-preview/src/__tests__/evaluateTemplate.test.ts \
  packages/printer-preview/src/__tests__/pipeline.test.ts \
  packages/printer-preview/src/defaultSample.ts \
  packages/printer-preview/src/evaluateTemplate.ts \
  packages/printer-preview/src/pipeline.ts
git diff --cached -U0 -- '*.ts' '*.tsx' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "refactor: rename catalog types and files to template data" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log -1 --format=%B
git status --short
```

Expected: line-length không in gì; commit thành công đúng 2 dòng message; `git status` chỉ còn `?? .claude/worktrees/`.

---

### Task 3: Field JSON `dataId`, biến `templateData`, câu chữ và README

**Files:**
- Modify: `template/TemplateDocument.ts` (field `dataId`), `template/parse/validateTemplateStructure.ts`, `template/parse/validateTemplateAgainstData.ts`, `template/builder/TemplateDocumentBuilder.ts`, `resolution/DocumentResolver.ts`, `resolution/ResolveContext.ts`, `resolution/collectAssetIds.ts`, `resolution/readVariable.ts`, `resolution/readRepeatEntries.ts`, các file chỉ đổi comment trong `template/data/`, `template/`, `testing/`, `packages/printer-preview/src/{App.tsx,defaultSample.ts,evaluateTemplate.ts,pipeline.ts}`, `packages/printer-core/README.md`
- Test: fixture `catalog: '…'` → `dataId: '…'`, option `catalog` → `templateData`, câu lỗi và tên test theo chữ mới trong `resolution/__tests__/*`, `template/**/__tests__/*`, `__tests__/template-pipeline-integration.test.ts`, `packages/printer-preview/src/__tests__/*`

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: tên mới của Task 2.
- Produces:
  - `TemplateDocument.dataId: string` (thay `catalog`); `validateTemplateStructure` kiểm `dataId` không rỗng; lỗi lệch mã ở path `dataId`.
  - Option resolve `{ templateData, assets }` (thay `catalog`); `ResolveContext.templateData`.
  - `labelTemplate(templateData)` / `receiptTemplate(templateData)`; builder ghi `dataId: templateData.id`.
  - `printer-preview`: code người dùng `export const templateData = defineTemplateData(...)`; `EvaluateResult` ok có field `templateData`; `renderPreviews(template, templateData, data, language)`.
  - Câu lỗi: `Template dùng dữ liệu "x", không phải "y"` (resolver), `template dùng dữ liệu "x", không phải "y"` (validate), `dữ liệu template không có biến/collection "x"`, `dữ liệu template "id" không có biến "x"`.

- [ ] **Step 1: Sửa test (patch `t3test`)**

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-28-template-data-naming.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t3test | git apply --ignore-whitespace -
```

<!-- patch:t3test -->
~~~diff
diff --git a/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts b/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts
index 921c13f..b34ab3c 100644
--- a/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts
+++ b/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts
@@ -49,7 +49,7 @@ function buildReceipt() {
 }
 
 describe('pipeline template → resolve → layout → compile', () => {
-  it('DSL → JSON (round-trip) → resolve với catalog → layout 203 dpi → byte ESC/POS', () => {
+  it('DSL → JSON (round-trip) → resolve với dữ liệu template → layout 203 dpi → byte ESC/POS', () => {
     const parsed = parseTemplate(JSON.parse(JSON.stringify(buildReceipt())));
     if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
     const template = parsed.template;
@@ -57,7 +57,7 @@ describe('pipeline template → resolve → layout → compile', () => {
     expect(collectAssetIds(template, TEST_ORDER_DATA, TEST_ORDER_SAMPLE)).toEqual(['store-logo@v1']);
     const assets: AssetProvider = { get: (assetId) => (assetId === 'store-logo@v1' ? LOGO : undefined) };
 
-    const resolveOptions = { catalog: TEST_ORDER_DATA, assets };
+    const resolveOptions = { templateData: TEST_ORDER_DATA, assets };
     const pages = createDocumentResolver().resolve(template, TEST_ORDER_SAMPLE, resolveOptions);
     expect(pages).toHaveLength(1);
     if (pages[0].status !== 'ok') throw new Error(pages[0].message);
@@ -130,7 +130,7 @@ describe('pipeline template → resolve → layout → compile', () => {
       items: [{ name: 'Trà sữa', quantity: 1, price: 45000, toppings }],
     };
     const pages = createDocumentResolver().resolve(template, order, {
-      catalog: TEST_ORDER_DATA,
+      templateData: TEST_ORDER_DATA,
       assets: { get: () => undefined },
     });
 
diff --git a/packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts b/packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
index ea60be8..245b57b 100644
--- a/packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
+++ b/packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
@@ -21,7 +21,7 @@ function documentWith(root: TemplateNode, media: TemplateMedia = 'receipt'): Tem
     schemaVersion: 1,
     id: 'template',
     name: 'Template',
-    catalog: 'test-order',
+    dataId: 'test-order',
     media,
     locale: 'vi-VN',
     paper: media === 'label' ? { widthMm: 50, heightMm: 30 } : { widthMm: 72 },
@@ -34,7 +34,7 @@ function resolvePages(
   data: TestOrder = TEST_ORDER_SAMPLE,
   assets: AssetProvider = NO_ASSETS,
 ): readonly ResolvedPage[] {
-  return resolver.resolve(documentWith(root), data, { catalog: TEST_ORDER_DATA, assets });
+  return resolver.resolve(documentWith(root), data, { templateData: TEST_ORDER_DATA, assets });
 }
 
 /** Mọi chuỗi text trong cây, theo thứ tự duyệt. */
@@ -147,7 +147,7 @@ describe('DocumentResolver — scope tường minh', () => {
       get: (order: { readonly lines: readonly { readonly code: string }[] }) => order.lines,
       variables: { lineCode: { label: 'Mã dòng', type: 'string', get: (line) => line.code } },
     });
-    const catalog = defineTemplateData({
+    const templateData = defineTemplateData({
       id: 'shadow',
       version: 1,
       sample: { code: 'ORDER', lines: [{ code: 'LINE' }] },
@@ -161,10 +161,10 @@ describe('DocumentResolver — scope tường minh', () => {
         collection: 'lines',
         template: { type: 'text', id: 'text', content: [{ var: 'orderCode' }, { text: '/' }, { var: 'lineCode' }] },
       }),
-      catalog: 'shadow',
+      dataId: 'shadow',
     };
 
-    const [page] = resolver.resolve(template, catalog.sample, { catalog, assets: NO_ASSETS });
+    const [page] = resolver.resolve(template, templateData.sample, { templateData, assets: NO_ASSETS });
 
     expect(pageTexts(page)).toEqual(['ORDER/LINE']);
   });
@@ -679,14 +679,14 @@ describe('DocumentResolver — ảnh', () => {
   });
 });
 
-describe('DocumentResolver — catalog', () => {
-  it('throw khi template dùng catalog khác catalog truyền vào', () => {
-    const template = { ...documentWith({ type: 'text', id: 't', content: [] }), catalog: 'kitchen' };
+describe('DocumentResolver — dữ liệu template', () => {
+  it('throw khi template dùng dữ liệu khác dữ liệu truyền vào', () => {
+    const template = { ...documentWith({ type: 'text', id: 't', content: [] }), dataId: 'kitchen' };
 
-    const options = { catalog: TEST_ORDER_DATA, assets: NO_ASSETS };
+    const options = { templateData: TEST_ORDER_DATA, assets: NO_ASSETS };
 
     expect(() => resolver.resolve(template, TEST_ORDER_SAMPLE, options)).toThrow(
-      'Template dùng catalog "kitchen", không phải "test-order"',
+      'Template dùng dữ liệu "kitchen", không phải "test-order"',
     );
   });
 });
diff --git a/packages/printer-core/src/resolution/__tests__/collectAssetIds.test.ts b/packages/printer-core/src/resolution/__tests__/collectAssetIds.test.ts
index 550952b..fb69d4b 100644
--- a/packages/printer-core/src/resolution/__tests__/collectAssetIds.test.ts
+++ b/packages/printer-core/src/resolution/__tests__/collectAssetIds.test.ts
@@ -6,7 +6,7 @@ const TEMPLATE: TemplateDocument = {
   schemaVersion: 1,
   id: 'template',
   name: 'Template',
-  catalog: 'test-order',
+  dataId: 'test-order',
   media: 'receipt',
   locale: 'vi-VN',
   paper: { widthMm: 72 },
diff --git a/packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts b/packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts
index 679a83c..febfca9 100644
--- a/packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts
+++ b/packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts
@@ -43,7 +43,7 @@ describe('labelTemplate / receiptTemplate', () => {
       schemaVersion: 1,
       id: 'product-label-default',
       name: 'Tem món mặc định',
-      catalog: 'test-order',
+      dataId: 'test-order',
       media: 'label',
       locale: 'vi-VN',
       paper: { widthMm: 50, heightMm: 30 },
diff --git a/packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts b/packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts
index cfc9034..635400d 100644
--- a/packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts
+++ b/packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts
@@ -5,7 +5,7 @@ function validLabelJson(): Record<string, unknown> {
     schemaVersion: 1,
     id: 'product-label-default',
     name: 'Tem món mặc định',
-    catalog: 'test-order',
+    dataId: 'test-order',
     media: 'label',
     locale: 'vi-VN',
     paper: { widthMm: 50, heightMm: 30 },
diff --git a/packages/printer-core/src/template/parse/__tests__/validateTemplateAgainstData.test.ts b/packages/printer-core/src/template/parse/__tests__/validateTemplateAgainstData.test.ts
index 5208248..18fa180 100644
--- a/packages/printer-core/src/template/parse/__tests__/validateTemplateAgainstData.test.ts
+++ b/packages/printer-core/src/template/parse/__tests__/validateTemplateAgainstData.test.ts
@@ -9,7 +9,7 @@ function documentWithRoot(root: TemplateNode): TemplateDocument {
     schemaVersion: 1,
     id: 'template',
     name: 'Template',
-    catalog: 'test-order',
+    dataId: 'test-order',
     media: 'receipt',
     locale: 'vi-VN',
     paper: { widthMm: 72 },
@@ -59,19 +59,19 @@ describe('validateTemplateAgainstData', () => {
     expect(result).toEqual({ errors: [], warnings: [] });
   });
 
-  it('báo lỗi khi template dùng catalog khác', () => {
+  it('báo lỗi khi template dùng dữ liệu khác', () => {
     const result = validateTemplateAgainstData(
-      { ...documentWithRoot(textOf('orderCode')), catalog: 'kitchen-ticket' },
+      { ...documentWithRoot(textOf('orderCode')), dataId: 'kitchen-ticket' },
       description,
     );
 
     expect(result.errors).toEqual([
-      { path: 'catalog', message: 'template dùng catalog "kitchen-ticket", không phải "test-order"' },
+      { path: 'dataId', message: 'template dùng dữ liệu "kitchen-ticket", không phải "test-order"' },
     ]);
   });
 
-  it('báo lỗi biến không có trong catalog', () => {
-    expect(errorsOf(textOf('missing'))).toEqual(['catalog "test-order" không có biến "missing"']);
+  it('báo lỗi biến không có trong dữ liệu template', () => {
+    expect(errorsOf(textOf('missing'))).toEqual(['dữ liệu template "test-order" không có biến "missing"']);
   });
 
   it('báo lỗi biến của collection dùng ngoài vòng lặp, kèm tên hiển thị của collection', () => {
@@ -96,7 +96,7 @@ describe('validateTemplateAgainstData', () => {
   it('báo lỗi collection không tồn tại', () => {
     const root: TemplateNode = { type: 'repeat', id: 'r', collection: 'payments', template: textOf('orderCode') };
 
-    expect(errorsOf(root)).toEqual(['catalog không có collection "payments"']);
+    expect(errorsOf(root)).toEqual(['dữ liệu template không có collection "payments"']);
   });
 
   it('báo lỗi expand không phải biến number của đúng collection', () => {
diff --git a/packages/printer-preview/src/__tests__/defaultSample.test.ts b/packages/printer-preview/src/__tests__/defaultSample.test.ts
index c952b70..89dcbaa 100644
--- a/packages/printer-preview/src/__tests__/defaultSample.test.ts
+++ b/packages/printer-preview/src/__tests__/defaultSample.test.ts
@@ -4,13 +4,13 @@ import { evaluateTemplate } from '../evaluateTemplate';
 import { renderPreviews } from '../pipeline';
 
 describe('defaultSample', () => {
-  it('code mẫu chạy được, data mẫu khớp catalog.sample và in ra mỗi ly 1 tem', () => {
+  it('code mẫu chạy được, data mẫu khớp templateData.sample và in ra mỗi ly 1 tem', () => {
     const evaluated = evaluateTemplate(defaultCode);
     if (evaluated.status !== 'ok') throw new Error(evaluated.message);
 
-    expect(JSON.parse(defaultData)).toEqual(evaluated.catalog.sample);
+    expect(JSON.parse(defaultData)).toEqual(evaluated.templateData.sample);
 
-    const previews = renderPreviews(evaluated.template, evaluated.catalog, JSON.parse(defaultData), 'tspl');
+    const previews = renderPreviews(evaluated.template, evaluated.templateData, JSON.parse(defaultData), 'tspl');
     expect(previews.map((preview) => preview.status)).toEqual(['ok', 'ok']);
   });
 
@@ -21,7 +21,7 @@ describe('defaultSample', () => {
     const data = JSON.parse(defaultData);
     data.products[0].toppings = Array.from({ length: 9 }, (_, index) => ({ name: `Topping ${index + 1}` }));
 
-    const previews = renderPreviews(evaluated.template, evaluated.catalog, data, 'tspl');
+    const previews = renderPreviews(evaluated.template, evaluated.templateData, data, 'tspl');
     expect(previews.map((preview) => preview.status)).toEqual(Array.from({ length: 6 }, () => 'ok'));
 
     const firstCupLabels = previews.slice(0, 3).map((preview) => (preview.status === 'ok' ? preview.svg : ''));
diff --git a/packages/printer-preview/src/__tests__/evaluateTemplate.test.ts b/packages/printer-preview/src/__tests__/evaluateTemplate.test.ts
index e07ac1c..ea0b931 100644
--- a/packages/printer-preview/src/__tests__/evaluateTemplate.test.ts
+++ b/packages/printer-preview/src/__tests__/evaluateTemplate.test.ts
@@ -1,7 +1,7 @@
 import { describe, it, expect } from 'vitest';
 import { evaluateTemplate } from '../evaluateTemplate';
 
-const CATALOG_CODE = `
+const TEMPLATE_DATA_CODE = `
   import { defineTemplateData, defineCollection } from 'printer-core';
 
   const items = defineCollection({
@@ -10,7 +10,7 @@ const CATALOG_CODE = `
     variables: { itemName: { label: 'Tên món', type: 'string', get: (item) => item.name } },
   });
 
-  export const catalog = defineTemplateData({
+  export const templateData = defineTemplateData({
     id: 'demo',
     version: 1,
     sample: { title: 'Xin chào', items: [{ name: 'A' }] },
@@ -20,10 +20,10 @@ const CATALOG_CODE = `
 `;
 
 describe('evaluateTemplate', () => {
-  it('trả template + catalog khi code export đúng', () => {
-    const code = `${CATALOG_CODE}
+  it('trả template + templateData khi code export đúng', () => {
+    const code = `${TEMPLATE_DATA_CODE}
       import { labelTemplate, text } from 'printer-core';
-      export default labelTemplate(catalog)
+      export default labelTemplate(templateData)
         .id('label')
         .name('Tem')
         .paper({ widthMm: 50, heightMm: 30 })
@@ -36,7 +36,7 @@ describe('evaluateTemplate', () => {
     if (result.status !== 'ok') return;
     expect(result.template.media).toBe('label');
     expect(result.template.paper).toEqual({ widthMm: 50, heightMm: 30 });
-    expect(result.catalog.id).toBe('demo');
+    expect(result.templateData.id).toBe('demo');
   });
 
   it('báo lỗi transpile khi cú pháp TypeScript sai', () => {
@@ -46,27 +46,27 @@ describe('evaluateTemplate', () => {
     if (result.status === 'error') expect(result.stage).toBe('transpile');
   });
 
-  it('báo lỗi runtime khi thiếu export catalog', () => {
+  it('báo lỗi runtime khi thiếu export templateData', () => {
     const result = evaluateTemplate('export default { notATemplate: true };');
 
     expect(result.status).toBe('error');
     if (result.status === 'error') {
       expect(result.stage).toBe('runtime');
-      expect(result.message).toContain('export const catalog');
+      expect(result.message).toContain('export const templateData');
     }
   });
 
   it('báo lỗi runtime kèm vị trí khi default export không phải TemplateDocument', () => {
-    const result = evaluateTemplate(`${CATALOG_CODE}\nexport default { notATemplate: true };`);
+    const result = evaluateTemplate(`${TEMPLATE_DATA_CODE}\nexport default { notATemplate: true };`);
 
     expect(result.status).toBe('error');
     if (result.status === 'error') expect(result.message).toContain('schemaVersion');
   });
 
   it('báo lỗi build khi template dùng biến sai scope', () => {
-    const code = `${CATALOG_CODE}
+    const code = `${TEMPLATE_DATA_CODE}
       import { labelTemplate, text } from 'printer-core';
-      export default labelTemplate(catalog)
+      export default labelTemplate(templateData)
         .id('label')
         .name('Tem')
         .paper({ widthMm: 50, heightMm: 30 })
diff --git a/packages/printer-preview/src/__tests__/pipeline.test.ts b/packages/printer-preview/src/__tests__/pipeline.test.ts
index d101eb7..a01caa0 100644
--- a/packages/printer-preview/src/__tests__/pipeline.test.ts
+++ b/packages/printer-preview/src/__tests__/pipeline.test.ts
@@ -13,7 +13,7 @@ const items = defineCollection({
   variables: { itemName: { label: 'Tên món', type: 'string', get: (item) => item.name } },
 });
 
-const catalog = defineTemplateData({
+const templateData = defineTemplateData({
   id: 'demo',
   version: 1,
   sample: { title: 'Xin chào', items: [] } as DemoData,
@@ -22,7 +22,7 @@ const catalog = defineTemplateData({
 });
 
 function label() {
-  return labelTemplate(catalog).id('label').name('Tem').paper({ widthMm: 50, heightMm: 30 });
+  return labelTemplate(templateData).id('label').name('Tem').paper({ widthMm: 50, heightMm: 30 });
 }
 
 describe('renderPreviews', () => {
@@ -30,7 +30,7 @@ describe('renderPreviews', () => {
     const template = label()
       .root((scope) => column().children(text([scope.var('title')])))
       .build();
-    const previews = renderPreviews(template, catalog, { title: 'Hello', items: [] }, 'tspl');
+    const previews = renderPreviews(template, templateData, { title: 'Hello', items: [] }, 'tspl');
 
     expect(previews).toHaveLength(1);
     expect(previews[0].status).toBe('ok');
@@ -46,14 +46,14 @@ describe('renderPreviews', () => {
       )
       .build();
     const data: DemoData = { title: 'x', items: [{ name: 'A' }, {}, { name: 'C' }] };
-    const previews = renderPreviews(template, catalog, data, 'tspl');
+    const previews = renderPreviews(template, templateData, data, 'tspl');
 
     expect(previews.map((preview) => preview.status)).toEqual(['ok', 'error', 'ok']);
   });
 
   it('defaultLanguageFor: receipt → escpos, label → tspl', () => {
     const labelDocument = label().root(text('x')).build();
-    const receipt = receiptTemplate(catalog)
+    const receipt = receiptTemplate(templateData)
       .id('receipt')
       .name('Hoá đơn')
       .paper({ widthMm: 72 })
~~~

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
npx jest packages/printer-core
(cd packages/printer-preview && npx vitest run)
```

Expected: jest `Test Suites: 5 failed, 47 passed` / `Tests: 83 failed, 236 passed, 319 total` (các suite `validateTemplateAgainstData`, `TemplateDocumentBuilder`, `DocumentResolver`, `parseTemplate`, `template-pipeline-integration` — code vẫn ghi/đọc field `catalog` và option `catalog`); Vitest `printer-preview` `5 failed | 7 passed` (`defaultSample`, `evaluateTemplate` — code preview vẫn đọc export `catalog`).

- [ ] **Step 3: Viết code (patch `t3impl`)**

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-28-template-data-naming.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t3impl | git apply --ignore-whitespace -
```

<!-- patch:t3impl -->
~~~diff
diff --git a/packages/printer-core/README.md b/packages/printer-core/README.md
index 2888b4f..b610387 100644
--- a/packages/printer-core/README.md
+++ b/packages/printer-core/README.md
@@ -5,13 +5,13 @@ Core thuần TypeScript cho feature máy in của NDTCorePOS, không dependency,
 Package hỗ trợ 2 ngôn ngữ máy in mà app dùng: **TSPL** (máy in tem) và **ESC/POS** (máy in hoá đơn). Luồng chính:
 
 ```text
-TemplateDocument (JSON, DSL) ──parseTemplate──▶ resolve (catalog + data) ──▶ layout (dots)
+TemplateDocument (JSON, DSL) ──parseTemplate──▶ resolve (template data + data) ──▶ layout (dots)
   ──▶ PrintElement[] ──compileTo──▶ lệnh TSPL / ESC/POS  { output, warnings }
                      └─previewFor─▶ SVG xem trước
 ```
 
 - **Template:** `TemplateDocument` là JSON thuần, độc lập DPI; DSL `labelTemplate`/`receiptTemplate` sinh ra nó.
-- **Dữ liệu:** biến đọc qua catalog (`defineCatalog`), không trỏ thẳng vào data.
+- **Dữ liệu:** biến đọc qua định nghĩa dữ liệu template (`defineTemplateData`), không trỏ thẳng vào data.
 - **Compile:** mỗi ngôn ngữ có compiler, parser (đọc ngược lệnh), validator, preview SVG. Năng lực máy in đích
   truyền vào qua `PrinterFeatures`.
 - **Chuyển đổi:** `convert()` chuyển lệnh giữa TSPL và ESC/POS.
@@ -42,15 +42,16 @@ CP1258 (tiếng Việt) có encoder nhưng chưa nằm trong danh sách code pag
 src/
 ├── index.ts
 ├── types/          # Alignment, Bitmap, Direction, Point, Rect, Rotation, Size, Unit
-├── catalog/        # biến có tên theo loại nội dung: defineCatalog, defineCollection, CatalogIndex, biến có sẵn
 ├── template/       # TemplateDocument JSON độc lập DPI
+│   ├── data/       # dữ liệu template: defineTemplateData, defineCollection, TemplateDataReader,
+│   │               # TemplateDataIndex, biến có sẵn
 │   ├── style/      # Length, Dimension, Insets, BoxStyle, LayoutStyle, TextStyle
 │   ├── content/    # Segment, ValueFormat, Condition
 │   ├── nodes/      # TemplateNode và các node container/text/image/barcode/qrcode/line/repeat
 │   ├── format/     # formatter vi-VN tự cài đặt (không dùng Intl)
-│   ├── parse/      # parseTemplate, validate cấu trúc/tách tem/theo catalog
-│   └── builder/    # DSL labelTemplate/receiptTemplate(catalog), scope.var/repeat
-├── resolution/     # ghép template + data qua catalog, kế hoạch trang (planPages), tách repeat lồng
+│   ├── parse/      # parseTemplate, validate cấu trúc/tách tem/theo dữ liệu template
+│   └── builder/    # DSL labelTemplate/receiptTemplate(templateData), scope.var/repeat
+├── resolution/     # ghép template + data qua dữ liệu template, kế hoạch trang (planPages), tách repeat lồng
 ├── layout/         # đổi Length → dots theo DPI rồi xếp vị trí, sinh PrintElement[]
 ├── document/       # ResolvedPrintDocument + PrintElement (content/drawing/layout/control)
 ├── core/           # contract: PrinterLanguage, PrintCompiler/Parser/Preview/Validation, CompileResult,
@@ -68,7 +69,7 @@ src/
 │                   # binaryStringToBytes/bytesToBinaryString (chuỗi 1 ký tự = 1 byte)
 ├── image/          # crop/resize/threshold/dither ảnh thành bitmap đơn sắc + dithering/
 ├── symbology/      # barcode/ và qrcode/: cấu hình + validate
-└── testing/        # OrderTestCatalog — catalog đơn hàng + data mẫu dùng chung cho test (không export ra ngoài)
+└── testing/        # OrderTestData — dữ liệu template đơn hàng + data mẫu dùng chung cho test (không export ra ngoài)
 ```
 
 Test đặt trong `__tests__/` cạnh file nguồn; test tích hợp ở `src/__tests__/`.
diff --git a/packages/printer-core/src/resolution/DocumentResolver.ts b/packages/printer-core/src/resolution/DocumentResolver.ts
index cd350f1..43b618a 100644
--- a/packages/printer-core/src/resolution/DocumentResolver.ts
+++ b/packages/printer-core/src/resolution/DocumentResolver.ts
@@ -9,31 +9,31 @@ import { resolveNode } from './resolveNode';
 
 /** Nguồn phụ trợ cho 1 lần resolve. */
 export interface ResolveOptions<TData> {
-  /** TemplateDataDefinition mà template dùng; `id` phải khớp `template.catalog`. */
-  readonly catalog: TemplateDataDefinition<TData>;
+  /** TemplateDataDefinition mà template dùng; `id` phải khớp `template.dataId`. */
+  readonly templateData: TemplateDataDefinition<TData>;
 
   /** Ảnh đã tải + decode sẵn. */
   readonly assets: AssetProvider;
 }
 
-/** Ghép template với data qua catalog: giá trị biến, format, ẩn/hiện, lặp/expand/phân trang, tra ảnh. */
+/** Ghép template với data qua dữ liệu template: giá trị biến, format, ẩn/hiện, lặp/expand/phân trang, tra ảnh. */
 export class DocumentResolver {
   /**
    * Resolve thành các trang; lỗi data (thiếu biến bắt buộc, thiếu ảnh...) được cô lập theo trang.
-   * Throw nếu template không dùng catalog được truyền vào — đó là lỗi lập trình, không phải lỗi data.
+   * Throw nếu template không dùng dữ liệu template được truyền vào — đó là lỗi lập trình, không phải lỗi data.
    */
   resolve<TData>(
     template: TemplateDocument,
     data: TData,
     options: ResolveOptions<TData>,
   ): readonly ResolvedPage[] {
-    if (template.catalog !== options.catalog.id) {
-      throw new Error(`Template dùng catalog "${template.catalog}", không phải "${options.catalog.id}"`);
+    if (template.dataId !== options.templateData.id) {
+      throw new Error(`Template dùng dữ liệu "${template.dataId}", không phải "${options.templateData.id}"`);
     }
 
     const baseContext: ResolveContext = {
-      catalog: options.catalog,
-      index: createTemplateDataIndex(options.catalog.describe()),
+      templateData: options.templateData,
+      index: createTemplateDataIndex(options.templateData.describe()),
       assets: options.assets,
       frames: [createRootFrame(data)],
       page: COUNTING_PAGE,
diff --git a/packages/printer-core/src/resolution/ResolveContext.ts b/packages/printer-core/src/resolution/ResolveContext.ts
index 5583307..45bd8a7 100644
--- a/packages/printer-core/src/resolution/ResolveContext.ts
+++ b/packages/printer-core/src/resolution/ResolveContext.ts
@@ -61,9 +61,9 @@ export const COUNTING_PAGE: PageInfo = { pageNumber: 1, pageCount: 1 };
 /** Trạng thái khi resolve 1 node. */
 export interface ResolveContext {
   /** TemplateDataDefinition dùng để đọc biến/collection từ data. */
-  readonly catalog: TemplateDataDefinition<unknown>;
+  readonly templateData: TemplateDataDefinition<unknown>;
 
-  /** Bảng tra biến/collection dựng từ `catalog.describe()`. */
+  /** Bảng tra biến/collection dựng từ `templateData.describe()`. */
   readonly index: TemplateDataIndex;
 
   /** Nguồn tra bitmap ảnh. */
diff --git a/packages/printer-core/src/resolution/collectAssetIds.ts b/packages/printer-core/src/resolution/collectAssetIds.ts
index 3eb585c..4d13897 100644
--- a/packages/printer-core/src/resolution/collectAssetIds.ts
+++ b/packages/printer-core/src/resolution/collectAssetIds.ts
@@ -15,12 +15,12 @@ const NO_ASSETS: AssetProvider = { get: () => undefined };
  */
 export function collectAssetIds<TData>(
   template: TemplateDocument,
-  catalog: TemplateDataDefinition<TData>,
+  templateData: TemplateDataDefinition<TData>,
   data: TData,
 ): readonly string[] {
   const context: ResolveContext = {
-    catalog,
-    index: createTemplateDataIndex(catalog.describe()),
+    templateData,
+    index: createTemplateDataIndex(templateData.describe()),
     assets: NO_ASSETS,
     frames: [createRootFrame(data)],
     page: COUNTING_PAGE,
diff --git a/packages/printer-core/src/resolution/readRepeatEntries.ts b/packages/printer-core/src/resolution/readRepeatEntries.ts
index 1ca8a99..ae10095 100644
--- a/packages/printer-core/src/resolution/readRepeatEntries.ts
+++ b/packages/printer-core/src/resolution/readRepeatEntries.ts
@@ -44,7 +44,7 @@ export function entryFrame(
 /** Mảng phần tử raw của collection (chưa expand). */
 export function readCollectionItems(node: RepeatNode, context: ResolveContext): readonly unknown[] {
   const collection = context.index.collections.get(node.collection);
-  if (!collection) throw new ResolveError(node.id, `catalog không có collection "${node.collection}"`);
+  if (!collection) throw new ResolveError(node.id, `dữ liệu template không có collection "${node.collection}"`);
 
   const parentFrame = findScopeFrame(context, collection.parent);
   if (!parentFrame) {
@@ -53,7 +53,7 @@ export function readCollectionItems(node: RepeatNode, context: ResolveContext):
   }
 
   const items = readFromTemplateData(node.id, node.collection, () =>
-    context.catalog.readCollection(node.collection, parentFrame.item),
+    context.templateData.readCollection(node.collection, parentFrame.item),
   );
   if (!Array.isArray(items)) throw new ResolveError(node.id, `collection "${node.collection}" không phải mảng`);
   return items;
@@ -82,7 +82,7 @@ function readExpandCount(
   item: unknown,
   context: ResolveContext,
 ): number {
-  const count = readFromTemplateData(node.id, expand, () => context.catalog.readVariable(expand, item));
+  const count = readFromTemplateData(node.id, expand, () => context.templateData.readVariable(expand, item));
   if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
     throw new ResolveError(node.id, `expand "${expand}" phải là số nguyên dương, nhận "${String(count)}"`);
   }
diff --git a/packages/printer-core/src/resolution/readVariable.ts b/packages/printer-core/src/resolution/readVariable.ts
index a9dd0c5..940b94f 100644
--- a/packages/printer-core/src/resolution/readVariable.ts
+++ b/packages/printer-core/src/resolution/readVariable.ts
@@ -35,12 +35,12 @@ export function readVariableValue(
   }
 
   const variable = context.index.variables.get(name);
-  if (!variable) throw new ResolveError(nodeId, `catalog không có biến "${name}"`);
+  if (!variable) throw new ResolveError(nodeId, `dữ liệu template không có biến "${name}"`);
 
   const frame = findScopeFrame(context, variable.collection);
   if (!frame) throw new ResolveError(nodeId, `biến "${name}" chỉ dùng được trong vòng lặp "${variable.collection}"`);
 
-  return readFromTemplateData(nodeId, name, () => context.catalog.readVariable(name, frame.item));
+  return readFromTemplateData(nodeId, name, () => context.templateData.readVariable(name, frame.item));
 }
 
 /** Chặn biến có sẵn dùng sai scope (VD `$position` ở ngoài repeat) — nếu không sẽ âm thầm in giá trị `0`. */
@@ -68,7 +68,10 @@ export function isOptionalVariable(context: ResolveContext, name: string): boole
   return context.index.variables.get(name)?.description.optional ?? false;
 }
 
-/** Gọi hàm `get` của catalog; lỗi trong `get` (data sai cấu trúc) thành lỗi trang thay vì làm hỏng cả lần in. */
+/**
+ * Gọi hàm `get` của dữ liệu template; lỗi trong `get` (data sai cấu trúc) thành lỗi trang thay vì làm hỏng cả
+ * lần in.
+ */
 export function readFromTemplateData(
   nodeId: string,
   name: string,
diff --git a/packages/printer-core/src/template/TemplateDocument.ts b/packages/printer-core/src/template/TemplateDocument.ts
index 00651f1..a6bd653 100644
--- a/packages/printer-core/src/template/TemplateDocument.ts
+++ b/packages/printer-core/src/template/TemplateDocument.ts
@@ -29,8 +29,8 @@ export interface TemplateDocument {
   /** Tên hiển thị, VD 'Tem món mặc định'. */
   readonly name: string;
 
-  /** Mã catalog mà template dùng biến, VD 'product-label'. */
-  readonly catalog: string;
+  /** Mã dữ liệu template mà template dùng biến, VD 'product-label'. */
+  readonly dataId: string;
 
   /** Loại giấy. */
   readonly media: TemplateMedia;
diff --git a/packages/printer-core/src/template/builder/RepeatBuilder.ts b/packages/printer-core/src/template/builder/RepeatBuilder.ts
index 0b950a3..9466f82 100644
--- a/packages/printer-core/src/template/builder/RepeatBuilder.ts
+++ b/packages/printer-core/src/template/builder/RepeatBuilder.ts
@@ -4,7 +4,7 @@ import { TemplateNodeBuilder } from './NodeBuilder';
 
 /** Tuỳ chọn của `repeat`. */
 export interface RepeatOptions<TCollection extends string = string, TExpand extends string = string> {
-  /** Tên collection trong catalog. */
+  /** Tên collection trong dữ liệu template. */
   readonly collection: TCollection;
 
   /** Tên biến kiểu `number` của collection để nhân mỗi phần tử thành bấy nhiêu bản sao. */
diff --git a/packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts b/packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts
index ffc9430..dd116bc 100644
--- a/packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts
+++ b/packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts
@@ -10,7 +10,7 @@ import { TemplateNodeIdGenerator, type BuildContext } from './BuildContext';
 import type { TemplateNodeBuilder } from './NodeBuilder';
 import { TemplateScope } from './TemplateScope';
 
-/** Phần catalog mà DSL cần: tên biến/collection để kiểm tra kiểu, `id` + `describe()` để validate. */
+/** Phần dữ liệu template mà DSL cần: tên biến/collection để kiểm tra kiểu, `id` + `describe()` để validate. */
 export interface TemplateDataShape {
   readonly id: string;
 
@@ -24,7 +24,7 @@ export interface TemplateDataShape {
   describe(): TemplateDataDescription;
 }
 
-/** Scope gốc của template: biến gốc + collection cấp 1 của catalog. */
+/** Scope gốc của template: biến gốc + collection cấp 1 của dữ liệu template. */
 export type RootScope<TTemplateData extends TemplateDataShape> = TemplateScope<
   Extract<keyof TTemplateData['variables'], string>,
   TTemplateData['collections']
@@ -49,7 +49,7 @@ export class TemplateBuildError extends Error {
   }
 }
 
-/** Builder của `TemplateDocument`; tạo qua `labelTemplate(catalog)` hoặc `receiptTemplate(catalog)`. */
+/** Builder của `TemplateDocument`; tạo qua `labelTemplate(templateData)` hoặc `receiptTemplate(templateData)`. */
 export class TemplateDocumentBuilder<TTemplateData extends TemplateDataShape, TMedia extends TemplateMedia> {
   private templateId?: string;
 
@@ -60,7 +60,7 @@ export class TemplateDocumentBuilder<TTemplateData extends TemplateDataShape, TM
   private rootContent?: RootContent<TTemplateData>;
 
   constructor(
-    private readonly catalog: TTemplateData,
+    private readonly templateData: TTemplateData,
     private readonly media: TMedia,
   ) {}
 
@@ -89,16 +89,16 @@ export class TemplateDocumentBuilder<TTemplateData extends TemplateDataShape, TM
   }
 
   /**
-   * Tạo `TemplateDocument` JSON thuần. Throw `TemplateBuildError` nếu cấu trúc sai hoặc biến không khớp catalog
-   * (sai scope, sai kiểu...); cảnh báo `deprecated` không chặn.
+   * Tạo `TemplateDocument` JSON thuần. Throw `TemplateBuildError` nếu cấu trúc sai hoặc biến không khớp dữ liệu
+   * template (sai scope, sai kiểu...); cảnh báo `deprecated` không chặn.
    */
   build(): TemplateDocument {
     const document = this.assemble();
     const structureIssues = validateTemplateStructure(document);
     if (structureIssues.length > 0) throw new TemplateBuildError(structureIssues);
 
-    const catalogResult = validateTemplateAgainstData(document, this.catalog.describe());
-    if (catalogResult.errors.length > 0) throw new TemplateBuildError(catalogResult.errors);
+    const templateDataResult = validateTemplateAgainstData(document, this.templateData.describe());
+    if (templateDataResult.errors.length > 0) throw new TemplateBuildError(templateDataResult.errors);
 
     return Object.freeze(document);
   }
@@ -117,7 +117,7 @@ export class TemplateDocumentBuilder<TTemplateData extends TemplateDataShape, TM
       schemaVersion: TEMPLATE_SCHEMA_VERSION,
       id: this.templateId,
       name: this.templateName,
-      catalog: this.catalog.id,
+      dataId: this.templateData.id,
       media: this.media,
       locale: 'vi-VN',
       paper: this.paperSize,
@@ -126,16 +126,16 @@ export class TemplateDocumentBuilder<TTemplateData extends TemplateDataShape, TM
   }
 }
 
-/** Template tem nhãn (chiều cao cố định, có phân trang) dùng biến của `catalog`. */
+/** Template tem nhãn (chiều cao cố định, có phân trang) dùng biến của `templateData`. */
 export function labelTemplate<TTemplateData extends TemplateDataShape>(
-  catalog: TTemplateData,
+  templateData: TTemplateData,
 ): TemplateDocumentBuilder<TTemplateData, 'label'> {
-  return new TemplateDocumentBuilder(catalog, 'label');
+  return new TemplateDocumentBuilder(templateData, 'label');
 }
 
-/** Template hoá đơn giấy cuộn dùng biến của `catalog`. */
+/** Template hoá đơn giấy cuộn dùng biến của `templateData`. */
 export function receiptTemplate<TTemplateData extends TemplateDataShape>(
-  catalog: TTemplateData,
+  templateData: TTemplateData,
 ): TemplateDocumentBuilder<TTemplateData, 'receipt'> {
-  return new TemplateDocumentBuilder(catalog, 'receipt');
+  return new TemplateDocumentBuilder(templateData, 'receipt');
 }
diff --git a/packages/printer-core/src/template/builder/TemplateScope.ts b/packages/printer-core/src/template/builder/TemplateScope.ts
index deeb526..7cc11f0 100644
--- a/packages/printer-core/src/template/builder/TemplateScope.ts
+++ b/packages/printer-core/src/template/builder/TemplateScope.ts
@@ -19,7 +19,7 @@ export type RepeatScope<TNames extends string, TCollections, TName extends NameO
 >;
 
 /**
- * Scope của DSL: chỉ để TypeScript kiểm tra tên biến/collection theo catalog ngay trong editor.
+ * Scope của DSL: chỉ để TypeScript kiểm tra tên biến/collection theo dữ liệu template ngay trong editor.
  * `TNames` là biến dùng được tại đây, `TCollections` là collection lặp được tại đây.
  */
 export class TemplateScope<TNames extends string, TCollections> {
diff --git a/packages/printer-core/src/template/content/Segment.ts b/packages/printer-core/src/template/content/Segment.ts
index 13b3356..5eb10ac 100644
--- a/packages/printer-core/src/template/content/Segment.ts
+++ b/packages/printer-core/src/template/content/Segment.ts
@@ -6,7 +6,7 @@ export interface TextSegment {
   readonly text: string;
 }
 
-/** Đoạn lấy giá trị từ 1 biến catalog hoặc biến có sẵn (`$page`, `$unit`...). */
+/** Đoạn lấy giá trị từ 1 biến dữ liệu template hoặc biến có sẵn (`$page`, `$unit`...). */
 export interface VariableSegment {
   /** Tên biến. */
   readonly var: string;
diff --git a/packages/printer-core/src/template/data/BuiltInVariable.ts b/packages/printer-core/src/template/data/BuiltInVariable.ts
index dd376cc..a6ced6c 100644
--- a/packages/printer-core/src/template/data/BuiltInVariable.ts
+++ b/packages/printer-core/src/template/data/BuiltInVariable.ts
@@ -1,4 +1,4 @@
-/** Tên các biến có sẵn, không cần khai báo trong catalog. */
+/** Tên các biến có sẵn, không cần khai báo trong dữ liệu template. */
 export type BuiltInVariableName =
   | '$position'
   | '$total'
@@ -12,7 +12,7 @@ export type BuiltInVariableName =
 /** Nơi dùng được 1 biến có sẵn: mọi chỗ / trong `repeat` / trong `repeat` có `expand`. */
 export type BuiltInVariableScope = 'document' | 'repeat' | 'expand';
 
-/** Tiền tố dành riêng cho biến có sẵn — catalog không được đặt tên biến bắt đầu bằng ký tự này. */
+/** Tiền tố dành riêng cho biến có sẵn — dữ liệu template không được đặt tên biến bắt đầu bằng ký tự này. */
 export const RESERVED_NAME_PREFIX = '$';
 
 /** Scope hợp lệ của từng biến có sẵn. Mọi biến có sẵn đều có kiểu `number`. */
diff --git a/packages/printer-core/src/template/data/CollectionDefinition.ts b/packages/printer-core/src/template/data/CollectionDefinition.ts
index 621243d..a612569 100644
--- a/packages/printer-core/src/template/data/CollectionDefinition.ts
+++ b/packages/printer-core/src/template/data/CollectionDefinition.ts
@@ -1,6 +1,6 @@
 import type { VariableDefinitionMap } from './VariableDefinition';
 
-/** 1 danh sách lặp được trong catalog (VD danh sách món), kèm biến và collection con của từng phần tử. */
+/** 1 danh sách lặp được trong dữ liệu template (VD danh sách món), kèm biến và collection con của từng phần tử. */
 export interface CollectionDefinition<
   TSource,
   TItem,
diff --git a/packages/printer-core/src/template/data/TemplateDataDefinition.ts b/packages/printer-core/src/template/data/TemplateDataDefinition.ts
index bb5e99f..6073e22 100644
--- a/packages/printer-core/src/template/data/TemplateDataDefinition.ts
+++ b/packages/printer-core/src/template/data/TemplateDataDefinition.ts
@@ -9,10 +9,10 @@ export interface TemplateDataDefinition<
   TVariables extends VariableDefinitionMap<TData> = VariableDefinitionMap<TData>,
   TCollections extends CollectionDefinitionMap<TData> = CollectionDefinitionMap<TData>,
 > extends TemplateDataReader {
-  /** Mã catalog, VD 'product-label'; template tham chiếu qua `TemplateDocument.catalog`. */
+  /** Mã dữ liệu template, VD 'product-label'; template tham chiếu qua `TemplateDocument.dataId`. */
   readonly id: string;
 
-  /** Phiên bản catalog do app tự tăng khi thêm/đổi biến. */
+  /** Phiên bản dữ liệu template do app tự tăng khi thêm/đổi biến. */
   readonly version: number;
 
   /** Data mẫu cho preview/designer. */
@@ -30,13 +30,13 @@ export interface TemplateDataDefinition<
 
 /** Input của `defineTemplateData`. */
 export interface TemplateDataDefinitionInput<TData, TVariables, TCollections> {
-  /** Mã catalog, VD 'product-label'. */
+  /** Mã dữ liệu template, VD 'product-label'. */
   readonly id: string;
 
-  /** Phiên bản catalog. */
+  /** Phiên bản dữ liệu template. */
   readonly version: number;
 
-  /** Data mẫu cho preview/designer; kiểu data của catalog suy ra từ field này. */
+  /** Data mẫu cho preview/designer; kiểu data của dữ liệu template suy ra từ field này. */
   readonly sample: TData;
 
   /** Biến gốc. */
diff --git a/packages/printer-core/src/template/data/TemplateDataDescription.ts b/packages/printer-core/src/template/data/TemplateDataDescription.ts
index 17a6033..a2c60d3 100644
--- a/packages/printer-core/src/template/data/TemplateDataDescription.ts
+++ b/packages/printer-core/src/template/data/TemplateDataDescription.ts
@@ -2,7 +2,7 @@ import type { VariableType } from './VariableType';
 
 /** Metadata JSON của 1 biến — không chứa hàm `get`, dùng được ở designer/BE. */
 export interface VariableDescription {
-  /** Tên biến, duy nhất trong toàn catalog. */
+  /** Tên biến, duy nhất trong toàn dữ liệu template. */
   readonly name: string;
 
   /** Tên hiển thị cho người dùng. */
@@ -20,7 +20,7 @@ export interface VariableDescription {
 
 /** Metadata JSON của 1 collection và toàn bộ biến/collection con của nó. */
 export interface CollectionDescription {
-  /** Tên collection, duy nhất trong toàn catalog. */
+  /** Tên collection, duy nhất trong toàn dữ liệu template. */
   readonly name: string;
 
   /** Tên hiển thị cho người dùng. */
@@ -33,12 +33,12 @@ export interface CollectionDescription {
   readonly collections: readonly CollectionDescription[];
 }
 
-/** Metadata JSON của cả catalog — kết quả của `catalog.describe()`. */
+/** Metadata JSON của cả dữ liệu template — kết quả của `templateData.describe()`. */
 export interface TemplateDataDescription {
-  /** Mã catalog, khớp với `TemplateDocument.catalog`. */
+  /** Mã dữ liệu template, khớp với `TemplateDocument.dataId`. */
   readonly id: string;
 
-  /** Phiên bản catalog do app tự tăng khi thêm/đổi biến. */
+  /** Phiên bản dữ liệu template do app tự tăng khi thêm/đổi biến. */
   readonly version: number;
 
   /** Biến gốc, dùng được ở mọi chỗ trong template. */
diff --git a/packages/printer-core/src/template/data/TemplateDataIndex.ts b/packages/printer-core/src/template/data/TemplateDataIndex.ts
index 8e8448d..da27c27 100644
--- a/packages/printer-core/src/template/data/TemplateDataIndex.ts
+++ b/packages/printer-core/src/template/data/TemplateDataIndex.ts
@@ -2,7 +2,7 @@ import type { TemplateDataDescription, CollectionDescription, VariableDescriptio
 
 /** 1 biến trong bảng tra, kèm collection sở hữu. */
 export interface IndexedVariable {
-  /** Metadata của biến lấy từ `catalog.describe()`. */
+  /** Metadata của biến lấy từ `templateData.describe()`. */
   readonly description: VariableDescription;
 
   /** Tên collection sở hữu biến; `null` là biến gốc. */
@@ -11,7 +11,7 @@ export interface IndexedVariable {
 
 /** 1 collection trong bảng tra, kèm collection cha. */
 export interface IndexedCollection {
-  /** Metadata của collection lấy từ `catalog.describe()`. */
+  /** Metadata của collection lấy từ `templateData.describe()`. */
   readonly description: CollectionDescription;
 
   /** Tên collection cha; `null` là collection cấp 1. */
@@ -32,7 +32,7 @@ interface MutableTemplateDataIndex {
   readonly collections: Map<string, IndexedCollection>;
 }
 
-/** Dựng bảng tra từ `catalog.describe()`. */
+/** Dựng bảng tra từ `templateData.describe()`. */
 export function createTemplateDataIndex(description: TemplateDataDescription): TemplateDataIndex {
   const index: MutableTemplateDataIndex = { variables: new Map(), collections: new Map() };
   indexScope(index, description.variables, description.collections, null);
diff --git a/packages/printer-core/src/template/data/VariableDefinition.ts b/packages/printer-core/src/template/data/VariableDefinition.ts
index 8ed8213..7472a8d 100644
--- a/packages/printer-core/src/template/data/VariableDefinition.ts
+++ b/packages/printer-core/src/template/data/VariableDefinition.ts
@@ -1,6 +1,6 @@
 import type { VariableType } from './VariableType';
 
-/** Khai báo 1 biến trong catalog: tên hiển thị, kiểu, và cách lấy giá trị từ data nguồn. */
+/** Khai báo 1 biến trong dữ liệu template: tên hiển thị, kiểu, và cách lấy giá trị từ data nguồn. */
 export interface VariableDefinition<TSource> {
   /** Tên hiển thị cho người dùng, VD 'Tên bàn'. */
   readonly label: string;
diff --git a/packages/printer-core/src/template/data/VariableType.ts b/packages/printer-core/src/template/data/VariableType.ts
index 163301c..0c4090b 100644
--- a/packages/printer-core/src/template/data/VariableType.ts
+++ b/packages/printer-core/src/template/data/VariableType.ts
@@ -1,2 +1,2 @@
-/** Kiểu giá trị của 1 biến catalog — quyết định format mặc định và luật validate template. */
+/** Kiểu giá trị của 1 biến dữ liệu template — quyết định format mặc định và luật validate template. */
 export type VariableType = 'string' | 'number' | 'money' | 'datetime' | 'boolean' | 'asset';
diff --git a/packages/printer-core/src/template/data/defineTemplateData.ts b/packages/printer-core/src/template/data/defineTemplateData.ts
index 7856f73..e25cbf5 100644
--- a/packages/printer-core/src/template/data/defineTemplateData.ts
+++ b/packages/printer-core/src/template/data/defineTemplateData.ts
@@ -5,7 +5,7 @@ import { createTemplateDataReader } from './TemplateDataReader';
 import type { VariableDefinitionMap } from './VariableDefinition';
 
 /**
- * Khai báo catalog cho 1 loại nội dung in. Kiểu data suy ra từ `sample`.
+ * Khai báo dữ liệu template cho 1 loại nội dung in. Kiểu data suy ra từ `sample`.
  * Throw ngay nếu tên biến/collection trùng ở bất kỳ cấp nào hoặc bắt đầu bằng `$`.
  */
 export function defineTemplateData<
diff --git a/packages/printer-core/src/template/nodes/ImageNode.ts b/packages/printer-core/src/template/nodes/ImageNode.ts
index 871aff6..54be4bb 100644
--- a/packages/printer-core/src/template/nodes/ImageNode.ts
+++ b/packages/printer-core/src/template/nodes/ImageNode.ts
@@ -7,7 +7,7 @@ export interface StaticImageSource {
   readonly asset: string;
 }
 
-/** Ảnh lấy từ 1 biến kiểu `asset` của catalog (VD logo cửa hàng). */
+/** Ảnh lấy từ 1 biến kiểu `asset` của dữ liệu template (VD logo cửa hàng). */
 export interface VariableImageSource {
   /** Tên biến kiểu `asset`. */
   readonly var: string;
@@ -20,7 +20,7 @@ export type ImageNodeSource = StaticImageSource | VariableImageSource;
 export interface ImageNode extends TemplateNodeBase {
   readonly type: 'image';
 
-  /** Nguồn ảnh: asset tĩnh hoặc biến catalog. */
+  /** Nguồn ảnh: asset tĩnh hoặc biến dữ liệu template. */
   readonly source: ImageNodeSource;
 
   /** Style hộp. */
diff --git a/packages/printer-core/src/template/nodes/RepeatNode.ts b/packages/printer-core/src/template/nodes/RepeatNode.ts
index 8c14f4b..8110f3e 100644
--- a/packages/printer-core/src/template/nodes/RepeatNode.ts
+++ b/packages/printer-core/src/template/nodes/RepeatNode.ts
@@ -1,11 +1,11 @@
 import type { TemplateNode } from './TemplateNode';
 import type { TemplateNodeBase } from './TemplateNodeBase';
 
-/** Lặp `template` cho từng phần tử của 1 collection trong catalog. */
+/** Lặp `template` cho từng phần tử của 1 collection trong dữ liệu template. */
 export interface RepeatNode extends TemplateNodeBase {
   readonly type: 'repeat';
 
-  /** Tên collection trong catalog, VD `items`. */
+  /** Tên collection trong dữ liệu template, VD `items`. */
   readonly collection: string;
 
   /** Tên biến kiểu `number` của collection: nhân mỗi phần tử thành đúng số bản sao đó (VD mỗi ly 1 tem). */
diff --git a/packages/printer-core/src/template/parse/parseTemplate.ts b/packages/printer-core/src/template/parse/parseTemplate.ts
index 24aa374..ac077d8 100644
--- a/packages/printer-core/src/template/parse/parseTemplate.ts
+++ b/packages/printer-core/src/template/parse/parseTemplate.ts
@@ -4,7 +4,7 @@ import { validateTemplateStructure } from './validateTemplateStructure';
 
 /**
  * Đọc template từ nguồn không có kiểu (BE, file import) và kiểm tra cấu trúc. Template khác schema hiện tại bị từ
- * chối, không migrate. Không kiểm tra biến có khớp catalog — việc đó là của `validateTemplateAgainstData`.
+ * chối, không migrate. Không kiểm tra biến có khớp dữ liệu template — việc đó là của `validateTemplateAgainstData`.
  */
 export function parseTemplate(json: unknown): ParseResult {
   const issues = validateTemplateStructure(json);
diff --git a/packages/printer-core/src/template/parse/validateTemplateAgainstData.ts b/packages/printer-core/src/template/parse/validateTemplateAgainstData.ts
index d2da0a3..06b6440 100644
--- a/packages/printer-core/src/template/parse/validateTemplateAgainstData.ts
+++ b/packages/printer-core/src/template/parse/validateTemplateAgainstData.ts
@@ -16,7 +16,7 @@ import type { TemplateNode } from '../nodes/TemplateNode';
 import type { TemplateDocument } from '../TemplateDocument';
 import type { TemplateIssue } from './TemplateIssue';
 
-/** Kết quả kiểm tra template theo catalog. */
+/** Kết quả kiểm tra template theo dữ liệu template. */
 export interface TemplateDataValidationResult {
   /** Lỗi chặn — template không resolve đúng được. */
   readonly errors: readonly TemplateIssue[];
@@ -34,7 +34,7 @@ interface ValidationScope {
   readonly expanded: boolean;
 }
 
-/** Trạng thái 1 lần kiểm tra: bảng tra catalog + lỗi/cảnh báo gom được. */
+/** Trạng thái 1 lần kiểm tra: bảng tra dữ liệu template + lỗi/cảnh báo gom được. */
 interface TemplateDataCheck {
   readonly description: TemplateDataDescription;
 
@@ -59,7 +59,7 @@ const BUILT_IN_VARIABLE_TYPE: VariableType = 'number';
 const ROOT_SCOPE: ValidationScope = { collections: [], expanded: false };
 
 /**
- * Kiểm tra template khớp catalog: biến tồn tại và dùng đúng scope, collection/expand hợp lệ, ảnh dùng biến
+ * Kiểm tra template khớp dữ liệu template: biến tồn tại và dùng đúng scope, collection/expand hợp lệ, ảnh dùng biến
  * kiểu `asset`, format hợp kiểu biến. Nhận metadata (`describe()`) nên BE/designer dùng chung được.
  */
 export function validateTemplateAgainstData(
@@ -68,8 +68,8 @@ export function validateTemplateAgainstData(
 ): TemplateDataValidationResult {
   const index = createTemplateDataIndex(description);
   const check: TemplateDataCheck = { description, index, errors: [], warnings: [] };
-  if (template.catalog !== description.id) {
-    addError(check, 'catalog', `template dùng catalog "${template.catalog}", không phải "${description.id}"`);
+  if (template.dataId !== description.id) {
+    addError(check, 'dataId', `template dùng dữ liệu "${template.dataId}", không phải "${description.id}"`);
   }
   checkNode(check, template.root, 'root', ROOT_SCOPE);
   return { errors: check.errors, warnings: check.warnings };
@@ -163,7 +163,7 @@ function checkRepeat(
 ): void {
   const collection = check.index.collections.get(node.collection);
   if (!collection) {
-    addError(check, `${path}.collection`, `catalog không có collection "${node.collection}"`);
+    addError(check, `${path}.collection`, `dữ liệu template không có collection "${node.collection}"`);
     return;
   }
   if (collection.parent !== null && !scope.collections.includes(collection.parent)) {
@@ -230,7 +230,7 @@ function checkVariableUse(
 
   const variable = check.index.variables.get(name);
   if (!variable) {
-    addError(check, path, `catalog "${check.description.id}" không có biến "${name}"`);
+    addError(check, path, `dữ liệu template "${check.description.id}" không có biến "${name}"`);
     return undefined;
   }
   if (variable.collection !== null && !scope.collections.includes(variable.collection)) {
diff --git a/packages/printer-core/src/template/parse/validateTemplateStructure.ts b/packages/printer-core/src/template/parse/validateTemplateStructure.ts
index d615ce3..03e6dde 100644
--- a/packages/printer-core/src/template/parse/validateTemplateStructure.ts
+++ b/packages/printer-core/src/template/parse/validateTemplateStructure.ts
@@ -18,7 +18,7 @@ export function validateTemplateStructure(document: unknown): readonly TemplateI
   }
   cursor.field('id').expectNonEmptyString();
   cursor.field('name').expectNonEmptyString();
-  cursor.field('catalog').expectNonEmptyString();
+  cursor.field('dataId').expectNonEmptyString();
   cursor.field('locale').expectOneOf(LOCALES);
   validatePaper(cursor);
   validateNode(cursor.field('root'), new Set());
diff --git a/packages/printer-core/src/testing/OrderTestData.ts b/packages/printer-core/src/testing/OrderTestData.ts
index 17ef6e8..ac6b329 100644
--- a/packages/printer-core/src/testing/OrderTestData.ts
+++ b/packages/printer-core/src/testing/OrderTestData.ts
@@ -27,7 +27,7 @@ export interface TestOrderItem {
   readonly toppings: readonly TestTopping[];
 }
 
-/** Đơn hàng dùng làm data test cho catalog/resolver/validate. */
+/** Đơn hàng dùng làm data test cho dữ liệu template/resolver/validate. */
 export interface TestOrder {
   /** Mã đơn, VD 'HD001'. */
   readonly code: string;
@@ -83,7 +83,7 @@ export const TEST_ORDER_SAMPLE: TestOrder = {
   ],
 };
 
-/** TemplateDataDefinition đơn hàng dùng chung cho test của catalog, template, resolution, layout. */
+/** TemplateDataDefinition đơn hàng dùng chung cho test của dữ liệu template, template, resolution, layout. */
 export const TEST_ORDER_DATA = defineTemplateData({
   id: 'test-order',
   version: 1,
diff --git a/packages/printer-preview/src/App.tsx b/packages/printer-preview/src/App.tsx
index e68564c..75d7636 100644
--- a/packages/printer-preview/src/App.tsx
+++ b/packages/printer-preview/src/App.tsx
@@ -43,7 +43,7 @@ function renderOutcome(
 
   const languageToUse = languageTouched ? language : defaultLanguageFor(evaluated.template);
   try {
-    const previews = renderPreviews(evaluated.template, evaluated.catalog, parsed.data, languageToUse);
+    const previews = renderPreviews(evaluated.template, evaluated.templateData, parsed.data, languageToUse);
     return { error: null, previews, language: languageToUse };
   } catch (pipelineError) {
     const message = pipelineError instanceof Error ? pipelineError.message : String(pipelineError);
diff --git a/packages/printer-preview/src/defaultSample.ts b/packages/printer-preview/src/defaultSample.ts
index 6379b98..9bb295e 100644
--- a/packages/printer-preview/src/defaultSample.ts
+++ b/packages/printer-preview/src/defaultSample.ts
@@ -53,7 +53,7 @@ const products = defineCollection({
   collections: { toppings },
 });
 
-export const catalog = defineTemplateData({
+export const templateData = defineTemplateData({
   id: 'product-label',
   version: 1,
   sample,
@@ -63,7 +63,7 @@ export const catalog = defineTemplateData({
   collections: { products },
 });
 
-export default labelTemplate(catalog)
+export default labelTemplate(templateData)
   .id('product-label-default')
   .name('Tem món mặc định')
   .paper({ widthMm: 50, heightMm: 30 })
diff --git a/packages/printer-preview/src/evaluateTemplate.ts b/packages/printer-preview/src/evaluateTemplate.ts
index 84a2003..01729bc 100644
--- a/packages/printer-preview/src/evaluateTemplate.ts
+++ b/packages/printer-preview/src/evaluateTemplate.ts
@@ -3,17 +3,22 @@ import * as PrinterCore from 'printer-core';
 import { parseTemplate, type TemplateDataDefinition, type TemplateDocument } from 'printer-core';
 
 export type EvaluateResult =
-  | { readonly status: 'ok'; readonly template: TemplateDocument; readonly catalog: TemplateDataDefinition<unknown> }
+  | {
+      readonly status: 'ok';
+      readonly template: TemplateDocument;
+      readonly templateData: TemplateDataDefinition<unknown>;
+    }
   | { readonly status: 'error'; readonly stage: 'transpile' | 'runtime'; readonly message: string };
 
-/** Module mà code người dùng xuất ra: `export const catalog` + `export default` template. */
+/** Module mà code người dùng xuất ra: `export const templateData` + `export default` template. */
 interface EvaluatedModule {
   default?: unknown;
-  catalog?: unknown;
+  templateData?: unknown;
 }
 
 const EXPORT_HINT =
-  'Code phải `export const catalog = defineTemplateData(...)` và `export default labelTemplate(catalog)...build()` ' +
+  'Code phải `export const templateData = defineTemplateData(...)` và ' +
+  '`export default labelTemplate(templateData)...build()` ' +
   '(hoặc receiptTemplate) — default export phải là 1 TemplateDocument.';
 
 function errorMessage(error: unknown): string {
@@ -54,14 +59,16 @@ function isTemplateDataDefinition(value: unknown): value is TemplateDataDefiniti
 }
 
 function toEvaluateResult(exported: EvaluatedModule): EvaluateResult {
-  if (!isTemplateDataDefinition(exported.catalog)) return { status: 'error', stage: 'runtime', message: EXPORT_HINT };
+  if (!isTemplateDataDefinition(exported.templateData)) {
+    return { status: 'error', stage: 'runtime', message: EXPORT_HINT };
+  }
 
   const parsed = parseTemplate(exported.default);
   if (!parsed.ok) {
     const issues = parsed.issues.map((issue) => `- ${issue.path}: ${issue.message}`).join('\n');
     return { status: 'error', stage: 'runtime', message: `${EXPORT_HINT}\n${issues}` };
   }
-  return { status: 'ok', template: parsed.template, catalog: exported.catalog };
+  return { status: 'ok', template: parsed.template, templateData: exported.templateData };
 }
 
 function executeAndValidate(js: string): EvaluateResult {
diff --git a/packages/printer-preview/src/pipeline.ts b/packages/printer-preview/src/pipeline.ts
index 4ceb90a..c66209b 100644
--- a/packages/printer-preview/src/pipeline.ts
+++ b/packages/printer-preview/src/pipeline.ts
@@ -74,11 +74,11 @@ function renderPage(
 
 export function renderPreviews(
   template: TemplateDocument,
-  catalog: TemplateDataDefinition<unknown>,
+  templateData: TemplateDataDefinition<unknown>,
   data: unknown,
   language: PrinterLanguage,
 ): readonly PagePreview[] {
-  const pages = resolver.resolve(template, data, { catalog, assets: NO_ASSETS });
+  const pages = resolver.resolve(template, data, { templateData, assets: NO_ASSETS });
   return pages.map((page) => renderPage(template, page, language));
 }
 
~~~

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
(cd packages/printer-preview && npx tsc --noEmit && npx vitest run)
npx eslint packages/printer-core/src packages/printer-preview/src
```

Expected: tsc không in gì; jest `319 passed, 319 total`; `printer-preview` tsc sạch, Vitest `12 passed`; eslint `0 errors`.

- [ ] **Step 5: Stage, line-length, commit**

```bash
git add \
  packages/printer-core/README.md \
  packages/printer-core/src/__tests__/template-pipeline-integration.test.ts \
  packages/printer-core/src/resolution/DocumentResolver.ts \
  packages/printer-core/src/resolution/ResolveContext.ts \
  packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts \
  packages/printer-core/src/resolution/__tests__/collectAssetIds.test.ts \
  packages/printer-core/src/resolution/collectAssetIds.ts \
  packages/printer-core/src/resolution/readRepeatEntries.ts \
  packages/printer-core/src/resolution/readVariable.ts \
  packages/printer-core/src/template/TemplateDocument.ts \
  packages/printer-core/src/template/builder/RepeatBuilder.ts \
  packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts \
  packages/printer-core/src/template/builder/TemplateScope.ts \
  packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts \
  packages/printer-core/src/template/content/Segment.ts \
  packages/printer-core/src/template/data/BuiltInVariable.ts \
  packages/printer-core/src/template/data/CollectionDefinition.ts \
  packages/printer-core/src/template/data/TemplateDataDefinition.ts \
  packages/printer-core/src/template/data/TemplateDataDescription.ts \
  packages/printer-core/src/template/data/TemplateDataIndex.ts \
  packages/printer-core/src/template/data/VariableDefinition.ts \
  packages/printer-core/src/template/data/VariableType.ts \
  packages/printer-core/src/template/data/defineTemplateData.ts \
  packages/printer-core/src/template/nodes/ImageNode.ts \
  packages/printer-core/src/template/nodes/RepeatNode.ts \
  packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts \
  packages/printer-core/src/template/parse/__tests__/validateTemplateAgainstData.test.ts \
  packages/printer-core/src/template/parse/parseTemplate.ts \
  packages/printer-core/src/template/parse/validateTemplateAgainstData.ts \
  packages/printer-core/src/template/parse/validateTemplateStructure.ts \
  packages/printer-core/src/testing/OrderTestData.ts \
  packages/printer-preview/src/App.tsx \
  packages/printer-preview/src/__tests__/defaultSample.test.ts \
  packages/printer-preview/src/__tests__/evaluateTemplate.test.ts \
  packages/printer-preview/src/__tests__/pipeline.test.ts \
  packages/printer-preview/src/defaultSample.ts \
  packages/printer-preview/src/evaluateTemplate.ts \
  packages/printer-preview/src/pipeline.ts
git diff --cached -U0 -- '*.ts' '*.tsx' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "refactor: rename catalog field and variables to dataId and templateData" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log -1 --format=%B
git status --short
```

Expected: line-length không in gì; commit thành công đúng 2 dòng message; `git status` chỉ còn `?? .claude/worktrees/`.

---

### Kiểm tra cuối (sau Task 3)

```bash
grep -rni "catalog" packages/printer-core packages/printer-preview/src --include=*.ts --include=*.tsx --include=*.md --exclude-dir=node_modules
ls packages/printer-core/src/catalog
```

Expected: grep không in gì; `ls` báo không có thư mục `catalog`.
