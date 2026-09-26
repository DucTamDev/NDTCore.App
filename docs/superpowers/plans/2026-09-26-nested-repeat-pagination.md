# Nested Repeat Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho `repeat` lồng (VD topping) tách sang tem tiếp theo theo `maxItemsPerPage`. Tem tiếp in lại toàn bộ nội dung của phần tử, template tự đánh dấu tem tiếp bằng 2 biến có sẵn mới `$part`/`$partCount`.

**Architecture:**
- **Lập kế hoạch trang:** trước khi resolve, resolver lập kế hoạch trang (`planPages`). Trang thứ k ứng với cặp (phần tử của repeat ngoài cùng, phần thứ j của phần tử đó), lưu trong `PageInfo.part`.
- **Chia phần tử:** khi resolve, repeat ngoài cùng lấy đúng phần tử của trang; repeat lồng lấy đúng nhóm phần tử của phần.
- **Validate:** 3 ràng buộc mới chạy sau validate cấu trúc, để template sai báo lỗi rõ thay vì in lệch.

**Tech Stack:**
- TypeScript 5.9 strict.
- Jest (preset react-native) cho `printer-core`.
- Vitest cho `printer-preview`.
- `printer-core` không có dependency.

**Spec:** `docs/superpowers/specs/2026-09-26-nested-repeat-pagination-design.md`. Spec này mở rộng template model của `docs/superpowers/specs/2026-09-24-template-model-design.md`.

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

**Ràng buộc khác:**

- **Branch:** làm trên `feat/nested-repeat-pagination` (đã có commit spec và commit của plan này). Checkout thẳng trong working directory chính — **không dùng git worktree**, không commit thẳng `main`.
- **Dependency:** `printer-core` giữ zero-dependency.
- **Stage file:** chỉ stage đúng file của task (lệnh `git add` cho sẵn trong từng task). **Không bao giờ** `git add -A` hay `git add .`. `.claude/worktrees/` giữ untracked.
- **Commit message:** dạng `<type>: <mô tả ngắn>`, dùng đúng 2 tham số `-m` cho trong task. Dòng cuối là `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, nguyên văn, không thay bằng tên model khác.
- **Nơi chạy lệnh:** mọi lệnh chạy từ `C:\NDTCORE\NDTCore\NDTCore.App` bằng Git Bash.
- **Phạm vi quy ước 4 và 10:** chỉ áp cho dòng plan này thêm hoặc sửa; dòng cũ không đụng tới thì để nguyên.

### Cách áp code của plan

Code của mỗi task nằm trong các khối patch của chính file này. Mỗi khối có đánh dấu `<!-- patch:<id> -->` đứng ngay trước khối `~~~diff`. Mỗi task có 1 patch test (`tN-test`) và 1 patch implementation (`tN-impl`).

**Lệnh áp 1 patch** (thay `<id>`; mỗi step đã ghi sẵn lệnh đầy đủ):

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-26-nested-repeat-pagination.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" <id> | git apply --ignore-whitespace -
```

- `--ignore-whitespace` cần thiết vì working tree có file CRLF lẫn LF (autocrlf).
- Lúc lập plan, cả 8 patch đã được áp lần lượt lên clone của branch này (checkout CRLF) và cho ra đúng nội dung đã kiểm chứng.
- **Nếu `git apply` báo lỗi: dừng lại, báo BLOCKED kèm nguyên văn lỗi.** Không tự sửa tay để "vá cho khớp".

### Lệnh verify dùng chung

Chạy từ `NDTCore.App`:

- **Type-check `printer-core`:**
  ```bash
  npx tsc --noEmit -p packages/printer-core
  ```
  Expected: không in gì.

- **Full test `printer-core`:**
  ```bash
  npx jest packages/printer-core
  ```
  Expected: con số ghi trong từng task, không có suite fail. Lần chạy đầu khi cache Jest còn nguội có thể có 1 suite lỗi — chạy lại 1 lần; vẫn fail thì là lỗi thật.

- **ESLint cho file `.ts` đã stage:**
  ```bash
  npx eslint $(git diff --cached --name-only --diff-filter=AM -- '*.ts')
  ```
  Expected: không in gì.

- **Line-length cho dòng đã stage:**
  ```bash
  git diff --cached -U0 -- '*.ts' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
  ```
  Expected: không in gì, exit 0.

## Review Focus

Các trường hợp spec ngụ ý nhưng dễ bị bỏ sót, xếp theo khả năng gây hại cao nhất trước. Mỗi dòng đã có test chốt trong Task 2.

1. **Số topping chia hết cho N** (VD 8 topping, N = 4).
   - Mong đợi: đúng 2 tem, không sinh tem thứ 3 rỗng.
2. **Món có `expand` lỗi** (VD số lượng 0) nằm cùng đơn với món nhiều topping.
   - Mong đợi: chỉ trang của món lỗi báo lỗi; món khác vẫn tách tem đúng.
3. **Một repeat ngoài cùng khác (có `maxItemsPerPage`) dài hơn kế hoạch tách tem.**
   - Mong đợi: các trang dư không in lại món tách tem; `$part`/`$partCount` về 1/1.
4. **`repeat` topping nằm trong node đang bị ẩn** (`visibleWhen` sai).
   - Mong đợi: vẫn được đếm phần (theo spec), chỉ không in topping.
5. **Template chưa qua `parseTemplate`** (dựng tay) đặt `maxItemsPerPage` ở `repeat` lồng mà repeat ngoài không phân trang.
   - Mong đợi: không lỗi, in đủ topping như trước.

## Các quyết định lệch khỏi spec (đã chốt khi lập plan)

| # | Spec | Plan | Lý do |
|---|---|---|---|
| 1 | Sửa `resolution/countPages.ts` | Thay bằng file mới `resolution/planPages.ts` (hàm `planPages`), xoá `countPages.ts` | Hàm giờ trả kế hoạch trang (phần tem từng trang) chứ không chỉ số trang; tên cũ sai nghĩa |
| 2 | 3 ràng buộc đặt trong `validateNode.ts` | Đặt trong file mới `template/parse/validateRepeatPagination.ts`, gọi từ `validateTemplateStructure` khi cấu trúc không còn lỗi | Ràng buộc cần nhìn cả cây (tầng lồng, số repeat mang phần tem), khác kiểu kiểm tra từng node của `validateNode`; chạy trên cấu trúc lỗi sẽ báo trùng lỗi kiểu |
| 3 | `PageInfo` mang thêm thứ tự phần/tổng phần và phần tử của trang | `PageInfo.part?: PagePart` với `{ repeatId, itemIndex, number, count }`; không có khi trang không tách tem | Gom 4 giá trị luôn đi cùng nhau; `repeatId` để repeat ngoài cùng khác (anh em) không nhận nhầm kế hoạch |
| 4 | Không nói | Tách `entryFrame(node, entry, index, total)` vào `readRepeatEntries.ts` | Resolver và bước lập kế hoạch cần dựng cùng 1 tầng scope cho phần tử |
| 5 | Validate lỗi "`repeat` lồng từ tầng 2 trở xuống" gộp chung với "repeat ngoài không phân trang" | Tách 2 câu lỗi riêng | Chỉ rõ cho người sửa template biết cần sửa ở đâu |

## Cấu trúc file sau khi xong

```text
packages/printer-core/src/
├── catalog/BuiltInVariable.ts        # + $part, $partCount (scope document)
├── resolution/
│   ├── ResolveContext.ts             # + PagePart, PageInfo.part
│   ├── readVariable.ts               # đọc $part/$partCount
│   ├── readRepeatEntries.ts          # + entryFrame()
│   ├── planPages.ts                  # MỚI — thay countPages.ts
│   ├── resolveNode.ts                # chia phần tử theo kế hoạch trang
│   └── DocumentResolver.ts           # dùng planPages
├── template/
│   ├── nodes/RepeatNode.ts           # JSDoc maxItemsPerPage
│   └── parse/
│       ├── validateRepeatPagination.ts   # MỚI — 3 ràng buộc
│       └── validateTemplateStructure.ts  # gọi validateRepeatPagination
└── README.md                          # mục "Phân trang tem"
packages/printer-preview/src/defaultSample.ts  # mẫu tem món tách topping 4/tem
```

---

### Task 1: Biến có sẵn `$part`/`$partCount` và `PageInfo.part`

**Files:**
- Modify: `catalog/BuiltInVariable.ts`, `resolution/ResolveContext.ts`, `resolution/readVariable.ts`
- Test: `resolution/__tests__/DocumentResolver.test.ts`

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: không có.
- Produces:
  - `BuiltInVariableName` thêm `'$part' | '$partCount'`; `BUILT_IN_VARIABLE_SCOPES` cho cả 2 scope `'document'`.
  - `resolution/ResolveContext.ts`:
    - `interface PagePart { readonly repeatId: string; readonly itemIndex: number; readonly number: number; readonly count: number }`
    - `PageInfo.part?: PagePart` — không có khi trang không tách tem.
  - `readVariable`: `$part` = `page.part?.number ?? 1`, `$partCount` = `page.part?.count ?? 1`.

- [ ] **Step 1: Kiểm tra branch và working tree**

```bash
git branch --show-current
git status --short
git log --oneline -3
```

Expected:
- Branch là `feat/nested-repeat-pagination`.
- Commit mới nhất là `docs: add nested repeat pagination implementation plan`, trước đó là `docs: add nested repeat pagination design`.
- `git status` chỉ có file untracked (`??`, VD `.claude/worktrees/`).

Nếu có thay đổi chưa commit ở file đã track: **dừng lại, hỏi user**. Không tự stash hay revert.

- [ ] **Step 2: Áp patch test**

Thêm test `$part/$partCount dùng được ở mọi chỗ, là 1/1 khi không tách tem` vào `resolution/__tests__/DocumentResolver.test.ts` (nhóm "biến có sẵn dùng sai scope").

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-26-nested-repeat-pagination.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t1-test | git apply --ignore-whitespace -
```

<!-- patch:t1-test -->
~~~diff
diff --git a/packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts b/packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
index 563f428..a75b1ad 100644
--- a/packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
+++ b/packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
@@ -1,6 +1,6 @@
 import { createDocumentResolver, type AssetProvider, type ResolvedNode, type ResolvedPage } from '..';
 import { defineCatalog, defineCollection } from '../../catalog';
-import type { TemplateDocument, TemplateMedia, TemplateNode } from '../../template';
+import type { TemplateDocument, TemplateMedia, TemplateNode, TextNode } from '../../template';
 import { TEST_ORDER_CATALOG, TEST_ORDER_SAMPLE, type TestOrder } from '../../testing';
 import type { Bitmap } from '../../types';
 
@@ -359,6 +359,27 @@ describe('DocumentResolver — biến có sẵn dùng sai scope', () => {
 
     expect(pageTexts(resolvePages(root)[0])).toEqual(['1']);
   });
+
+  it('$part/$partCount dùng được ở mọi chỗ, là 1/1 khi không tách tem', () => {
+    const partContent: TextNode['content'] = [{ var: '$part' }, { text: '/' }, { var: '$partCount' }];
+    const root: TemplateNode = {
+      type: 'container',
+      id: 'root',
+      children: [
+        { type: 'text', id: 'part', content: partContent },
+        {
+          type: 'repeat',
+          id: 'items',
+          collection: 'items',
+          expand: 'quantity',
+          maxItemsPerPage: 1,
+          template: { type: 'text', id: 'item-part', content: partContent },
+        },
+      ],
+    };
+
+    expect(resolvePages(root).map(pageTexts)).toEqual(Array.from({ length: 5 }, () => ['1/1', '1/1']));
+  });
 });
 
 describe('DocumentResolver — điều kiện', () => {
~~~

- [ ] **Step 3: Chạy test, xác nhận FAIL**

```bash
npx jest packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
```

Expected: FAIL — catalog chưa biết biến `$part`, trang resolve thành lỗi nên `pageTexts` throw. Lúc lập plan: `Tests: 1 failed, 39 passed, 40 total`.

- [ ] **Step 4: Áp patch implementation**

Thêm 2 tên biến + scope, `PagePart` + `PageInfo.part`, và 2 hàm đọc biến trong `readVariable.ts`.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-26-nested-repeat-pagination.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t1-impl | git apply --ignore-whitespace -
```

<!-- patch:t1-impl -->
~~~diff
diff --git a/packages/printer-core/src/catalog/BuiltInVariable.ts b/packages/printer-core/src/catalog/BuiltInVariable.ts
index 809db3f..dd376cc 100644
--- a/packages/printer-core/src/catalog/BuiltInVariable.ts
+++ b/packages/printer-core/src/catalog/BuiltInVariable.ts
@@ -1,5 +1,13 @@
 /** Tên các biến có sẵn, không cần khai báo trong catalog. */
-export type BuiltInVariableName = '$position' | '$total' | '$unit' | '$unitCount' | '$page' | '$pageCount';
+export type BuiltInVariableName =
+  | '$position'
+  | '$total'
+  | '$unit'
+  | '$unitCount'
+  | '$page'
+  | '$pageCount'
+  | '$part'
+  | '$partCount';
 
 /** Nơi dùng được 1 biến có sẵn: mọi chỗ / trong `repeat` / trong `repeat` có `expand`. */
 export type BuiltInVariableScope = 'document' | 'repeat' | 'expand';
@@ -15,6 +23,8 @@ export const BUILT_IN_VARIABLE_SCOPES: Readonly<Record<BuiltInVariableName, Buil
   $unitCount: 'expand',
   $page: 'document',
   $pageCount: 'document',
+  $part: 'document',
+  $partCount: 'document',
 };
 
 /** Kiểm tra 1 tên có phải biến có sẵn không. */
diff --git a/packages/printer-core/src/resolution/ResolveContext.ts b/packages/printer-core/src/resolution/ResolveContext.ts
index 03d7c5b..0da3596 100644
--- a/packages/printer-core/src/resolution/ResolveContext.ts
+++ b/packages/printer-core/src/resolution/ResolveContext.ts
@@ -28,6 +28,21 @@ export interface ScopeFrame {
   readonly expanded: boolean;
 }
 
+/** Phần tem của 1 phần tử khi `repeat` lồng bị tách sang nhiều tem. */
+export interface PagePart {
+  /** `id` của repeat ngoài cùng chứa `repeat` lồng được tách. */
+  readonly repeatId: string;
+
+  /** Vị trí (từ 0) của phần tử repeat ngoài cùng được in trên trang này. */
+  readonly itemIndex: number;
+
+  /** Thứ tự phần, từ 1. */
+  readonly number: number;
+
+  /** Tổng số phần của phần tử. */
+  readonly count: number;
+}
+
 /** Thông tin trang đang resolve. */
 export interface PageInfo {
   /** Số trang, đếm từ 1. */
@@ -35,6 +50,9 @@ export interface PageInfo {
 
   /** Tổng số trang. */
   readonly pageCount: number;
+
+  /** Phần tem của trang; không có khi template không tách `repeat` lồng hoặc trang không ứng với phần tử nào. */
+  readonly part?: PagePart;
 }
 
 /** Trang giả lập khi đếm trang (chưa biết tổng số trang thật) — `$page`/`$pageCount` đọc được là 1/1. */
diff --git a/packages/printer-core/src/resolution/readVariable.ts b/packages/printer-core/src/resolution/readVariable.ts
index f298d50..d119156 100644
--- a/packages/printer-core/src/resolution/readVariable.ts
+++ b/packages/printer-core/src/resolution/readVariable.ts
@@ -16,6 +16,8 @@ const BUILT_IN_VARIABLE_READERS: Readonly<Record<BuiltInVariableName, BuiltInVar
   $unitCount: (context) => innermostFrame(context).unitCount,
   $page: (context) => context.page.pageNumber,
   $pageCount: (context) => context.page.pageCount,
+  $part: (context) => context.page.part?.number ?? 1,
+  $partCount: (context) => context.page.part?.count ?? 1,
 };
 
 /**
~~~

- [ ] **Step 5: Chạy test của task, xác nhận PASS**

```bash
npx jest packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
```

Expected: PASS — `Tests: 40 passed, 40 total`.

- [ ] **Step 6: Verify toàn package**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
```

Expected: tsc không in gì; jest `Test Suites: 94 passed, 94 total Tests: 708 passed, 708 total`.

- [ ] **Step 7: Stage, eslint, line-length, commit**

```bash
git add \
  packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts \
  packages/printer-core/src/catalog/BuiltInVariable.ts \
  packages/printer-core/src/resolution/ResolveContext.ts \
  packages/printer-core/src/resolution/readVariable.ts
npx eslint $(git diff --cached --name-only --diff-filter=AM -- '*.ts')
git diff --cached -U0 -- '*.ts' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "feat: add $part and $partCount built-in variables" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log -1 --format=%B
```

Expected: eslint và line-length không in gì; commit thành công, message đúng 2 dòng như lệnh.

---

### Task 2: Kế hoạch trang và chia `repeat` lồng theo phần tem

**Files:**
- Create: `resolution/planPages.ts`
- Modify: `resolution/DocumentResolver.ts`, `resolution/readRepeatEntries.ts`, `resolution/resolveNode.ts`
- Delete: `resolution/countPages.ts`
- Test: `resolution/__tests__/DocumentResolver.test.ts`

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: `PagePart`, `PageInfo.part` (Task 1).
- Produces:
  - `resolution/planPages.ts` — `planPages(root: TemplateNode, context: ResolveContext): readonly (PagePart | undefined)[]`:
    - Mỗi phần tử là 1 trang; số trang = max các repeat ngoài cùng có `maxItemsPerPage`, tối thiểu 1.
    - Repeat ngoài cùng có repeat lồng khai báo `maxItemsPerPage`: mỗi phần tử chiếm `max(1, ceil(n / N))` trang (max trên các repeat lồng).
  - `resolution/readRepeatEntries.ts` — `entryFrame(node, entry, index, total): ScopeFrame`.
  - `resolveNode`:
    - Repeat ngoài cùng có `page.part?.repeatId === node.id` → chỉ phần tử `page.part.itemIndex`.
    - Repeat lồng có `maxItemsPerPage` → nhóm `[(part.number − 1) × N, part.number × N)`; không có `page.part` thì in cả danh sách.
  - `DocumentResolver` dùng `planPages`; xoá `countPages.ts`.

- [ ] **Step 1: Áp patch test**

Thêm nhóm `DocumentResolver — tách repeat lồng sang nhiều tem` (10 test) vào `resolution/__tests__/DocumentResolver.test.ts`, gồm cả 5 trường hợp Review Focus. Helper test mới:
- `toppingsOf`, `drink`, `orderWith` — dựng data.
- `toppingRepeat`, `toppingLabel` — dựng template.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-26-nested-repeat-pagination.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t2-test | git apply --ignore-whitespace -
```

<!-- patch:t2-test -->
~~~diff
diff --git a/packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts b/packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
index a75b1ad..d3ee5eb 100644
--- a/packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
+++ b/packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
@@ -1,7 +1,13 @@
 import { createDocumentResolver, type AssetProvider, type ResolvedNode, type ResolvedPage } from '..';
 import { defineCatalog, defineCollection } from '../../catalog';
 import type { TemplateDocument, TemplateMedia, TemplateNode, TextNode } from '../../template';
-import { TEST_ORDER_CATALOG, TEST_ORDER_SAMPLE, type TestOrder } from '../../testing';
+import {
+  TEST_ORDER_CATALOG,
+  TEST_ORDER_SAMPLE,
+  type TestOrder,
+  type TestOrderItem,
+  type TestTopping,
+} from '../../testing';
 import type { Bitmap } from '../../types';
 
 const LOGO_BITMAP: Bitmap = { data: new Uint8Array(8), width: 8, height: 8, bytesPerRow: 1 };
@@ -326,6 +332,203 @@ describe('DocumentResolver — lặp, expand, phân trang', () => {
   });
 });
 
+function toppingsOf(count: number): readonly TestTopping[] {
+  return Array.from({ length: count }, (_, index) => ({ name: `T${index + 1}`, price: 5000 }));
+}
+
+function drink(
+  name: string,
+  quantity: number,
+  toppingCount: number,
+): TestOrderItem {
+  return { name, quantity, price: 45000, toppings: toppingsOf(toppingCount) };
+}
+
+function orderWith(items: readonly TestOrderItem[]): TestOrder {
+  return { ...TEST_ORDER_SAMPLE, items };
+}
+
+function toppingRepeat(id: string, toppingsPerPart: number): TemplateNode {
+  return {
+    type: 'repeat',
+    id,
+    collection: 'toppings',
+    maxItemsPerPage: toppingsPerPart,
+    template: {
+      type: 'text',
+      id: `${id}-name`,
+      content: [{ var: 'toppingName' }, { text: ' ' }, { var: '$position' }, { text: '/' }, { var: '$total' }],
+    },
+  };
+}
+
+/** Tem món: mỗi ly 1 tem, topping tách theo `toppingsPerPart`, dòng cuối là phần tem. */
+function toppingLabel(partRepeats: readonly TemplateNode[] = [toppingRepeat('toppings', 4)]): TemplateNode {
+  return {
+    type: 'repeat',
+    id: 'items',
+    collection: 'items',
+    expand: 'quantity',
+    maxItemsPerPage: 1,
+    template: {
+      type: 'container',
+      id: 'item',
+      children: [
+        {
+          type: 'text',
+          id: 'name',
+          content: [{ var: 'itemName' }, { text: ' ' }, { var: '$unit' }, { text: '/' }, { var: '$unitCount' }],
+        },
+        ...partRepeats,
+        {
+          type: 'text',
+          id: 'part',
+          content: [{ text: 'phần ' }, { var: '$part' }, { text: '/' }, { var: '$partCount' }],
+        },
+      ],
+    },
+  };
+}
+
+describe('DocumentResolver — tách repeat lồng sang nhiều tem', () => {
+  it('9 topping, mỗi tem 4 → 3 tem nhóm 4/4/1, $position tuyệt đối, $part/$partCount theo phần', () => {
+    const pages = resolvePages(toppingLabel(), orderWith([drink('Trà sữa', 1, 9)]));
+
+    expect(pages.map(pageTexts)).toEqual([
+      ['Trà sữa 1/1', 'T1 1/9', 'T2 2/9', 'T3 3/9', 'T4 4/9', 'phần 1/3'],
+      ['Trà sữa 1/1', 'T5 5/9', 'T6 6/9', 'T7 7/9', 'T8 8/9', 'phần 2/3'],
+      ['Trà sữa 1/1', 'T9 9/9', 'phần 3/3'],
+    ]);
+  });
+
+  it('số topping chia hết cho N thì không sinh tem rỗng', () => {
+    const pages = resolvePages(toppingLabel(), orderWith([drink('Trà sữa', 1, 8)]));
+
+    expect(pages.map((page) => pageTexts(page).at(-1))).toEqual(['phần 1/2', 'phần 2/2']);
+  });
+
+  it('món số lượng 2 lặp đủ các phần cho từng ly; $page đánh số liên tục', () => {
+    const root: TemplateNode = {
+      type: 'container',
+      id: 'root',
+      children: [
+        { type: 'text', id: 'page', content: [{ var: '$page' }, { text: '/' }, { var: '$pageCount' }] },
+        toppingLabel(),
+      ],
+    };
+
+    const pages = resolvePages(root, orderWith([drink('Trà sữa', 2, 5)]));
+
+    expect(pages.map(pageTexts)).toEqual([
+      ['1/4', 'Trà sữa 1/2', 'T1 1/5', 'T2 2/5', 'T3 3/5', 'T4 4/5', 'phần 1/2'],
+      ['2/4', 'Trà sữa 1/2', 'T5 5/5', 'phần 2/2'],
+      ['3/4', 'Trà sữa 2/2', 'T1 1/5', 'T2 2/5', 'T3 3/5', 'T4 4/5', 'phần 1/2'],
+      ['4/4', 'Trà sữa 2/2', 'T5 5/5', 'phần 2/2'],
+    ]);
+  });
+
+  it('món không có topping vẫn in 1 tem, $part/$partCount là 1/1', () => {
+    const pages = resolvePages(toppingLabel(), orderWith([drink('Cà phê', 1, 0)]));
+
+    expect(pages.map(pageTexts)).toEqual([['Cà phê 1/1', 'phần 1/1']]);
+  });
+
+  it('nhiều món có số phần khác nhau xếp theo thứ tự món rồi tới phần', () => {
+    const pages = resolvePages(toppingLabel(), orderWith([drink('Trà sữa', 1, 5), drink('Cà phê', 1, 1)]));
+
+    expect(pages.map((page) => [pageTexts(page)[0], pageTexts(page).at(-1)])).toEqual([
+      ['Trà sữa 1/1', 'phần 1/2'],
+      ['Trà sữa 1/1', 'phần 2/2'],
+      ['Cà phê 1/1', 'phần 1/1'],
+    ]);
+  });
+
+  it('2 repeat lồng trong cùng món: số phần theo repeat dài nhất, repeat ngắn rỗng ở phần dư', () => {
+    const root = toppingLabel([toppingRepeat('by-two', 2), toppingRepeat('by-four', 4)]);
+
+    const pages = resolvePages(root, orderWith([drink('Trà sữa', 1, 5)]));
+
+    expect(pages.map(pageTexts)).toEqual([
+      ['Trà sữa 1/1', 'T1 1/5', 'T2 2/5', 'T1 1/5', 'T2 2/5', 'T3 3/5', 'T4 4/5', 'phần 1/3'],
+      ['Trà sữa 1/1', 'T3 3/5', 'T4 4/5', 'T5 5/5', 'phần 2/3'],
+      ['Trà sữa 1/1', 'T5 5/5', 'phần 3/3'],
+    ]);
+  });
+
+  it('món expand lỗi chỉ làm lỗi đúng 1 trang của nó, món khác vẫn tách tem', () => {
+    const pages = resolvePages(toppingLabel(), orderWith([drink('Trà sữa', 0, 5), drink('Cà phê', 1, 5)]));
+
+    expect(pages.map((page) => page.status)).toEqual(['error', 'ok', 'ok']);
+    expect(pages.slice(1).map((page) => pageTexts(page).at(-1))).toEqual(['phần 1/2', 'phần 2/2']);
+  });
+
+  it('repeat lồng nằm trong node đang bị ẩn vẫn được đếm phần, chỉ không in topping', () => {
+    const hiddenToppings: TemplateNode = {
+      type: 'container',
+      id: 'hidden',
+      visibleWhen: { op: 'eq', var: 'itemName', value: 'không có món này' },
+      children: [toppingRepeat('toppings', 4)],
+    };
+
+    const pages = resolvePages(toppingLabel([hiddenToppings]), orderWith([drink('Trà sữa', 1, 5)]));
+
+    expect(pages.map(pageTexts)).toEqual([
+      ['Trà sữa 1/1', 'phần 1/2'],
+      ['Trà sữa 1/1', 'phần 2/2'],
+    ]);
+  });
+
+  it('repeat ngoài cùng khác dài hơn thì các trang dư không in món tách tem, $part về 1/1', () => {
+    const root: TemplateNode = {
+      type: 'container',
+      id: 'root',
+      children: [
+        { type: 'text', id: 'root-part', content: [{ var: '$part' }, { text: '/' }, { var: '$partCount' }] },
+        {
+          type: 'repeat',
+          id: 'items',
+          collection: 'items',
+          maxItemsPerPage: 1,
+          template: {
+            type: 'container',
+            id: 'item',
+            children: [{ type: 'text', id: 'name', content: [{ var: 'itemName' }] }, toppingRepeat('toppings', 2)],
+          },
+        },
+        {
+          type: 'repeat',
+          id: 'units',
+          collection: 'items',
+          expand: 'quantity',
+          maxItemsPerPage: 1,
+          template: { type: 'text', id: 'unit', content: [{ text: 'ly ' }, { var: '$unit' }] },
+        },
+      ],
+    };
+
+    const pages = resolvePages(root, orderWith([drink('Trà sữa', 3, 3)]));
+
+    expect(pages.map(pageTexts)).toEqual([
+      ['1/2', 'Trà sữa', 'T1 1/3', 'T2 2/3', 'ly 1'],
+      ['2/2', 'Trà sữa', 'T3 3/3', 'ly 2'],
+      ['1/1', 'ly 3'],
+    ]);
+  });
+
+  it('repeat ngoài không phân trang thì repeat lồng in đủ topping (template chưa qua validate)', () => {
+    const root: TemplateNode = {
+      type: 'repeat',
+      id: 'items',
+      collection: 'items',
+      template: toppingRepeat('toppings', 2),
+    };
+
+    const pages = resolvePages(root, orderWith([drink('Trà sữa', 1, 3)]));
+
+    expect(pages.map(pageTexts)).toEqual([['T1 1/3', 'T2 2/3', 'T3 3/3']]);
+  });
+});
+
 describe('DocumentResolver — biến có sẵn dùng sai scope', () => {
   it('$position ở gốc (không trong repeat) thành trang lỗi', () => {
     const root: TemplateNode = { type: 'text', id: 'pos', content: [{ var: '$position' }] };
~~~

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
npx jest packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
```

Expected: FAIL — resolver chưa tách repeat lồng nên chỉ in 1 tem mỗi ly, còn `$part`/`$partCount` luôn 1/1. Lúc lập plan: `Tests: 8 failed, 42 passed, 50 total`.

- [ ] **Step 3: Áp patch implementation**

Thêm `planPages.ts` và `entryFrame`; đổi `entryRangeForPage` trong `resolveNode.ts`; `DocumentResolver` dùng kế hoạch trang; xoá `countPages.ts`.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-26-nested-repeat-pagination.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t2-impl | git apply --ignore-whitespace -
```

<!-- patch:t2-impl -->
~~~diff
diff --git a/packages/printer-core/src/resolution/DocumentResolver.ts b/packages/printer-core/src/resolution/DocumentResolver.ts
index 42ea52f..32f6fd5 100644
--- a/packages/printer-core/src/resolution/DocumentResolver.ts
+++ b/packages/printer-core/src/resolution/DocumentResolver.ts
@@ -1,8 +1,8 @@
 import { createCatalogIndex, type Catalog } from '../catalog';
 import type { TemplateDocument, TemplateNode } from '../template';
 import type { AssetProvider } from './AssetProvider';
-import { countPages } from './countPages';
-import { COUNTING_PAGE, createRootFrame, type ResolveContext } from './ResolveContext';
+import { planPages } from './planPages';
+import { COUNTING_PAGE, createRootFrame, type PagePart, type ResolveContext } from './ResolveContext';
 import type { ResolvedPage } from './ResolvedPage';
 import { ResolveError } from './ResolveError';
 import { resolveNode } from './resolveNode';
@@ -38,14 +38,23 @@ export class DocumentResolver {
       frames: [createRootFrame(data)],
       page: COUNTING_PAGE,
     };
-    const pageCount = countPages(template.root, baseContext);
+    const parts = planPages(template.root, baseContext);
 
-    return Array.from({ length: pageCount }, (_, pageIndex) =>
-      resolvePage(template.root, { ...baseContext, page: { pageNumber: pageIndex + 1, pageCount } }),
+    return parts.map((part, pageIndex) =>
+      resolvePage(template.root, { ...baseContext, page: pageInfo(pageIndex, parts.length, part) }),
     );
   }
 }
 
+function pageInfo(
+  pageIndex: number,
+  pageCount: number,
+  part: PagePart | undefined,
+): ResolveContext['page'] {
+  const page = { pageNumber: pageIndex + 1, pageCount };
+  return part ? { ...page, part } : page;
+}
+
 function resolvePage(root: TemplateNode, context: ResolveContext): ResolvedPage {
   const pageIndex = context.page.pageNumber - 1;
   try {
diff --git a/packages/printer-core/src/resolution/countPages.ts b/packages/printer-core/src/resolution/countPages.ts
deleted file mode 100644
index 9f2fea7..0000000
--- a/packages/printer-core/src/resolution/countPages.ts
+++ /dev/null
@@ -1,43 +0,0 @@
-import type { RepeatNode, TemplateNode } from '../template';
-import { isNodeVisible } from './evaluateCondition';
-import { readRepeatEntries } from './readRepeatEntries';
-import type { ResolveContext } from './ResolveContext';
-import { ResolveError } from './ResolveError';
-
-/**
- * Số trang = max của các `repeat` cấp ngoài cùng có `maxItemsPerPage`, tính trên danh sách sau expand; tối thiểu 1.
- * Lỗi gặp khi đếm không chặn ở đây — lỗi đó sẽ hiện ra đúng trang khi resolve.
- */
-export function countPages(root: TemplateNode, context: ResolveContext): number {
-  return Math.max(1, ...collectPageCounts(root, context));
-}
-
-function collectPageCounts(node: TemplateNode, context: ResolveContext): readonly number[] {
-  if (!isVisibleWhileCounting(node, context)) return [];
-
-  if (node.type === 'container') return node.children.flatMap((child) => collectPageCounts(child, context));
-  if (node.type === 'repeat') return [countRepeatPages(node, context)];
-  return [];
-}
-
-// Repeat lồng không phân trang, nên không đi sâu vào `template` của repeat.
-function countRepeatPages(node: RepeatNode, context: ResolveContext): number {
-  const perPage = node.maxItemsPerPage;
-  if (perPage === undefined) return 1;
-
-  try {
-    return Math.ceil(readRepeatEntries(node, context).length / perPage);
-  } catch (error) {
-    if (error instanceof ResolveError) return 1;
-    throw error;
-  }
-}
-
-function isVisibleWhileCounting(node: TemplateNode, context: ResolveContext): boolean {
-  try {
-    return isNodeVisible(node, context);
-  } catch (error) {
-    if (error instanceof ResolveError) return true;
-    throw error;
-  }
-}
diff --git a/packages/printer-core/src/resolution/planPages.ts b/packages/printer-core/src/resolution/planPages.ts
new file mode 100644
index 0000000..114656d
--- /dev/null
+++ b/packages/printer-core/src/resolution/planPages.ts
@@ -0,0 +1,86 @@
+import type { RepeatNode, TemplateNode } from '../template';
+import { isNodeVisible } from './evaluateCondition';
+import { entryFrame, readRepeatEntries, type RepeatEntry } from './readRepeatEntries';
+import { pushFrame, type PagePart, type ResolveContext } from './ResolveContext';
+import { ResolveError } from './ResolveError';
+
+/**
+ * Phần tem của từng trang theo thứ tự; số phần tử là số trang (tối thiểu 1), `undefined` là trang không tách tem.
+ * Số trang = max của các `repeat` ngoài cùng có `maxItemsPerPage`. Lỗi gặp khi lập kế hoạch không chặn ở đây —
+ * lỗi đó sẽ hiện ra đúng trang khi resolve.
+ */
+export function planPages(root: TemplateNode, context: ResolveContext): readonly (PagePart | undefined)[] {
+  const plans = collectPagedRepeats(root, context).map((node) => planRepeatPages(node, context));
+  const pageCount = Math.max(1, ...plans.map((plan) => plan.length));
+  const partPlan = plans.find((plan) => plan.some((part) => part !== undefined)) ?? [];
+  return Array.from({ length: pageCount }, (_, pageIndex) => partPlan[pageIndex]);
+}
+
+// Chỉ `repeat` ngoài cùng quyết định số trang, nên không đi sâu vào `template` của repeat.
+function collectPagedRepeats(node: TemplateNode, context: ResolveContext): readonly RepeatNode[] {
+  if (!isVisibleWhilePlanning(node, context)) return [];
+
+  if (node.type === 'container') return node.children.flatMap((child) => collectPagedRepeats(child, context));
+  if (node.type === 'repeat' && node.maxItemsPerPage !== undefined) return [node];
+  return [];
+}
+
+function planRepeatPages(node: RepeatNode, context: ResolveContext): readonly (PagePart | undefined)[] {
+  const entries = readEntriesWhilePlanning(node, context);
+  const partRepeats = findPartRepeats(node.template);
+  if (partRepeats.length === 0) {
+    return Array.from({ length: Math.ceil(entries.length / (node.maxItemsPerPage ?? 1)) }, () => undefined);
+  }
+
+  return entries.flatMap((entry, itemIndex) => {
+    const itemContext = pushFrame(context, entryFrame(node, entry, itemIndex, entries.length));
+    return itemParts(node.id, itemIndex, countItemParts(entry, partRepeats, itemContext));
+  });
+}
+
+// Repeat lồng sâu hơn 1 tầng không được tách tem, nên không đi sâu vào `template` của repeat lồng.
+function findPartRepeats(node: TemplateNode): readonly RepeatNode[] {
+  if (node.type === 'container') return node.children.flatMap(findPartRepeats);
+  if (node.type === 'repeat' && node.maxItemsPerPage !== undefined) return [node];
+  return [];
+}
+
+// Phần tử lỗi (VD expand sai) vẫn chiếm 1 trang để lỗi hiện ra đúng chỗ.
+function countItemParts(
+  entry: RepeatEntry,
+  partRepeats: readonly RepeatNode[],
+  itemContext: ResolveContext,
+): number {
+  if (entry.error !== undefined) return 1;
+
+  const partCounts = partRepeats.map((repeat) =>
+    Math.ceil(readEntriesWhilePlanning(repeat, itemContext).length / (repeat.maxItemsPerPage ?? 1)),
+  );
+  return Math.max(1, ...partCounts);
+}
+
+function itemParts(
+  repeatId: string,
+  itemIndex: number,
+  count: number,
+): readonly PagePart[] {
+  return Array.from({ length: count }, (_, partIndex) => ({ repeatId, itemIndex, number: partIndex + 1, count }));
+}
+
+function readEntriesWhilePlanning(node: RepeatNode, context: ResolveContext): readonly RepeatEntry[] {
+  try {
+    return readRepeatEntries(node, context);
+  } catch (error) {
+    if (error instanceof ResolveError) return [];
+    throw error;
+  }
+}
+
+function isVisibleWhilePlanning(node: TemplateNode, context: ResolveContext): boolean {
+  try {
+    return isNodeVisible(node, context);
+  } catch (error) {
+    if (error instanceof ResolveError) return true;
+    throw error;
+  }
+}
diff --git a/packages/printer-core/src/resolution/readRepeatEntries.ts b/packages/printer-core/src/resolution/readRepeatEntries.ts
index 80675b0..924b349 100644
--- a/packages/printer-core/src/resolution/readRepeatEntries.ts
+++ b/packages/printer-core/src/resolution/readRepeatEntries.ts
@@ -1,6 +1,6 @@
 import type { RepeatNode } from '../template';
 import { readFromCatalog } from './readVariable';
-import { findScopeFrame, type ResolveContext } from './ResolveContext';
+import { findScopeFrame, type ResolveContext, type ScopeFrame } from './ResolveContext';
 import { ResolveError } from './ResolveError';
 
 /** 1 phần tử của `repeat` sau khi expand. */
@@ -23,6 +23,24 @@ export function readRepeatEntries(node: RepeatNode, context: ResolveContext): re
   return readCollectionItems(node, context).flatMap((item) => expandItem(node, item, context));
 }
 
+/** Tầng scope của phần tử thứ `index` (từ 0) trong danh sách `total` phần tử sau expand. */
+export function entryFrame(
+  node: RepeatNode,
+  entry: RepeatEntry,
+  index: number,
+  total: number,
+): ScopeFrame {
+  return {
+    collection: node.collection,
+    item: entry.item,
+    position: index + 1,
+    total,
+    unit: entry.unit,
+    unitCount: entry.unitCount,
+    expanded: node.expand !== undefined,
+  };
+}
+
 /** Mảng phần tử raw của collection (chưa expand). */
 export function readCollectionItems(node: RepeatNode, context: ResolveContext): readonly unknown[] {
   const collection = context.index.collections.get(node.collection);
diff --git a/packages/printer-core/src/resolution/resolveNode.ts b/packages/printer-core/src/resolution/resolveNode.ts
index 47fb4f6..7891628 100644
--- a/packages/printer-core/src/resolution/resolveNode.ts
+++ b/packages/printer-core/src/resolution/resolveNode.ts
@@ -9,10 +9,10 @@ import type {
   TextNode,
 } from '../template';
 import { isNodeVisible } from './evaluateCondition';
-import { readRepeatEntries } from './readRepeatEntries';
+import { entryFrame, readRepeatEntries } from './readRepeatEntries';
 import { isOptionalVariable, readVariableValue } from './readVariable';
 import { resolveContent } from './resolveContent';
-import { pushFrame, type ResolveContext } from './ResolveContext';
+import { pushFrame, type PageInfo, type PagePart, type ResolveContext } from './ResolveContext';
 import type {
   ResolvedBarcode,
   ResolvedContainer,
@@ -131,30 +131,50 @@ function resolveRepeat(node: RepeatNode, context: ResolveContext): ResolvedConta
     const entry = entries[index];
     if (entry.error !== undefined) throw new ResolveError(node.id, entry.error);
 
-    const itemContext = pushFrame(context, {
-      collection: node.collection,
-      item: entry.item,
-      position: index + 1,
-      total: entries.length,
-      unit: entry.unit,
-      unitCount: entry.unitCount,
-      expanded: node.expand !== undefined,
-    });
+    const itemContext = pushFrame(context, entryFrame(node, entry, index, entries.length));
     const child = resolveNode(node.template, itemContext);
     if (child) children.push(child);
   }
   return { type: 'container', id: node.id, children };
 }
 
-// Chỉ `repeat` cấp ngoài cùng (không nằm trong repeat khác) mới phân trang, giống hành vi cũ.
+// `repeat` ngoài cùng chia theo trang; `repeat` lồng chỉ bị chia khi trang đang in 1 phần của phần tử.
 function entryRangeForPage(
   node: RepeatNode,
   context: ResolveContext,
   total: number,
 ): EntryRange {
   const perPage = node.maxItemsPerPage;
-  if (perPage === undefined || context.frames.length > 1) return { start: 0, end: total };
+  if (perPage === undefined) return { start: 0, end: total };
+  if (context.frames.length === 1) return pagedRepeatRange(node, context.page, total);
+  return partRange(context.page.part, perPage, total);
+}
+
+// Repeat mang `repeat` lồng bị tách tem in đúng 1 phần tử của kế hoạch trang thay vì chia đều theo trang.
+function pagedRepeatRange(
+  node: RepeatNode,
+  page: PageInfo,
+  total: number,
+): EntryRange {
+  if (page.part?.repeatId === node.id) return clampRange(page.part.itemIndex, 1, total);
+  const perPage = node.maxItemsPerPage ?? 1;
+  return clampRange((page.pageNumber - 1) * perPage, perPage, total);
+}
 
-  const start = (context.page.pageNumber - 1) * perPage;
-  return { start, end: Math.min(total, start + perPage) };
+// Không có phần tem (template chưa qua validate đặt `maxItemsPerPage` ở chỗ không tách tem) thì in cả danh sách.
+function partRange(
+  part: PagePart | undefined,
+  perPage: number,
+  total: number,
+): EntryRange {
+  if (!part) return { start: 0, end: total };
+  return clampRange((part.number - 1) * perPage, perPage, total);
+}
+
+function clampRange(
+  start: number,
+  size: number,
+  total: number,
+): EntryRange {
+  return { start: Math.min(start, total), end: Math.min(total, start + size) };
 }
~~~

- [ ] **Step 4: Chạy test của task, xác nhận PASS**

```bash
npx jest packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
```

Expected: PASS — `Tests: 50 passed, 50 total`.

- [ ] **Step 5: Verify toàn package**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
```

Expected: tsc không in gì; jest `Test Suites: 94 passed, 94 total Tests: 718 passed, 718 total`.

- [ ] **Step 6: Stage, eslint, line-length, commit**

```bash
git add \
  packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts \
  packages/printer-core/src/resolution/DocumentResolver.ts \
  packages/printer-core/src/resolution/planPages.ts \
  packages/printer-core/src/resolution/readRepeatEntries.ts \
  packages/printer-core/src/resolution/resolveNode.ts
git add -u packages/printer-core/src/resolution/countPages.ts
npx eslint $(git diff --cached --name-only --diff-filter=AM -- '*.ts')
git diff --cached -U0 -- '*.ts' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "feat: split nested repeat items across labels" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log -1 --format=%B
```

Expected: eslint và line-length không in gì; commit thành công, message đúng 2 dòng như lệnh.

---

### Task 3: Ràng buộc tách tem khi `parseTemplate`

**Files:**
- Create: `template/parse/validateRepeatPagination.ts`
- Modify: `template/parse/validateTemplateStructure.ts`
- Test: `template/parse/__tests__/parseTemplate.test.ts`

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: không có (chỉ đọc JSON template).
- Produces:
  - `template/parse/validateRepeatPagination.ts` — `validateRepeatPagination(root: JsonCursor): void`.
    Gọi từ `validateTemplateStructure` khi cấu trúc chưa có lỗi. Câu lỗi (nguyên văn):
    - `repeat lồng chỉ tách tem được khi repeat ngoài cùng có maxItemsPerPage` — tại `<repeat lồng>.maxItemsPerPage`
    - `repeat lồng chỉ tách tem được khi repeat ngoài cùng có maxItemsPerPage là 1` — tại `<repeat lồng>.maxItemsPerPage`
    - `chỉ tách tem được repeat lồng 1 tầng` — tại `<repeat tầng 2+>.maxItemsPerPage`
    - `chỉ 1 repeat ngoài cùng được chứa repeat lồng có maxItemsPerPage` — tại repeat ngoài cùng thứ 2 trở đi

- [ ] **Step 1: Áp patch test**

Thêm 5 test vào `template/parse/__tests__/parseTemplate.test.ts` (1 hợp lệ + 4 lỗi) và helper `issuesOf`, `toppingRepeatJson`, `toppingNameJson`, `itemRepeatJson`.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-26-nested-repeat-pagination.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t3-test | git apply --ignore-whitespace -
```

<!-- patch:t3-test -->
~~~diff
diff --git a/packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts b/packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts
index 4b4ce49..d645815 100644
--- a/packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts
+++ b/packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts
@@ -51,6 +51,39 @@ function issuePaths(json: unknown): readonly string[] {
   return result.ok ? [] : result.issues.map((issue) => issue.path);
 }
 
+function issuesOf(json: unknown): readonly { path: string; message: string }[] {
+  const result = parseTemplate(json);
+  return result.ok ? [] : result.issues.map((issue) => ({ path: issue.path, message: issue.message }));
+}
+
+function toppingRepeatJson(template: unknown = toppingNameJson(), maxItemsPerPage?: number): Record<string, unknown> {
+  return {
+    type: 'repeat',
+    id: 'toppings',
+    collection: 'toppings',
+    ...(maxItemsPerPage === undefined ? {} : { maxItemsPerPage }),
+    template,
+  };
+}
+
+function toppingNameJson(): Record<string, unknown> {
+  return { type: 'text', id: 'topping-name', content: [{ var: 'toppingName' }] };
+}
+
+function itemRepeatJson(
+  id: string,
+  template: unknown,
+  maxItemsPerPage?: number,
+): Record<string, unknown> {
+  return {
+    type: 'repeat',
+    id,
+    collection: 'items',
+    ...(maxItemsPerPage === undefined ? {} : { maxItemsPerPage }),
+    template,
+  };
+}
+
 describe('parseTemplate', () => {
   it('chấp nhận template hợp lệ và trả đúng object', () => {
     const json = validLabelJson();
@@ -161,4 +194,58 @@ describe('parseTemplate', () => {
 
     expect(issuePaths(json)).toEqual(['root.collection', 'root.maxItemsPerPage']);
   });
+
+  it('chấp nhận repeat lồng tách tem khi repeat ngoài cùng có maxItemsPerPage là 1', () => {
+    const json = withRoot(itemRepeatJson('items', toppingRepeatJson(toppingNameJson(), 4), 1));
+
+    expect(issuesOf(json)).toEqual([]);
+  });
+
+  it('báo lỗi repeat lồng tách tem khi repeat ngoài cùng có maxItemsPerPage khác 1', () => {
+    const json = withRoot(itemRepeatJson('items', toppingRepeatJson(toppingNameJson(), 4), 2));
+
+    expect(issuesOf(json)).toEqual([
+      {
+        path: 'root.template.maxItemsPerPage',
+        message: 'repeat lồng chỉ tách tem được khi repeat ngoài cùng có maxItemsPerPage là 1',
+      },
+    ]);
+  });
+
+  it('báo lỗi repeat lồng tách tem khi repeat ngoài cùng không phân trang', () => {
+    const json = withRoot(itemRepeatJson('items', toppingRepeatJson(toppingNameJson(), 4)));
+
+    expect(issuesOf(json)).toEqual([
+      {
+        path: 'root.template.maxItemsPerPage',
+        message: 'repeat lồng chỉ tách tem được khi repeat ngoài cùng có maxItemsPerPage',
+      },
+    ]);
+  });
+
+  it('báo lỗi maxItemsPerPage ở repeat lồng từ tầng 2 trở xuống', () => {
+    const deeper = { ...toppingRepeatJson(toppingNameJson(), 2), id: 'deeper' };
+    const json = withRoot(itemRepeatJson('items', toppingRepeatJson(deeper), 1));
+
+    expect(issuesOf(json)).toEqual([
+      { path: 'root.template.template.maxItemsPerPage', message: 'chỉ tách tem được repeat lồng 1 tầng' },
+    ]);
+  });
+
+  it('báo lỗi khi hơn 1 repeat ngoài cùng chứa repeat lồng tách tem', () => {
+    const secondName = { ...toppingNameJson(), id: 'second-topping-name' };
+    const secondToppings = { ...toppingRepeatJson(secondName, 4), id: 'second-toppings' };
+    const json = withRoot({
+      type: 'container',
+      id: 'root',
+      children: [
+        itemRepeatJson('first', toppingRepeatJson(toppingNameJson(), 4), 1),
+        itemRepeatJson('second', secondToppings, 1),
+      ],
+    });
+
+    expect(issuesOf(json)).toEqual([
+      { path: 'root.children[1]', message: 'chỉ 1 repeat ngoài cùng được chứa repeat lồng có maxItemsPerPage' },
+    ]);
+  });
 });
~~~

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
npx jest packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts
```

Expected: FAIL — chưa có ràng buộc nên 4 template sai vẫn qua được `parseTemplate`. Lúc lập plan: `Tests: 4 failed, 14 passed, 18 total`.

- [ ] **Step 3: Áp patch implementation**

Thêm `validateRepeatPagination.ts` và 1 dòng gọi trong `validateTemplateStructure.ts`.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-26-nested-repeat-pagination.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t3-impl | git apply --ignore-whitespace -
```

<!-- patch:t3-impl -->
~~~diff
diff --git a/packages/printer-core/src/template/parse/validateRepeatPagination.ts b/packages/printer-core/src/template/parse/validateRepeatPagination.ts
new file mode 100644
index 0000000..2dd5725
--- /dev/null
+++ b/packages/printer-core/src/template/parse/validateRepeatPagination.ts
@@ -0,0 +1,59 @@
+import type { JsonCursor } from './JsonCursor';
+
+/** `maxItemsPerPage` của repeat ngoài cùng bắt buộc khi có repeat lồng được tách tem: mỗi tem đúng 1 phần tử. */
+const PART_CARRIER_ITEMS_PER_PAGE = 1;
+
+const OUTER_NOT_PAGED_MESSAGE = 'repeat lồng chỉ tách tem được khi repeat ngoài cùng có maxItemsPerPage';
+
+const OUTER_NOT_SINGLE_ITEM_MESSAGE = 'repeat lồng chỉ tách tem được khi repeat ngoài cùng có maxItemsPerPage là 1';
+
+const DEEPER_PAGINATION_MESSAGE = 'chỉ tách tem được repeat lồng 1 tầng';
+
+const MULTIPLE_CARRIERS_MESSAGE = 'chỉ 1 repeat ngoài cùng được chứa repeat lồng có maxItemsPerPage';
+
+/**
+ * Kiểm tra ràng buộc tách `repeat` lồng sang nhiều tem. Chỉ gọi khi cấu trúc đã hợp lệ, vì dựa vào việc mọi
+ * `children` là mảng và mọi repeat có `template`.
+ */
+export function validateRepeatPagination(root: JsonCursor): void {
+  const partCarriers = findRepeats(root, false).filter(validateNestedRepeats);
+  for (const carrier of partCarriers.slice(1)) {
+    carrier.report(MULTIPLE_CARRIERS_MESSAGE);
+  }
+}
+
+/** Các repeat gần nhất bên dưới `node`; `deep` thì lấy cả repeat nằm trong `template` của repeat khác. */
+function findRepeats(node: JsonCursor, deep: boolean): readonly JsonCursor[] {
+  const type = node.field('type').value;
+  if (type === 'container') return node.field('children').expectItems().flatMap((child) => findRepeats(child, deep));
+  if (type !== 'repeat') return [];
+  return deep ? [node, ...findRepeats(node.field('template'), true)] : [node];
+}
+
+// Trả `true` nếu repeat ngoài cùng có repeat lồng khai báo `maxItemsPerPage`.
+function validateNestedRepeats(outer: JsonCursor): boolean {
+  const nestedRepeats = findRepeats(outer.field('template'), false);
+  for (const nested of nestedRepeats) rejectDeeperPagination(nested);
+
+  const partRepeats = nestedRepeats.filter((nested) => nested.has('maxItemsPerPage'));
+  for (const partRepeat of partRepeats) checkOuterPagination(outer, partRepeat);
+  return partRepeats.length > 0;
+}
+
+function checkOuterPagination(outer: JsonCursor, partRepeat: JsonCursor): void {
+  const outerItemsPerPage = outer.field('maxItemsPerPage').value;
+  if (outerItemsPerPage === undefined) {
+    partRepeat.field('maxItemsPerPage').report(OUTER_NOT_PAGED_MESSAGE);
+    return;
+  }
+  if (outerItemsPerPage !== PART_CARRIER_ITEMS_PER_PAGE) {
+    partRepeat.field('maxItemsPerPage').report(OUTER_NOT_SINGLE_ITEM_MESSAGE);
+  }
+}
+
+function rejectDeeperPagination(nested: JsonCursor): void {
+  const deeperRepeats = findRepeats(nested.field('template'), true);
+  for (const deeper of deeperRepeats.filter((repeat) => repeat.has('maxItemsPerPage'))) {
+    deeper.field('maxItemsPerPage').report(DEEPER_PAGINATION_MESSAGE);
+  }
+}
diff --git a/packages/printer-core/src/template/parse/validateTemplateStructure.ts b/packages/printer-core/src/template/parse/validateTemplateStructure.ts
index 650e198..d615ce3 100644
--- a/packages/printer-core/src/template/parse/validateTemplateStructure.ts
+++ b/packages/printer-core/src/template/parse/validateTemplateStructure.ts
@@ -2,6 +2,7 @@ import { TEMPLATE_SCHEMA_VERSION } from '../TemplateDocument';
 import { JsonCursor } from './JsonCursor';
 import type { TemplateIssue } from './TemplateIssue';
 import { validateNode } from './validateNode';
+import { validateRepeatPagination } from './validateRepeatPagination';
 
 const MEDIA_TYPES: readonly string[] = ['label', 'receipt'];
 const LOCALES: readonly string[] = ['vi-VN'];
@@ -21,6 +22,8 @@ export function validateTemplateStructure(document: unknown): readonly TemplateI
   cursor.field('locale').expectOneOf(LOCALES);
   validatePaper(cursor);
   validateNode(cursor.field('root'), new Set());
+  // Ràng buộc tách tem dựa trên cấu trúc hợp lệ; chạy trên cấu trúc lỗi sẽ báo trùng lỗi kiểu.
+  if (issues.length === 0) validateRepeatPagination(cursor.field('root'));
 
   return issues;
 }
~~~

- [ ] **Step 4: Chạy test của task, xác nhận PASS**

```bash
npx jest packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts
```

Expected: PASS — `Tests: 18 passed, 18 total`.

- [ ] **Step 5: Verify toàn package**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
```

Expected: tsc không in gì; jest `Test Suites: 94 passed, 94 total Tests: 723 passed, 723 total`.

- [ ] **Step 6: Stage, eslint, line-length, commit**

```bash
git add \
  packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts \
  packages/printer-core/src/template/parse/validateRepeatPagination.ts \
  packages/printer-core/src/template/parse/validateTemplateStructure.ts
npx eslint $(git diff --cached --name-only --diff-filter=AM -- '*.ts')
git diff --cached -U0 -- '*.ts' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "feat: validate nested repeat pagination constraints" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log -1 --format=%B
```

Expected: eslint và line-length không in gì; commit thành công, message đúng 2 dòng như lệnh.

---

### Task 4: DSL, tích hợp, mẫu tem món và tài liệu

**Files:**
- Modify: `packages/printer-core/README.md`, `template/nodes/RepeatNode.ts`, `packages/printer-preview/src/defaultSample.ts`
- Test: `__tests__/template-pipeline-integration.test.ts`, `template/builder/__tests__/TemplateDocumentBuilder.test.ts`, `packages/printer-preview/src/__tests__/defaultSample.test.ts`

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: Task 1-3.
- Produces:
  - Mẫu tem món `printer-preview/src/defaultSample.ts`:
    - Topping `.maxItemsPerPage(4)`.
    - Giá chỉ ở tem đầu (`eq('$part', 1)`).
    - Dòng `(tiếp x/y)` khi `gt('$partCount', 1)`.
  - JSDoc `RepeatNode.maxItemsPerPage` nêu nghĩa ở repeat lồng.
  - README mục "Phân trang tem"; cây thư mục đổi `countPages.ts` → `planPages.ts`.

- [ ] **Step 1: Áp patch test**

Patch test làm các việc sau:
- Thêm test DSL (`TemplateDocumentBuilder.test.ts`).
- Thêm test tích hợp resolve + layout từng tem (`template-pipeline-integration.test.ts`).
- Thêm test mẫu tem 9 topping ra 6 tem (`printer-preview/src/__tests__/defaultSample.test.ts`, Vitest).

2 test `printer-core` chốt hành vi đã có từ Task 1-3 nên pass ngay. Test làm RED là test mẫu tem.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-26-nested-repeat-pagination.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t4-test | git apply --ignore-whitespace -
```

<!-- patch:t4-test -->
~~~diff
diff --git a/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts b/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts
index c8c20e5..bc065c8 100644
--- a/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts
+++ b/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts
@@ -1,8 +1,22 @@
 import { EscPosCompiler } from '../language';
 import { ApproximateFontMetrics, createLayoutEngine, paperSizeToDots, type TypographyProfile } from '../layout';
 import { collectAssetIds, createDocumentResolver, type AssetProvider } from '../resolution';
-import { barcode, column, gt, image, line, mm, parseTemplate, px, receiptTemplate, row, text } from '../template';
-import { TEST_ORDER_CATALOG, TEST_ORDER_SAMPLE } from '../testing';
+import {
+  barcode,
+  column,
+  eq,
+  gt,
+  image,
+  labelTemplate,
+  line,
+  mm,
+  parseTemplate,
+  px,
+  receiptTemplate,
+  row,
+  text,
+} from '../template';
+import { TEST_ORDER_CATALOG, TEST_ORDER_SAMPLE, type TestOrder } from '../testing';
 import type { Bitmap } from '../types';
 
 // Không có @types/node trong package RN; require() chỉ dùng để khẳng định module cũ đã bị xoá.
@@ -81,4 +95,55 @@ describe('pipeline template → resolve → layout → compile', () => {
     expect(() => require('../templates')).toThrow();
     expect(() => require('../binding')).toThrow();
   });
+
+  it('tem món nhiều topping tách sang tem tiếp: JSON round-trip → resolve → layout từng tem', () => {
+    const built = labelTemplate(TEST_ORDER_CATALOG)
+      .id('split-label')
+      .name('Tem tách topping')
+      .paper({ widthMm: 50, heightMm: 30 })
+      .root((scope) =>
+        scope
+          .repeat({ collection: 'items', expand: 'quantity' }, (item) =>
+            column().children(
+              text([item.var('itemName')]).bold(),
+              text([item.var('itemTotal')]).visibleWhen(eq('$part', 1)),
+              item
+                .repeat({ collection: 'toppings' }, (topping) => text([topping.var('toppingName')]))
+                .maxItemsPerPage(2),
+              text([{ text: '(tiếp ' }, item.var('$part'), { text: '/' }, item.var('$partCount'), { text: ')' }])
+                .visibleWhen(gt('$partCount', 1)),
+            ),
+          )
+          .maxItemsPerPage(1),
+      )
+      .build();
+    const parsed = parseTemplate(JSON.parse(JSON.stringify(built)));
+    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
+    const template = parsed.template;
+
+    const toppings = ['Trân châu', 'Thạch dừa', 'Pudding', 'Kem cheese', 'Nha đam'].map(name => ({
+      name,
+      price: 5000,
+    }));
+    const order: TestOrder = {
+      ...TEST_ORDER_SAMPLE,
+      items: [{ name: 'Trà sữa', quantity: 1, price: 45000, toppings }],
+    };
+    const pages = createDocumentResolver().resolve(template, order, {
+      catalog: TEST_ORDER_CATALOG,
+      assets: { get: () => undefined },
+    });
+
+    const config = { paper: template.paper, media: template.media, dpi: PRINTER_DPI };
+    const texts = pages.map((page) => {
+      if (page.status !== 'ok') throw new Error(page.message);
+      const elements = createLayoutEngine().resolve(page.node, config, TYPOGRAPHY, new ApproximateFontMetrics());
+      return elements.flatMap((element) => (element.type === 'text' ? [element.content] : []));
+    });
+    expect(texts).toEqual([
+      ['Trà sữa', '45.000đ', 'Trân châu', 'Thạch dừa', '(tiếp 1/3)'],
+      ['Trà sữa', 'Pudding', 'Kem cheese', '(tiếp 2/3)'],
+      ['Trà sữa', 'Nha đam', '(tiếp 3/3)'],
+    ]);
+  });
 });
diff --git a/packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts b/packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts
index 3f8c3ff..7da434e 100644
--- a/packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts
+++ b/packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts
@@ -1,5 +1,7 @@
 import {
   column,
+  eq,
+  gt,
   insets,
   labelTemplate,
   mm,
@@ -155,4 +157,32 @@ describe('labelTemplate / receiptTemplate', () => {
 
     expect(checkTypesOnly).toBeInstanceOf(Function);
   });
+
+  it('maxItemsPerPage trên repeat lồng và biến $part/$partCount ra đúng JSON, qua được parseTemplate', () => {
+    const template = labelTemplate(TEST_ORDER_CATALOG)
+      .id('split-label')
+      .name('Tem tách topping')
+      .paper({ widthMm: 50, heightMm: 30 })
+      .root((scope) =>
+        scope
+          .repeat({ collection: 'items', expand: 'quantity' }, (item) =>
+            column().children(
+              text([item.var('itemName')]).visibleWhen(eq('$part', 1)),
+              item
+                .repeat({ collection: 'toppings' }, (topping) => text([topping.var('toppingName')]))
+                .maxItemsPerPage(4),
+              text([{ text: '(tiếp ' }, item.var('$part'), { text: '/' }, item.var('$partCount'), { text: ')' }])
+                .visibleWhen(gt('$partCount', 1)),
+            ),
+          )
+          .maxItemsPerPage(1),
+      )
+      .build();
+
+    const outer = template.root;
+    if (outer.type !== 'repeat' || outer.template.type !== 'container') throw new Error('cấu trúc sai');
+    expect(outer.template.children[1]).toMatchObject({ type: 'repeat', collection: 'toppings', maxItemsPerPage: 4 });
+    expect(outer.template.children[2]).toMatchObject({ visibleWhen: { op: 'gt', var: '$partCount', value: 1 } });
+    expect(parseTemplate(JSON.parse(JSON.stringify(template)))).toEqual({ ok: true, template });
+  });
 });
diff --git a/packages/printer-preview/src/__tests__/defaultSample.test.ts b/packages/printer-preview/src/__tests__/defaultSample.test.ts
index 9cd40b2..b64d339 100644
--- a/packages/printer-preview/src/__tests__/defaultSample.test.ts
+++ b/packages/printer-preview/src/__tests__/defaultSample.test.ts
@@ -13,4 +13,15 @@ describe('defaultSample', () => {
     const previews = renderPreviews(evaluated.template, evaluated.catalog, JSON.parse(defaultData), 'tspl');
     expect(previews.map((preview) => preview.status)).toEqual(['ok', 'ok']);
   });
+
+  it('món 9 topping tách thành 3 tem mỗi ly (4 + 4 + 1)', () => {
+    const evaluated = evaluateTemplate(defaultCode);
+    if (evaluated.status !== 'ok') throw new Error(evaluated.message);
+
+    const data = JSON.parse(defaultData);
+    data.products[0].toppings = Array.from({ length: 9 }, (_, index) => ({ name: `Topping ${index + 1}` }));
+
+    const previews = renderPreviews(evaluated.template, evaluated.catalog, data, 'tspl');
+    expect(previews.map((preview) => preview.status)).toEqual(Array.from({ length: 6 }, () => 'ok'));
+  });
 });
~~~

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
(cd packages/printer-preview && npx vitest run src/__tests__/defaultSample.test.ts)
```

Expected: FAIL — test `món 9 topping tách thành 3 tem mỗi ly (4 + 4 + 1)` fail vì mẫu tem chưa tách topping (ra 2 tem, không phải 6). Test còn lại của file vẫn pass.

- [ ] **Step 3: Áp patch implementation**

Sửa mẫu tem món, JSDoc `RepeatNode`, README.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-26-nested-repeat-pagination.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t4-impl | git apply --ignore-whitespace -
```

<!-- patch:t4-impl -->
~~~diff
diff --git a/packages/printer-core/README.md b/packages/printer-core/README.md
index f176f62..f4c7503 100644
--- a/packages/printer-core/README.md
+++ b/packages/printer-core/README.md
@@ -94,7 +94,7 @@ src/
 │
 ├── resolution/                 # Ghép template + data qua catalog, stack scope tường minh
 │   ├── DocumentResolver.ts, ResolveContext.ts, readVariable.ts, resolveContent.ts,
-│   │   evaluateCondition.ts, readRepeatEntries.ts, resolveNode.ts, countPages.ts,
+│   │   evaluateCondition.ts, readRepeatEntries.ts, resolveNode.ts, planPages.ts,
 │   │   collectAssetIds.ts, AssetProvider.ts, ResolvedNode.ts, ResolvedPage.ts,
 │   │   ResolveError.ts, index.ts
 │
@@ -244,6 +244,16 @@ src/
     ├── template-pipeline-integration.test.ts, phase2-integration.test.ts
 ```
 
+## Phân trang tem
+
+- `repeat` ngoài cùng có `maxItemsPerPage` chia phần tử (sau `expand`) thành từng trang/tem.
+- `repeat` lồng ngay bên trong nó cũng có thể khai báo `maxItemsPerPage` (VD topping mỗi tem tối đa 4); phần dư in
+  sang tem tiếp theo, tem tiếp in lại toàn bộ nội dung của phần tử. Điều kiện: repeat ngoài cùng có
+  `maxItemsPerPage` là 1, chỉ lồng 1 tầng, và chỉ 1 repeat ngoài cùng được chứa repeat lồng tách tem —
+  `parseTemplate` báo lỗi nếu vi phạm.
+- Biến có sẵn `$part`/`$partCount` (dùng ở mọi chỗ) cho biết tem thứ mấy trong phần tử; là 1/1 khi không tách tem.
+  VD chỉ in giá ở tem đầu: `visibleWhen(eq('$part', 1))`.
+
 ## Cỡ chữ và cảnh báo compile
 
 - `TextOptions.fontSize` (dots) là field cỡ chữ duy nhất của `PrintElement` text. Mỗi ngôn ngữ tự quy đổi
diff --git a/packages/printer-core/src/template/nodes/RepeatNode.ts b/packages/printer-core/src/template/nodes/RepeatNode.ts
index 61c2755..8c14f4b 100644
--- a/packages/printer-core/src/template/nodes/RepeatNode.ts
+++ b/packages/printer-core/src/template/nodes/RepeatNode.ts
@@ -11,7 +11,10 @@ export interface RepeatNode extends TemplateNodeBase {
   /** Tên biến kiểu `number` của collection: nhân mỗi phần tử thành đúng số bản sao đó (VD mỗi ly 1 tem). */
   readonly expand?: string;
 
-  /** Số phần tử tối đa mỗi trang (tính sau khi expand); bỏ trống là không phân trang. */
+  /**
+   * Số phần tử tối đa mỗi trang (tính sau khi expand); bỏ trống là không phân trang. Ở `repeat` lồng ngay trong
+   * repeat ngoài cùng có `maxItemsPerPage` là 1: số phần tử tối đa mỗi tem, phần dư in sang tem tiếp theo.
+   */
   readonly maxItemsPerPage?: number;
 
   /** Node được lặp cho từng phần tử. */
diff --git a/packages/printer-preview/src/defaultSample.ts b/packages/printer-preview/src/defaultSample.ts
index 594b703..565dad9 100644
--- a/packages/printer-preview/src/defaultSample.ts
+++ b/packages/printer-preview/src/defaultSample.ts
@@ -2,6 +2,8 @@ export const defaultCode = `import {
   column,
   defineCatalog,
   defineCollection,
+  eq,
+  gt,
   insets,
   labelTemplate,
   mm,
@@ -73,8 +75,10 @@ export default labelTemplate(catalog)
           .gap(mm(1))
           .children(
             text([product.var('productName')]).fontSize(px(16)).bold(),
-            text([product.var('productPrice')]),
-            product.repeat({ collection: 'toppings' }, (topping) => text([{ text: '+ ' }, topping.var('toppingName')])),
+            text([product.var('productPrice')]).visibleWhen(eq('$part', 1)),
+            product
+              .repeat({ collection: 'toppings' }, (topping) => text([{ text: '+ ' }, topping.var('toppingName')]))
+              .maxItemsPerPage(4),
             text([
               product.var('orderCode'),
               { text: ' · ' },
@@ -82,6 +86,8 @@ export default labelTemplate(catalog)
               { text: '/' },
               product.var('$unitCount'),
             ]),
+            text([{ text: '(tiếp ' }, product.var('$part'), { text: '/' }, product.var('$partCount'), { text: ')' }])
+              .visibleWhen(gt('$partCount', 1)),
           ),
       )
       .maxItemsPerPage(1),
~~~

- [ ] **Step 4: Chạy test của task, xác nhận PASS**

```bash
npx jest packages/printer-core/src/__tests__/template-pipeline-integration.test.ts packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts
(cd packages/printer-preview && npx tsc --noEmit && npx vitest run)
```

Expected: PASS — `Tests: 11 passed, 11 total`. `printer-preview`: tsc không in gì; Vitest `3 passed` file, `12 passed` test.

- [ ] **Step 5: Verify toàn package**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
```

Expected: tsc không in gì; jest `Test Suites: 94 passed, 94 total Tests: 725 passed, 725 total`.

- [ ] **Step 6: Stage, eslint, line-length, commit**

```bash
git add \
  packages/printer-core/src/__tests__/template-pipeline-integration.test.ts \
  packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts \
  packages/printer-preview/src/__tests__/defaultSample.test.ts \
  packages/printer-core/README.md \
  packages/printer-core/src/template/nodes/RepeatNode.ts \
  packages/printer-preview/src/defaultSample.ts
npx eslint $(git diff --cached --name-only --diff-filter=AM -- '*.ts')
git diff --cached -U0 -- '*.ts' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "feat: apply nested repeat pagination to the label sample and docs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log -1 --format=%B
```

Expected: eslint và line-length không in gì; commit thành công, message đúng 2 dòng như lệnh.

