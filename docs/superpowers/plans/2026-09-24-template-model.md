# Template Model (Sub-spec A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay model template hiện tại của `printer-core` bằng `TemplateDocument` JSON thuần, độc lập DPI, binding qua catalog biến có tên, kèm format/điều kiện/expand/asset/validate/migrate; cập nhật `printer-preview` theo model mới.

**Architecture:** Module mới `catalog/` là cầu nối duy nhất giữa template và data. `template/` chỉ còn type JSON thuần + formatter + `parseTemplate`/validate + DSL có kiểm tra kiểu theo catalog. `resolution/` resolve bằng stack scope tường minh (không dò ngược scope), sinh `ResolvedNode` vẫn mang `Length`. `layout/` đổi `Length → dots` đúng 1 chỗ (`toLayoutNode`) rồi chạy thuật toán layout cũ trên `LayoutNode` (dots), tách nét đứt thành nhiều `LineElement`.

**Tech Stack:** TypeScript 5.9 strict (`NoInfer` cần TS ≥ 5.4), Jest (preset react-native) cho `printer-core`, Vitest cho `printer-preview`. `printer-core` không có dependency.

**Spec:** `docs/superpowers/specs/2026-09-24-template-model-design.md` (thuộc kiến trúc tổng `docs/superpowers/specs/2026-09-24-print-template-pipeline-overview.md`).

## Global Constraints

**Quy ước code (bắt buộc cho mọi sub-spec)** — chép nguyên văn từ overview:

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

- Làm trên branch `refactor/template-model` tạo từ `main`, checkout thẳng trong working directory chính — **không dùng git worktree**, không commit thẳng `main`.
- `printer-core` giữ zero-dependency: không thêm package (không zod, không `Intl` trong formatter).
- Test đặt trong `__tests__/` cạnh file nguồn, tên `<file gốc>.test.ts`.
- Stage đúng file của task (`git add <path>` / `git rm <path>`), **không bao giờ** `git add -A` hay `git add .`.
- Commit message: `<type>: <mô tả ngắn>` (type: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`), kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Mọi lệnh chạy từ thư mục `C:\NDTCORE\NDTCore\NDTCore.App` bằng Git Bash.

**Lệnh line-length** (dùng ở bước verify mọi task, thay `<paths>` bằng thư mục/file của task):

```bash
node -e "const fs=require('fs'),p=require('path');const walk=d=>fs.statSync(d).isDirectory()?fs.readdirSync(d).flatMap(n=>walk(p.join(d,n))):/\.tsx?$/.test(d)?[d]:[];let bad=0;for(const r of process.argv.slice(1))for(const f of walk(r))fs.readFileSync(f,'utf8').split(/\r?\n/).forEach((l,i)=>{if(l.length>120){bad++;console.log(f+':'+(i+1)+' '+l.length)}});process.exit(bad?1:0)" <paths>
```

Expected: không in gì, exit 0.

**Cửa sổ type-check đỏ (Task 3 → Task 8):** Task 3 đổi type của `template/`, nên `resolution/`, `layout/`, integration test cũ sẽ lỗi type/test cho tới khi được viết lại ở Task 6, 7, 8. Trong cửa sổ này, bước verify của mỗi task chỉ yêu cầu **không có lỗi tsc trong đúng các thư mục đã migrate** (lệnh lọc cho sẵn trong từng task) và test của các thư mục đó pass. Từ Task 8 trở đi, type-check toàn package phải sạch.

## Các quyết định lệch khỏi spec (đã chốt khi lập plan)

| # | Spec | Plan | Lý do |
|---|---|---|---|
| 1 | `BarcodeNode.height: Length` | `BarcodeNode.barHeight?: Length`, builder `.barHeight()` | Tránh trùng nghĩa với `style.height` (Dimension) của cùng node |
| 2 | `repeat(...)` là hàm tự do | Chỉ có `scope.repeat(...)`; `.root()` nhận builder hoặc callback `(scope) => builder` | Hàm tự do không biết đang ở scope nào nên không kiểm tra kiểu được tên biến |
| 3 | `CollectionSpec` khai báo inline | Thêm helper `defineCollection` (dùng `NoInfer`) | TypeScript chỉ suy được kiểu phần tử khi collection được khai báo qua hàm riêng; khai báo inline làm tham số `get` thành `unknown` |
| 4 | `template/asset/` | `AssetProvider`, `collectAssetIds` nằm ở `resolution/` | `collectAssetIds` dùng lại logic đọc scope/collection của resolver |
| 5 | Tham số thứ 3 của `resolve` tên `context` | Tên `options: ResolveOptions<TData>` (cùng shape `{ catalog, assets }`) | `ResolveContext` là tên trạng thái nội bộ của resolver |
| 6 | `barcode(...)` chưa nói symbology | `barcode(content, symbology)` — symbology là tham số bắt buộc | Bỏ lỗi runtime "thiếu .symbology()" |
| 7 | Chưa nói cỡ chữ mặc định | `DEFAULT_FONT_SIZE = 12px` khi `fontSize` bỏ trống | Mặc định cũ là 10 dots, phụ thuộc DPI |
| 8 | Chưa nói kích thước nét đứt | Đoạn 1mm, khoảng trống 1mm | Đủ rõ ở 203/300 dpi |
| 9 | Chưa nói catalog test | `TEST_ORDER_CATALOG` export từ `testing/` | Dùng chung cho test catalog/template/resolution/layout |
| 10 | printer-preview nhận `TemplateDocument` | Code mẫu phải `export const catalog` + `export default` template; preview chưa có ảnh (`NO_ASSETS`) | Preview cần catalog để resolve; tải asset là việc của sub-spec D |

## Cấu trúc file sau khi xong

```text
packages/printer-core/src/
├── catalog/                     # MỚI — cầu nối template ↔ data
│   ├── VariableType.ts, VariableSpec.ts, CatalogCollection.ts (+ defineCollection),
│   ├── CatalogDescription.ts, Catalog.ts, BuiltInVariable.ts, CatalogRegistry.ts,
│   ├── describeCatalog.ts, defineCatalog.ts, CatalogIndex.ts, index.ts
│   └── __tests__/defineCatalog.test.ts, CatalogIndex.test.ts
├── template/
│   ├── TemplateDocument.ts      # thay PrintTemplate.ts + PrintTemplateType.ts
│   ├── style/                   # Length.ts mới; Dimension/Insets/BoxStyle/LayoutStyle/TextStyle dùng Length
│   ├── content/                 # MỚI — Segment.ts, ValueFormat.ts, Condition.ts (thay VisibilityCondition)
│   ├── nodes/                   # viết lại theo Segment/Length/Condition
│   ├── format/                  # MỚI — formatNumber/Currency/DateTime/Text/Value (không Intl)
│   ├── parse/                   # MỚI — parseTemplate, migrateTemplate, validate cấu trúc, validate theo catalog
│   ├── builder/                 # viết lại — DSL kiểm tra kiểu theo catalog
│   └── index.ts
├── resolution/                  # viết lại — scope stack, segment, điều kiện, expand, phân trang, asset
├── layout/                      # LayoutConfig mới, lengthToDots, LayoutNode, toLayoutNode, LayoutEngine viết lại
├── testing/OrderTestCatalog.ts  # MỚI — catalog + data test dùng chung
└── __tests__/template-pipeline-integration.test.ts   # thay layout-engine-integration.test.ts
packages/printer-preview/src/
├── defaultSample.ts, evaluateTemplate.ts, pipeline.ts, App.tsx   # theo model mới
└── __tests__/evaluateTemplate.test.ts, pipeline.test.ts, defaultSample.test.ts
```

---

### Task 1: Module `catalog/` + catalog test dùng chung

**Files:**
- Create: `packages/printer-core/src/catalog/VariableType.ts`, `VariableSpec.ts`, `CatalogCollection.ts`, `CatalogDescription.ts`, `Catalog.ts`, `BuiltInVariable.ts`, `CatalogRegistry.ts`, `describeCatalog.ts`, `defineCatalog.ts`, `CatalogIndex.ts`, `index.ts`
- Create: `packages/printer-core/src/testing/OrderTestCatalog.ts`
- Test: `packages/printer-core/src/catalog/__tests__/defineCatalog.test.ts`, `packages/printer-core/src/catalog/__tests__/CatalogIndex.test.ts`
- Modify: `packages/printer-core/src/testing/index.ts`, `packages/printer-core/src/index.ts`

**Interfaces:**
- Consumes: không có.
- Produces:
  - `VariableType = 'string' | 'number' | 'money' | 'datetime' | 'boolean' | 'asset'`
  - `VariableSpec<TSource> { label; type; optional?; deprecated?; get(source): unknown }`, `VariableSpecMap<TSource>`
  - `CatalogCollection<TSource, TItem, TVariables, TCollections> { label; variables; collections; get(source): readonly TItem[] }`, `CatalogCollectionMap<TSource>`, `EmptyCollectionMap`, `defineCollection(definition)`
  - `Catalog<TData, TVariables, TCollections> { id; version; sample; variables; collections; describe(); readVariable(name, source): unknown; readCollection(name, source): unknown }`, `defineCatalog(definition)`
  - `CatalogDescription { id; version; variables: VariableDescription[]; collections: CollectionDescription[] }`
  - `CatalogIndex { variables: Map<name, { description; collection: string | null }>; collections: Map<name, { description; parent: string | null }> }`, `createCatalogIndex(description)`
  - `BuiltInVariableName`, `BUILT_IN_VARIABLE_SCOPES` (`'document' | 'repeat' | 'expand'`), `isBuiltInVariableName(name)`, `RESERVED_NAME_PREFIX = '$'`
  - `TEST_ORDER_CATALOG`, `TEST_ORDER_SAMPLE`, `TestOrder`, `TestOrderItem`, `TestTopping` (export từ `testing/`)

- [ ] **Step 1: Kiểm tra working tree và tạo branch**

```bash
git status --short
```

Expected: chỉ có file untracked (`??`). Nếu có thay đổi chưa commit ở file đã track (VD `D packages/printer-core/src/document/builder/...`) — đó là việc dở của user: **dừng lại, hỏi user** xử lý (commit riêng / stash) trước khi đi tiếp; không tự stash hay revert.

```bash
git checkout main
git checkout -b refactor/template-model
```

- [ ] **Step 2: Viết catalog test dùng chung + test (chưa có implementation)**

`packages/printer-core/src/testing/OrderTestCatalog.ts`:

```ts
import { defineCatalog, defineCollection } from '../catalog';

/** Topping của 1 món trong data test. */
export interface TestTopping {
  readonly name: string;

  /** Giá topping, đơn vị đồng. */
  readonly price: number;
}

/** 1 món trong data test. */
export interface TestOrderItem {
  readonly name: string;

  /** Số lượng, dùng cho `expand`. */
  readonly quantity: number;

  /** Đơn giá, đơn vị đồng. */
  readonly price: number;

  /** Ghi chú món; có thể không có. */
  readonly note?: string;

  readonly toppings: readonly TestTopping[];
}

/** Đơn hàng dùng làm data test cho catalog/resolver/validate. */
export interface TestOrder {
  /** Mã đơn, VD 'HD001'. */
  readonly code: string;

  /** Tên bàn; đơn mang về thì không có. */
  readonly tableName?: string;

  /** Thời điểm tạo đơn, chuỗi ISO 8601. */
  readonly createdAt: string;

  /** Tiền giảm giá, đơn vị đồng. */
  readonly discount: number;

  /** Mã asset logo cửa hàng; có thể không có. */
  readonly storeLogo?: string;

  readonly items: readonly TestOrderItem[];
}

const TOPPINGS = defineCollection({
  label: 'Topping',
  get: (item: TestOrderItem) => item.toppings,
  variables: {
    toppingName: { label: 'Tên topping', type: 'string', get: (topping) => topping.name },
    toppingPrice: { label: 'Giá topping', type: 'money', get: (topping) => topping.price },
  },
});

const ITEMS = defineCollection({
  label: 'Danh sách món',
  get: (order: TestOrder) => order.items,
  variables: {
    itemName: { label: 'Tên món', type: 'string', get: (item) => item.name },
    quantity: { label: 'Số lượng', type: 'number', get: (item) => item.quantity },
    itemTotal: { label: 'Thành tiền', type: 'money', get: (item) => item.price * item.quantity },
    itemNote: { label: 'Ghi chú món', type: 'string', optional: true, get: (item) => item.note },
    legacyItemName: { label: 'Tên món (cũ)', type: 'string', deprecated: 'Dùng itemName', get: (item) => item.name },
  },
  collections: { toppings: TOPPINGS },
});

/** Data mẫu: 2 món (trà sữa ×3 có 1 topping, cà phê ×2 có ghi chú). */
export const TEST_ORDER_SAMPLE: TestOrder = {
  code: 'HD001',
  tableName: 'Bàn 5',
  createdAt: '2026-09-24T10:30:00',
  discount: 5000,
  storeLogo: 'store-logo@v1',
  items: [
    { name: 'Trà sữa', quantity: 3, price: 45000, toppings: [{ name: 'Trân châu', price: 5000 }] },
    { name: 'Cà phê', quantity: 2, price: 30000, note: 'Ít đá', toppings: [] },
  ],
};

/** Catalog đơn hàng dùng chung cho test của catalog, template, resolution, layout. */
export const TEST_ORDER_CATALOG = defineCatalog({
  id: 'test-order',
  version: 1,
  sample: TEST_ORDER_SAMPLE,
  variables: {
    orderCode: { label: 'Mã đơn', type: 'string', get: (order) => order.code },
    tableName: { label: 'Tên bàn', type: 'string', optional: true, get: (order) => order.tableName },
    createdAt: { label: 'Giờ tạo đơn', type: 'datetime', get: (order) => order.createdAt },
    discount: { label: 'Giảm giá', type: 'money', get: (order) => order.discount },
    storeLogo: { label: 'Logo cửa hàng', type: 'asset', optional: true, get: (order) => order.storeLogo },
  },
  collections: { items: ITEMS },
});
```

Thêm vào cuối `packages/printer-core/src/testing/index.ts`:

```ts
export * from './OrderTestCatalog';
```

`packages/printer-core/src/catalog/__tests__/defineCatalog.test.ts`:

```ts
import { defineCatalog, defineCollection } from '..';
import { TEST_ORDER_CATALOG, TEST_ORDER_SAMPLE } from '../../testing';

describe('defineCatalog', () => {
  it('đọc giá trị biến gốc và biến tính toán của collection', () => {
    const firstItem = TEST_ORDER_SAMPLE.items[0];

    expect(TEST_ORDER_CATALOG.readVariable('orderCode', TEST_ORDER_SAMPLE)).toBe('HD001');
    expect(TEST_ORDER_CATALOG.readVariable('itemTotal', firstItem)).toBe(135000);
  });

  it('đọc mảng phần tử của collection cấp 1 và collection lồng', () => {
    const firstItem = TEST_ORDER_SAMPLE.items[0];

    expect(TEST_ORDER_CATALOG.readCollection('items', TEST_ORDER_SAMPLE)).toHaveLength(2);
    expect(TEST_ORDER_CATALOG.readCollection('toppings', firstItem)).toEqual([{ name: 'Trân châu', price: 5000 }]);
  });

  it('throw khi đọc biến hoặc collection không tồn tại', () => {
    expect(() => TEST_ORDER_CATALOG.readVariable('missing', TEST_ORDER_SAMPLE)).toThrow('không có biến "missing"');
    expect(() => TEST_ORDER_CATALOG.readCollection('missing', TEST_ORDER_SAMPLE)).toThrow(
      'không có collection "missing"',
    );
  });

  it('throw khi tên biến trùng giữa biến gốc và biến của collection', () => {
    const items = defineCollection({
      label: 'Món',
      get: (order: { readonly items: readonly string[] }) => order.items,
      variables: { name: { label: 'Tên', type: 'string', get: (item) => item } },
    });

    expect(() =>
      defineCatalog({
        id: 'duplicate',
        version: 1,
        sample: { name: 'A', items: [] as readonly string[] },
        variables: { name: { label: 'Tên', type: 'string', get: (order) => order.name } },
        collections: { items },
      }),
    ).toThrow('Tên "name" bị trùng trong catalog');
  });

  it('throw khi tên collection trùng tên biến', () => {
    const items = defineCollection({
      label: 'Món',
      get: (order: { readonly items: readonly string[] }) => order.items,
      variables: {},
    });

    expect(() =>
      defineCatalog({
        id: 'duplicate',
        version: 1,
        sample: { items: [] as readonly string[] },
        variables: { items: { label: 'Món', type: 'string', get: () => '' } },
        collections: { items },
      }),
    ).toThrow('Tên "items" bị trùng trong catalog');
  });

  it('throw khi tên biến bắt đầu bằng "$"', () => {
    expect(() =>
      defineCatalog({
        id: 'reserved',
        version: 1,
        sample: {},
        variables: { $page: { label: 'Trang', type: 'number', get: () => 1 } },
      }),
    ).toThrow('tiền tố "$" dành cho biến có sẵn');
  });

  it('describe() trả metadata JSON thuần, không lộ hàm get', () => {
    const description = TEST_ORDER_CATALOG.describe();

    expect(JSON.parse(JSON.stringify(description))).toEqual(description);
    expect(description.variables.map((variable) => variable.name)).toEqual([
      'orderCode',
      'tableName',
      'createdAt',
      'discount',
      'storeLogo',
    ]);
    expect(description.variables[1]).toEqual({ name: 'tableName', label: 'Tên bàn', type: 'string', optional: true });
    expect(description.collections[0].name).toBe('items');
    expect(description.collections[0].collections[0].name).toBe('toppings');
    expect(description.collections[0].variables[4].deprecated).toBe('Dùng itemName');
  });
});
```

`packages/printer-core/src/catalog/__tests__/CatalogIndex.test.ts`:

```ts
import { createCatalogIndex, isBuiltInVariableName } from '..';
import { TEST_ORDER_CATALOG } from '../../testing';

describe('createCatalogIndex', () => {
  const index = createCatalogIndex(TEST_ORDER_CATALOG.describe());

  it('ghi collection sở hữu của từng biến', () => {
    expect(index.variables.get('orderCode')?.collection).toBeNull();
    expect(index.variables.get('itemName')?.collection).toBe('items');
    expect(index.variables.get('toppingName')?.collection).toBe('toppings');
  });

  it('ghi collection cha của từng collection', () => {
    expect(index.collections.get('items')?.parent).toBeNull();
    expect(index.collections.get('toppings')?.parent).toBe('items');
  });

  it('không có tên lạ trong bảng tra', () => {
    expect(index.variables.has('missing')).toBe(false);
    expect(index.collections.has('missing')).toBe(false);
  });
});

describe('isBuiltInVariableName', () => {
  it('nhận đúng 6 biến có sẵn', () => {
    const names = ['$position', '$total', '$unit', '$unitCount', '$page', '$pageCount'];

    expect(names.every(isBuiltInVariableName)).toBe(true);
    expect(isBuiltInVariableName('$other')).toBe(false);
    expect(isBuiltInVariableName('toString')).toBe(false);
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `npx jest packages/printer-core/src/catalog`
Expected: FAIL — `Cannot find module '..'` (chưa có `catalog/index.ts`).

- [ ] **Step 4: Viết implementation**

`packages/printer-core/src/catalog/VariableType.ts`:

```ts
/** Kiểu giá trị của 1 biến catalog — quyết định format mặc định và luật validate template. */
export type VariableType = 'string' | 'number' | 'money' | 'datetime' | 'boolean' | 'asset';
```

`packages/printer-core/src/catalog/VariableSpec.ts`:

```ts
import type { VariableType } from './VariableType';

/** Khai báo 1 biến trong catalog: tên hiển thị, kiểu, và cách lấy giá trị từ data nguồn. */
export interface VariableSpec<TSource> {
  /** Tên hiển thị cho người dùng, VD 'Tên bàn'. */
  readonly label: string;

  /** Kiểu giá trị, quyết định format mặc định. */
  readonly type: VariableType;

  /** Cho phép rỗng: giá trị `undefined`/`null` in ra chuỗi rỗng thay vì báo lỗi. Mặc định `false`. */
  readonly optional?: boolean;

  /** Lý do ngừng dùng + biến thay thế; biến vẫn chạy, validate template chỉ cảnh báo. */
  readonly deprecated?: string;

  /**
   * Lấy giá trị raw từ data nguồn. Mọi phép tính (VD thành tiền) nằm ở đây, template không tính toán.
   * Khai báo dạng method để TypeScript so khớp tham số hai chiều — nhờ vậy các collection có kiểu
   * phần tử khác nhau vẫn gom chung được vào 1 map.
   */
  get(source: TSource): unknown;
}

/** Tập biến theo tên của 1 scope (data gốc hoặc phần tử của 1 collection). */
export type VariableSpecMap<TSource> = Readonly<Record<string, VariableSpec<TSource>>>;
```

`packages/printer-core/src/catalog/CatalogCollection.ts`:

```ts
import type { VariableSpecMap } from './VariableSpec';

/** 1 danh sách lặp được trong catalog (VD danh sách món), kèm biến và collection con của từng phần tử. */
export interface CatalogCollection<
  TSource,
  TItem,
  TVariables extends VariableSpecMap<TItem> = VariableSpecMap<TItem>,
  TCollections extends CatalogCollectionMap<TItem> = CatalogCollectionMap<TItem>,
> {
  /** Tên hiển thị, VD 'Danh sách món'. */
  readonly label: string;

  /** Biến của từng phần tử — chỉ dùng được bên trong `repeat` của collection này. */
  readonly variables: TVariables;

  /** Collection lồng trong từng phần tử (VD topping của từng món); rỗng nếu không có. */
  readonly collections: TCollections;

  /** Lấy mảng phần tử từ data nguồn (data gốc hoặc phần tử của collection cha). */
  get(source: TSource): readonly TItem[];
}

/** Tập collection theo tên của 1 scope. */
export interface CatalogCollectionMap<TSource> {
  readonly [name: string]: CatalogCollection<TSource, unknown>;
}

/** Tập collection rỗng — kiểu mặc định khi scope không có collection con. */
export type EmptyCollectionMap = Readonly<Record<never, never>>;

/** Input của `defineCollection`: giống `CatalogCollection` nhưng được bỏ trống `collections`. */
export interface CollectionDefinition<TSource, TItem, TVariables, TCollections> {
  /** Tên hiển thị, VD 'Danh sách món'. */
  readonly label: string;

  /** Biến của từng phần tử. */
  readonly variables: TVariables;

  /** Collection lồng trong từng phần tử; bỏ trống nếu không có. */
  readonly collections?: TCollections;

  /** Lấy mảng phần tử từ data nguồn — phải chú thích kiểu tham số để suy ra kiểu phần tử. */
  get(source: TSource): readonly TItem[];
}

/**
 * Khai báo 1 collection. Kiểu phần tử suy ra từ kiểu trả về của `get`, nên cần chú thích kiểu
 * tham số: `get: (order: Order) => order.items`.
 */
export function defineCollection<
  TSource,
  TItem,
  TVariables extends VariableSpecMap<TItem>,
  TCollections extends CatalogCollectionMap<TItem> = EmptyCollectionMap,
>(
  definition: CollectionDefinition<TSource, TItem, TVariables, TCollections>,
): NoInfer<CatalogCollection<TSource, TItem, TVariables, TCollections>> {
  // NoInfer: khi khai báo lồng trong defineCatalog, kiểu mong đợi ở chỗ gọi có phần tử `unknown`
  // và sẽ lấn át kiểu suy từ `get` nếu không chặn.
  return {
    label: definition.label,
    variables: definition.variables,
    collections: definition.collections ?? ({} as TCollections),
    get: (source: TSource) => definition.get(source),
  };
}
```

`packages/printer-core/src/catalog/CatalogDescription.ts`:

```ts
import type { VariableType } from './VariableType';

/** Metadata JSON của 1 biến — không chứa hàm `get`, dùng được ở designer/BE. */
export interface VariableDescription {
  /** Tên biến, duy nhất trong toàn catalog. */
  readonly name: string;

  /** Tên hiển thị cho người dùng. */
  readonly label: string;

  readonly type: VariableType;

  /** Cho phép rỗng hay không. */
  readonly optional: boolean;

  /** Lý do ngừng dùng; không có field này nghĩa là biến còn dùng bình thường. */
  readonly deprecated?: string;
}

/** Metadata JSON của 1 collection và toàn bộ biến/collection con của nó. */
export interface CollectionDescription {
  /** Tên collection, duy nhất trong toàn catalog. */
  readonly name: string;

  /** Tên hiển thị cho người dùng. */
  readonly label: string;

  /** Biến của từng phần tử. */
  readonly variables: readonly VariableDescription[];

  /** Collection lồng trong từng phần tử. */
  readonly collections: readonly CollectionDescription[];
}

/** Metadata JSON của cả catalog — kết quả của `catalog.describe()`. */
export interface CatalogDescription {
  /** Mã catalog, khớp với `TemplateDocument.catalog`. */
  readonly id: string;

  /** Phiên bản catalog do app tự tăng khi thêm/đổi biến. */
  readonly version: number;

  /** Biến gốc, dùng được ở mọi chỗ trong template. */
  readonly variables: readonly VariableDescription[];

  /** Collection cấp 1. */
  readonly collections: readonly CollectionDescription[];
}
```

`packages/printer-core/src/catalog/Catalog.ts`:

```ts
import type { CatalogCollectionMap } from './CatalogCollection';
import type { CatalogDescription } from './CatalogDescription';
import type { VariableSpecMap } from './VariableSpec';

/** Catalog đã khai báo — cầu nối duy nhất giữa template và data nội bộ của app. */
export interface Catalog<
  TData,
  TVariables extends VariableSpecMap<TData> = VariableSpecMap<TData>,
  TCollections extends CatalogCollectionMap<TData> = CatalogCollectionMap<TData>,
> {
  /** Mã catalog, VD 'product-label'; template tham chiếu qua `TemplateDocument.catalog`. */
  readonly id: string;

  /** Phiên bản catalog do app tự tăng khi thêm/đổi biến. */
  readonly version: number;

  /** Data mẫu cho preview/designer. */
  readonly sample: TData;

  /** Biến gốc, dùng được ở mọi chỗ trong template. */
  readonly variables: TVariables;

  /** Collection cấp 1. */
  readonly collections: TCollections;

  /** Metadata JSON thuần (không có hàm) cho designer/BE và cho validate template. */
  describe(): CatalogDescription;

  /**
   * Đọc giá trị raw của biến `name` từ `source`. `source` có kiểu `unknown` vì resolver chỉ biết
   * tên biến lúc chạy. Throw nếu catalog không có biến này.
   */
  readVariable(name: string, source: unknown): unknown;

  /** Đọc mảng phần tử của collection `name` từ `source`. Throw nếu catalog không có collection này. */
  readCollection(name: string, source: unknown): unknown;
}

/** Input của `defineCatalog`. */
export interface CatalogDefinition<TData, TVariables, TCollections> {
  /** Mã catalog, VD 'product-label'. */
  readonly id: string;

  /** Phiên bản catalog. */
  readonly version: number;

  /** Data mẫu cho preview/designer; kiểu data của catalog suy ra từ field này. */
  readonly sample: TData;

  /** Biến gốc. */
  readonly variables: TVariables;

  /** Collection cấp 1; bỏ trống nếu không có. */
  readonly collections?: TCollections;
}
```

`packages/printer-core/src/catalog/BuiltInVariable.ts`:

```ts
/** Tên các biến có sẵn, không cần khai báo trong catalog. */
export type BuiltInVariableName = '$position' | '$total' | '$unit' | '$unitCount' | '$page' | '$pageCount';

/** Nơi dùng được 1 biến có sẵn: mọi chỗ / trong `repeat` / trong `repeat` có `expand`. */
export type BuiltInVariableScope = 'document' | 'repeat' | 'expand';

/** Tiền tố dành riêng cho biến có sẵn — catalog không được đặt tên biến bắt đầu bằng ký tự này. */
export const RESERVED_NAME_PREFIX = '$';

/** Scope hợp lệ của từng biến có sẵn. Mọi biến có sẵn đều có kiểu `number`. */
export const BUILT_IN_VARIABLE_SCOPES: Readonly<Record<BuiltInVariableName, BuiltInVariableScope>> = {
  $position: 'repeat',
  $total: 'repeat',
  $unit: 'expand',
  $unitCount: 'expand',
  $page: 'document',
  $pageCount: 'document',
};

/** Kiểm tra 1 tên có phải biến có sẵn không. */
export function isBuiltInVariableName(name: string): name is BuiltInVariableName {
  return Object.prototype.hasOwnProperty.call(BUILT_IN_VARIABLE_SCOPES, name);
}
```

`packages/printer-core/src/catalog/CatalogRegistry.ts`:

```ts
import { RESERVED_NAME_PREFIX } from './BuiltInVariable';
import type { CatalogCollection, CatalogCollectionMap } from './CatalogCollection';
import type { VariableSpec, VariableSpecMap } from './VariableSpec';

/** Bảng tra phẳng biến/collection theo tên, dựng 1 lần lúc khai báo catalog. */
export interface CatalogRegistry {
  /** Mọi biến ở mọi cấp, theo tên. */
  readonly variables: ReadonlyMap<string, VariableSpec<unknown>>;

  /** Mọi collection ở mọi cấp, theo tên. */
  readonly collections: ReadonlyMap<string, CatalogCollection<unknown, unknown>>;
}

interface MutableCatalogRegistry {
  readonly variables: Map<string, VariableSpec<unknown>>;
  readonly collections: Map<string, CatalogCollection<unknown, unknown>>;
}

/** Dựng registry; throw nếu tên trùng ở bất kỳ cấp nào hoặc tên dùng tiền tố dành riêng `$`. */
export function createCatalogRegistry(
  variables: VariableSpecMap<unknown>,
  collections: CatalogCollectionMap<unknown>,
): CatalogRegistry {
  const registry: MutableCatalogRegistry = { variables: new Map(), collections: new Map() };
  registerScope(registry, variables, collections);
  return registry;
}

function registerScope(
  registry: MutableCatalogRegistry,
  variables: VariableSpecMap<unknown>,
  collections: CatalogCollectionMap<unknown>,
): void {
  for (const [name, spec] of Object.entries(variables)) {
    assertNameAvailable(registry, name);
    registry.variables.set(name, spec);
  }

  for (const [name, collection] of Object.entries(collections)) {
    assertNameAvailable(registry, name);
    registry.collections.set(name, collection);
    registerScope(registry, collection.variables, collection.collections);
  }
}

// Tên duy nhất toàn catalog là điều kiện để resolver biết chắc 1 biến thuộc scope nào.
function assertNameAvailable(registry: MutableCatalogRegistry, name: string): void {
  if (name.startsWith(RESERVED_NAME_PREFIX)) {
    throw new Error(`Tên "${name}" không hợp lệ: tiền tố "${RESERVED_NAME_PREFIX}" dành cho biến có sẵn`);
  }
  if (registry.variables.has(name) || registry.collections.has(name)) {
    throw new Error(`Tên "${name}" bị trùng trong catalog`);
  }
}

/** Đọc giá trị raw của 1 biến; throw nếu biến không tồn tại. */
export function readRegisteredVariable(
  registry: CatalogRegistry,
  name: string,
  source: unknown,
): unknown {
  const spec = registry.variables.get(name);
  if (!spec) throw new Error(`Catalog không có biến "${name}"`);
  return spec.get(source);
}

/** Đọc mảng phần tử của 1 collection; throw nếu collection không tồn tại. */
export function readRegisteredCollection(
  registry: CatalogRegistry,
  name: string,
  source: unknown,
): unknown {
  const collection = registry.collections.get(name);
  if (!collection) throw new Error(`Catalog không có collection "${name}"`);
  return collection.get(source);
}
```

`packages/printer-core/src/catalog/describeCatalog.ts`:

```ts
import type { CatalogCollectionMap } from './CatalogCollection';
import type { CollectionDescription, VariableDescription } from './CatalogDescription';
import type { VariableSpec, VariableSpecMap } from './VariableSpec';

/** Chuyển tập biến thành metadata JSON, bỏ hàm `get`. */
export function describeVariables(variables: VariableSpecMap<unknown>): readonly VariableDescription[] {
  return Object.entries(variables).map(([name, spec]) => describeVariable(name, spec));
}

/** Chuyển tập collection (đệ quy cả collection con) thành metadata JSON. */
export function describeCollections(collections: CatalogCollectionMap<unknown>): readonly CollectionDescription[] {
  return Object.entries(collections).map(([name, collection]) => ({
    name,
    label: collection.label,
    variables: describeVariables(collection.variables),
    collections: describeCollections(collection.collections),
  }));
}

function describeVariable(name: string, spec: VariableSpec<unknown>): VariableDescription {
  return {
    name,
    label: spec.label,
    type: spec.type,
    optional: spec.optional ?? false,
    ...(spec.deprecated !== undefined ? { deprecated: spec.deprecated } : {}),
  };
}
```

`packages/printer-core/src/catalog/defineCatalog.ts`:

```ts
import type { Catalog, CatalogDefinition } from './Catalog';
import type { CatalogCollectionMap, EmptyCollectionMap } from './CatalogCollection';
import type { CatalogDescription } from './CatalogDescription';
import { createCatalogRegistry, readRegisteredCollection, readRegisteredVariable } from './CatalogRegistry';
import { describeCollections, describeVariables } from './describeCatalog';
import type { VariableSpecMap } from './VariableSpec';

/**
 * Khai báo catalog cho 1 loại nội dung in. Kiểu data suy ra từ `sample`.
 * Throw ngay nếu tên biến/collection trùng ở bất kỳ cấp nào hoặc bắt đầu bằng `$`.
 */
export function defineCatalog<
  TData,
  TVariables extends VariableSpecMap<TData>,
  TCollections extends CatalogCollectionMap<TData> = EmptyCollectionMap,
>(definition: CatalogDefinition<TData, TVariables, TCollections>): Catalog<TData, TVariables, TCollections> {
  const collections = definition.collections ?? ({} as TCollections);
  const registry = createCatalogRegistry(definition.variables, collections);
  const description: CatalogDescription = {
    id: definition.id,
    version: definition.version,
    variables: describeVariables(definition.variables),
    collections: describeCollections(collections),
  };

  return Object.freeze({
    id: definition.id,
    version: definition.version,
    sample: definition.sample,
    variables: definition.variables,
    collections,
    describe: () => description,
    readVariable: (name: string, source: unknown) => readRegisteredVariable(registry, name, source),
    readCollection: (name: string, source: unknown) => readRegisteredCollection(registry, name, source),
  });
}
```

`packages/printer-core/src/catalog/CatalogIndex.ts`:

```ts
import type { CatalogDescription, CollectionDescription, VariableDescription } from './CatalogDescription';

/** 1 biến trong bảng tra, kèm collection sở hữu. */
export interface IndexedVariable {
  readonly description: VariableDescription;

  /** Tên collection sở hữu biến; `null` là biến gốc. */
  readonly collection: string | null;
}

/** 1 collection trong bảng tra, kèm collection cha. */
export interface IndexedCollection {
  readonly description: CollectionDescription;

  /** Tên collection cha; `null` là collection cấp 1. */
  readonly parent: string | null;
}

/** Bảng tra phẳng theo tên, dựng từ metadata — dùng chung cho resolver, validate và designer/BE. */
export interface CatalogIndex {
  /** Mọi biến ở mọi cấp, theo tên. */
  readonly variables: ReadonlyMap<string, IndexedVariable>;

  /** Mọi collection ở mọi cấp, theo tên. */
  readonly collections: ReadonlyMap<string, IndexedCollection>;
}

interface MutableCatalogIndex {
  readonly variables: Map<string, IndexedVariable>;
  readonly collections: Map<string, IndexedCollection>;
}

/** Dựng bảng tra từ `catalog.describe()`. */
export function createCatalogIndex(description: CatalogDescription): CatalogIndex {
  const index: MutableCatalogIndex = { variables: new Map(), collections: new Map() };
  indexScope(index, description.variables, description.collections, null);
  return index;
}

function indexScope(
  index: MutableCatalogIndex,
  variables: readonly VariableDescription[],
  collections: readonly CollectionDescription[],
  owner: string | null,
): void {
  for (const variable of variables) {
    index.variables.set(variable.name, { description: variable, collection: owner });
  }

  for (const collection of collections) {
    index.collections.set(collection.name, { description: collection, parent: owner });
    indexScope(index, collection.variables, collection.collections, collection.name);
  }
}
```

`packages/printer-core/src/catalog/index.ts`:

```ts
export * from './VariableType';
export * from './VariableSpec';
export * from './CatalogCollection';
export * from './CatalogDescription';
export * from './Catalog';
export * from './BuiltInVariable';
export * from './CatalogIndex';
export { defineCatalog } from './defineCatalog';
```

Thêm vào cuối `packages/printer-core/src/index.ts`:

```ts
export * from './catalog';
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `npx jest packages/printer-core/src/catalog`
Expected: PASS — 2 suites, 11 tests.

- [ ] **Step 6: Verify toàn bộ**

```bash
npm run type-check -w printer-core
npx jest packages/printer-core
npx eslint packages/printer-core/src/catalog packages/printer-core/src/testing
```

Expected: type-check không lỗi; toàn bộ test printer-core pass (thêm 11 test so với trước); eslint 0 error. Chạy lệnh line-length với `packages/printer-core/src/catalog packages/printer-core/src/testing/OrderTestCatalog.ts` — không in gì.

- [ ] **Step 7: Commit**

```bash
git add packages/printer-core/src/catalog packages/printer-core/src/testing/OrderTestCatalog.ts packages/printer-core/src/testing/index.ts packages/printer-core/src/index.ts
git commit -m "feat: add catalog module for named template variables

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `Length`, segment/format/điều kiện và formatter vi-VN

Task này chỉ **thêm** file mới, không sửa type cũ — type-check toàn package vẫn phải sạch.

**Files:**
- Create: `packages/printer-core/src/template/style/Length.ts`
- Create: `packages/printer-core/src/template/content/ValueFormat.ts`, `Segment.ts`, `Condition.ts`
- Create: `packages/printer-core/src/template/format/formatNumber.ts`, `formatCurrency.ts`, `formatDateTime.ts`, `formatText.ts`, `formatValue.ts`, `index.ts`
- Test: `packages/printer-core/src/template/format/__tests__/formatNumber.test.ts`, `formatCurrency.test.ts`, `formatDateTime.test.ts`, `formatText.test.ts`, `formatValue.test.ts`
- Modify: `packages/printer-core/src/template/index.ts`

**Interfaces:**
- Consumes: `VariableType` từ `../../catalog` (Task 1).
- Produces:
  - `LengthUnit = 'mm' | 'pt' | 'px'`, `Length { value: number; unit: LengthUnit }`
  - `ValueFormat = NumberFormat | CurrencyFormat | DateTimeFormat | TextFormat`, `CurrencySymbol`
  - `Segment = TextSegment { text } | VariableSegment { var; format? }`
  - `Condition = PresenceCondition | ComparisonCondition | GroupCondition | NotCondition`, `ComparisonValue`
  - `formatNumber(value, decimals = 0)`, `formatCurrency(value, format)`, `formatDateTime(value, pattern)`, `formatText(value, format)`, `formatValue(value, format | undefined, type: VariableType): string`, `DEFAULT_DATETIME_PATTERN = 'dd/MM/yyyy HH:mm'`

- [ ] **Step 1: Viết test formatter**

`packages/printer-core/src/template/format/__tests__/formatNumber.test.ts`:

```ts
import { formatNumber } from '..';

describe('formatNumber', () => {
  it.each([
    [0, 0, '0'],
    [45000, 0, '45.000'],
    [1234567.891, 2, '1.234.567,89'],
    [-1500, 0, '-1.500'],
    [-0.001, 0, '0'],
    [999.5, 0, '1.000'],
    [12.5, 1, '12,5'],
    [100, 2, '100,00'],
  ])('formatNumber(%p, %p) = %p', (value, decimals, expected) => {
    expect(formatNumber(value, decimals)).toBe(expected);
  });

  it('throw với NaN/Infinity', () => {
    expect(() => formatNumber(Number.NaN)).toThrow('Không format được số');
    expect(() => formatNumber(Number.POSITIVE_INFINITY)).toThrow('Không format được số');
  });
});
```

`packages/printer-core/src/template/format/__tests__/formatCurrency.test.ts`:

```ts
import { formatCurrency } from '..';

describe('formatCurrency', () => {
  it.each([
    [{ type: 'currency' as const }, 45000, '45.000đ'],
    [{ type: 'currency' as const, symbol: '₫' as const }, 45000, '45.000₫'],
    [{ type: 'currency' as const, symbol: 'VND' as const }, 45000, '45.000 VND'],
    [{ type: 'currency' as const, symbol: '' as const }, 45000, '45.000'],
    [{ type: 'currency' as const, decimals: 2 }, -1234.5, '-1.234,50đ'],
  ])('%j với %p = %p', (format, value, expected) => {
    expect(formatCurrency(value, format)).toBe(expected);
  });
});
```

`packages/printer-core/src/template/format/__tests__/formatDateTime.test.ts`:

```ts
import { formatDateTime } from '..';

describe('formatDateTime', () => {
  const localIso = '2026-09-04T08:05:09';

  it('thay đúng từng token, giữ nguyên ký tự khác', () => {
    expect(formatDateTime(localIso, 'dd/MM/yyyy HH:mm:ss')).toBe('04/09/2026 08:05:09');
    expect(formatDateTime(localIso, 'yy-MM-dd')).toBe('26-09-04');
    expect(formatDateTime(localIso, 'HH:mm')).toBe('08:05');
  });

  it('nhận epoch ms', () => {
    const epochMs = new Date(2026, 8, 4, 8, 5, 9).getTime();

    expect(formatDateTime(epochMs, 'dd/MM/yyyy HH:mm')).toBe('04/09/2026 08:05');
  });

  it('throw với input không phải ngày giờ', () => {
    expect(() => formatDateTime('not a date', 'dd')).toThrow('không phải ngày giờ hợp lệ');
    expect(() => formatDateTime(true, 'dd')).toThrow('không phải ngày giờ hợp lệ');
  });
});
```

`packages/printer-core/src/template/format/__tests__/formatText.test.ts`:

```ts
import { formatText } from '..';

describe('formatText', () => {
  it('đổi hoa/thường, kể cả chữ có dấu', () => {
    expect(formatText('trà đá', { type: 'text', transform: 'upper' })).toBe('TRÀ ĐÁ');
    expect(formatText('TRÀ ĐÁ', { type: 'text', transform: 'lower' })).toBe('trà đá');
  });

  it('cắt theo số ký tự', () => {
    expect(formatText('Trà sữa trân châu', { type: 'text', maxLength: 7 })).toBe('Trà sữa');
  });
});
```

`packages/printer-core/src/template/format/__tests__/formatValue.test.ts`:

```ts
import { formatValue } from '..';

describe('formatValue', () => {
  it('dùng format mặc định theo kiểu biến khi segment không khai báo format', () => {
    expect(formatValue(45000, undefined, 'money')).toBe('45.000đ');
    expect(formatValue('2026-09-04T08:05:09', undefined, 'datetime')).toBe('04/09/2026 08:05');
    expect(formatValue(1234.5, undefined, 'number')).toBe('1234.5');
    expect(formatValue(true, undefined, 'boolean')).toBe('true');
  });

  it('format khai báo trong segment được ưu tiên hơn mặc định', () => {
    expect(formatValue(1234.5, { type: 'number', decimals: 1 }, 'number')).toBe('1.234,5');
    expect(formatValue(45000, { type: 'currency', symbol: 'VND' }, 'money')).toBe('45.000 VND');
  });

  it('throw khi format số gặp giá trị không phải số', () => {
    expect(() => formatValue('45000', { type: 'number' }, 'string')).toThrow('không phải số');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx jest packages/printer-core/src/template/format`
Expected: FAIL — `Cannot find module '..'`.

- [ ] **Step 3: Viết type mới**

`packages/printer-core/src/template/style/Length.ts`:

```ts
/** Đơn vị độ dài trong template: `mm` = 1/25.4 inch, `pt` = 1/72 inch, `px` = 1/96 inch (pixel chuẩn CSS). */
export type LengthUnit = 'mm' | 'pt' | 'px';

/** Độ dài vật lý, độc lập DPI — tầng Layout mới đổi sang dots theo máy in đích. */
export interface Length {
  /** Giá trị số, giữ nguyên như người viết khai báo (không quy đổi lúc lưu). */
  readonly value: number;

  readonly unit: LengthUnit;
}
```

`packages/printer-core/src/template/content/ValueFormat.ts`:

```ts
/** Ký hiệu tiền tệ; chuỗi rỗng là chỉ in số. */
export type CurrencySymbol = 'đ' | '₫' | 'VND' | '';

/** In số có phân tách hàng nghìn, VD `45.000`. */
export interface NumberFormat {
  readonly type: 'number';

  /** Số chữ số thập phân; mặc định 0. */
  readonly decimals?: number;
}

/** In số tiền kèm ký hiệu, VD `45.000đ`. */
export interface CurrencyFormat {
  readonly type: 'currency';

  /** Ký hiệu tiền tệ; mặc định `đ`. */
  readonly symbol?: CurrencySymbol;

  /** Số chữ số thập phân; mặc định 0. */
  readonly decimals?: number;
}

/** In ngày giờ theo pattern. */
export interface DateTimeFormat {
  readonly type: 'datetime';

  /** Pattern gồm các token `dd`, `MM`, `yyyy`, `yy`, `HH`, `mm`, `ss`; ký tự khác giữ nguyên. */
  readonly pattern: string;
}

/** In chuỗi, có thể đổi hoa/thường và cắt ngắn. */
export interface TextFormat {
  readonly type: 'text';

  /** Đổi chữ hoa/thường; bỏ trống là giữ nguyên. */
  readonly transform?: 'upper' | 'lower';

  /** Số ký tự tối đa, cắt phần thừa; bỏ trống là không giới hạn. */
  readonly maxLength?: number;
}

/** Cách hiển thị giá trị của 1 biến; bỏ trống thì dùng format mặc định theo kiểu biến. */
export type ValueFormat = NumberFormat | CurrencyFormat | DateTimeFormat | TextFormat;
```

`packages/printer-core/src/template/content/Segment.ts`:

```ts
import type { ValueFormat } from './ValueFormat';

/** Đoạn chữ cố định. */
export interface TextSegment {
  readonly text: string;
}

/** Đoạn lấy giá trị từ 1 biến catalog hoặc biến có sẵn (`$page`, `$unit`...). */
export interface VariableSegment {
  /** Tên biến. */
  readonly var: string;

  /** Cách hiển thị giá trị; bỏ trống thì dùng format mặc định theo kiểu biến. */
  readonly format?: ValueFormat;
}

/** 1 đoạn nội dung động của text/barcode/QR — nội dung là mảng segment ghép liền nhau. */
export type Segment = TextSegment | VariableSegment;
```

`packages/printer-core/src/template/content/Condition.ts`:

```ts
/** Giá trị hằng dùng để so sánh với giá trị raw của biến. */
export type ComparisonValue = string | number | boolean;

/** `exists`: giá trị khác `undefined`/`null`. `notEmpty`: `exists` và không phải chuỗi rỗng/mảng rỗng. */
export interface PresenceCondition {
  readonly op: 'exists' | 'notEmpty';

  /** Tên biến cần kiểm tra. */
  readonly var: string;
}

/** So sánh giá trị raw của biến (trước khi format) với 1 hằng; `gt`/`gte`/`lt`/`lte` chỉ đúng khi cả 2 là số. */
export interface ComparisonCondition {
  readonly op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

  /** Tên biến cần so sánh. */
  readonly var: string;

  /** Hằng để so sánh. */
  readonly value: ComparisonValue;
}

/** `and`: mọi điều kiện con đúng. `or`: ít nhất 1 điều kiện con đúng. */
export interface GroupCondition {
  readonly op: 'and' | 'or';

  /** Các điều kiện con. */
  readonly conditions: readonly Condition[];
}

/** Phủ định 1 điều kiện. */
export interface NotCondition {
  readonly op: 'not';

  /** Điều kiện bị phủ định. */
  readonly condition: Condition;
}

/** Điều kiện ẩn/hiện node — data thuần, không phải biểu thức chuỗi, nên không cần parser/eval. */
export type Condition = PresenceCondition | ComparisonCondition | GroupCondition | NotCondition;
```

- [ ] **Step 4: Viết formatter**

`packages/printer-core/src/template/format/formatNumber.ts`:

```ts
/** Dấu phân cách hàng nghìn theo vi-VN. */
const THOUSANDS_SEPARATOR = '.';

/** Dấu phân cách thập phân theo vi-VN. */
const DECIMAL_SEPARATOR = ',';

/** Chèn dấu phân cách trước mỗi nhóm 3 chữ số tính từ phải sang. */
const THOUSANDS_GROUP_PATTERN = /\B(?=(\d{3})+(?!\d))/g;

/** Chữ số khác 0 — dùng để biết số âm sau khi làm tròn có còn khác 0 không. */
const NON_ZERO_DIGIT_PATTERN = /[1-9]/;

/**
 * Format số theo vi-VN (`1.234.567,89`). Tự cài đặt thay vì dùng `Intl` vì `Intl` trên Hermes
 * không đồng nhất với trình duyệt, dễ làm preview web khác bản in trên máy thật.
 */
export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) throw new Error(`Không format được số "${value}"`);

  const fixed = Math.abs(value).toFixed(decimals);
  const [integerDigits, fractionDigits] = fixed.split('.');
  const grouped = integerDigits.replace(THOUSANDS_GROUP_PATTERN, THOUSANDS_SEPARATOR);
  const unsigned = fractionDigits === undefined ? grouped : `${grouped}${DECIMAL_SEPARATOR}${fractionDigits}`;

  // Số âm làm tròn về 0 (VD -0,001 với 0 chữ số thập phân) in "0", không in "-0".
  const isNegative = value < 0 && NON_ZERO_DIGIT_PATTERN.test(fixed);
  return isNegative ? `-${unsigned}` : unsigned;
}
```

`packages/printer-core/src/template/format/formatCurrency.ts`:

```ts
import type { CurrencyFormat, CurrencySymbol } from '../content/ValueFormat';
import { formatNumber } from './formatNumber';

/** Ký hiệu tiền tệ mặc định khi `CurrencyFormat.symbol` bỏ trống. */
const DEFAULT_CURRENCY_SYMBOL: CurrencySymbol = 'đ';

/** Format số tiền theo vi-VN, VD `45.000đ`, `45.000 VND`. */
export function formatCurrency(value: number, format: CurrencyFormat): string {
  const amount = formatNumber(value, format.decimals ?? 0);
  const symbol = format.symbol ?? DEFAULT_CURRENCY_SYMBOL;
  if (symbol === '') return amount;

  // Ký hiệu dạng chữ cần khoảng trắng; ký hiệu 1 ký tự viết liền theo thói quen hoá đơn VN.
  return symbol === 'VND' ? `${amount} ${symbol}` : `${amount}${symbol}`;
}
```

`packages/printer-core/src/template/format/formatDateTime.ts`:

```ts
/** Các token pattern hỗ trợ; `yyyy` đứng trước `yy` để khớp token dài trước. */
const DATETIME_TOKEN_PATTERN = /yyyy|yy|dd|MM|HH|mm|ss/g;

/** Số chữ số tối thiểu của token 2 chữ số (`dd`, `MM`, `HH`...). */
const TWO_DIGIT_WIDTH = 2;

/** Lấy 2 chữ số cuối của năm cho token `yy`. */
const SHORT_YEAR_MODULO = 100;

type TokenFormatter = (date: Date) => string;

// Dùng giờ địa phương của thiết bị: máy POS và trình duyệt preview cùng múi giờ cửa hàng.
const TOKEN_FORMATTERS: Readonly<Record<string, TokenFormatter>> = {
  yyyy: (date) => String(date.getFullYear()),
  yy: (date) => padTwoDigits(date.getFullYear() % SHORT_YEAR_MODULO),
  MM: (date) => padTwoDigits(date.getMonth() + 1),
  dd: (date) => padTwoDigits(date.getDate()),
  HH: (date) => padTwoDigits(date.getHours()),
  mm: (date) => padTwoDigits(date.getMinutes()),
  ss: (date) => padTwoDigits(date.getSeconds()),
};

/** Format ngày giờ theo pattern. Input là chuỗi ISO 8601 hoặc số epoch ms. */
export function formatDateTime(value: unknown, pattern: string): string {
  const date = toDate(value);
  return pattern.replace(DATETIME_TOKEN_PATTERN, (token) => TOKEN_FORMATTERS[token](date));
}

function toDate(value: unknown): Date {
  const date = typeof value === 'string' || typeof value === 'number' ? new Date(value) : undefined;
  if (date === undefined || Number.isNaN(date.getTime())) {
    throw new Error(`Giá trị "${String(value)}" không phải ngày giờ hợp lệ (cần chuỗi ISO 8601 hoặc epoch ms)`);
  }
  return date;
}

function padTwoDigits(value: number): string {
  return String(value).padStart(TWO_DIGIT_WIDTH, '0');
}
```

`packages/printer-core/src/template/format/formatText.ts`:

```ts
import type { TextFormat } from '../content/ValueFormat';

/** Format chuỗi: đổi hoa/thường rồi cắt theo `maxLength` (đếm theo ký tự, không theo byte). */
export function formatText(value: unknown, format: TextFormat): string {
  const text = applyTransform(String(value), format.transform);
  if (format.maxLength === undefined) return text;
  return Array.from(text).slice(0, format.maxLength).join('');
}

function applyTransform(text: string, transform: TextFormat['transform']): string {
  if (transform === 'upper') return text.toUpperCase();
  if (transform === 'lower') return text.toLowerCase();
  return text;
}
```

`packages/printer-core/src/template/format/formatValue.ts`:

```ts
import type { VariableType } from '../../catalog';
import type { ValueFormat } from '../content/ValueFormat';
import { formatCurrency } from './formatCurrency';
import { formatDateTime } from './formatDateTime';
import { formatNumber } from './formatNumber';
import { formatText } from './formatText';

/** Pattern mặc định cho biến kiểu `datetime` khi segment không khai báo `format`. */
export const DEFAULT_DATETIME_PATTERN = 'dd/MM/yyyy HH:mm';

/**
 * Đổi giá trị raw của biến thành chuỗi. `format` bỏ trống thì dùng mặc định theo kiểu biến:
 * `money` → currency, `datetime` → `DEFAULT_DATETIME_PATTERN`, kiểu khác → `String(value)`.
 * Throw nếu giá trị không hợp với format (VD format số cho chuỗi).
 */
export function formatValue(
  value: unknown,
  format: ValueFormat | undefined,
  type: VariableType,
): string {
  const effectiveFormat = format ?? defaultFormatFor(type);
  if (effectiveFormat === undefined) return String(value);

  switch (effectiveFormat.type) {
    case 'number':
      return formatNumber(requireNumber(value), effectiveFormat.decimals);
    case 'currency':
      return formatCurrency(requireNumber(value), effectiveFormat);
    case 'datetime':
      return formatDateTime(value, effectiveFormat.pattern);
    case 'text':
      return formatText(value, effectiveFormat);
  }
}

function defaultFormatFor(type: VariableType): ValueFormat | undefined {
  if (type === 'money') return { type: 'currency' };
  if (type === 'datetime') return { type: 'datetime', pattern: DEFAULT_DATETIME_PATTERN };
  return undefined;
}

function requireNumber(value: unknown): number {
  if (typeof value !== 'number') throw new Error(`Giá trị "${String(value)}" không phải số`);
  return value;
}
```

`packages/printer-core/src/template/format/index.ts`:

```ts
export { formatNumber } from './formatNumber';
export { formatCurrency } from './formatCurrency';
export { formatDateTime } from './formatDateTime';
export { formatText } from './formatText';
export { formatValue, DEFAULT_DATETIME_PATTERN } from './formatValue';
```

Thêm vào cuối `packages/printer-core/src/template/index.ts` (giữ nguyên các dòng export cũ):

```ts
export * from './style/Length';
export * from './content/ValueFormat';
export * from './content/Segment';
export * from './content/Condition';
export * from './format';
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `npx jest packages/printer-core/src/template/format`
Expected: PASS — 5 suites, 22 tests.

- [ ] **Step 6: Verify toàn bộ**

```bash
npm run type-check -w printer-core
npx jest packages/printer-core
npx eslint packages/printer-core/src/template
```

Expected: type-check sạch; toàn bộ test pass; eslint 0 error. Line-length với `packages/printer-core/src/template/style/Length.ts packages/printer-core/src/template/content packages/printer-core/src/template/format`.

- [ ] **Step 7: Commit**

```bash
git add packages/printer-core/src/template/style/Length.ts packages/printer-core/src/template/content packages/printer-core/src/template/format packages/printer-core/src/template/index.ts
git commit -m "feat: add Length, segment, condition types and vi-VN value formatters

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Type template mới (`TemplateDocument`, node, style) + `parseTemplate`/migrate

Bắt đầu cửa sổ type-check đỏ: sau task này `resolution/`, `layout/`, `src/__tests__/layout-engine-integration.test.ts` lỗi type cho tới Task 6-8. DSL cũ bị xoá ở đây và viết lại ở Task 5.

**Files:**
- Create: `packages/printer-core/src/template/TemplateDocument.ts`
- Replace (ghi đè toàn bộ): `packages/printer-core/src/template/style/Dimension.ts`, `Insets.ts`, `BoxStyle.ts`, `LayoutStyle.ts`, `TextStyle.ts`
- Replace: `packages/printer-core/src/template/nodes/TemplateNodeBase.ts`, `ContainerNode.ts`, `TextNode.ts`, `BarcodeNode.ts`, `QrCodeNode.ts`, `ImageNode.ts`, `LineNode.ts`, `RepeatNode.ts`, `TemplateNode.ts`
- Create: `packages/printer-core/src/template/parse/TemplateIssue.ts`, `JsonCursor.ts`, `validateStyle.ts`, `validateContent.ts`, `validateNode.ts`, `validateTemplateStructure.ts`, `migrateTemplate.ts`, `parseTemplate.ts`, `index.ts`
- Test: `packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts`, `migrateTemplate.test.ts`
- Delete: `packages/printer-core/src/template/PrintTemplate.ts`, `PrintTemplateType.ts`, `template/style/VisibilityCondition.ts`, `template/__tests__/`, `template/style/__tests__/`, `template/nodes/__tests__/`, toàn bộ `template/builder/`
- Replace: `packages/printer-core/src/template/index.ts`

**Interfaces:**
- Consumes: `Length`, `Segment`, `Condition`, `ValueFormat` (Task 2); `BarcodeSymbology`, `QrErrorCorrectionLevel` từ `../../symbology`.
- Produces:
  - `TEMPLATE_SCHEMA_VERSION = 1`, `TemplateMedia = 'label' | 'receipt'`, `TemplateLocale = 'vi-VN'`, `PaperSize { widthMm; heightMm? }`
  - `TemplateDocument { schemaVersion; id; name; catalog; media; locale; paper; root: TemplateNode }`
  - Node: `ContainerNode { style?: LayoutStyle; children }`, `TextNode { content: Segment[]; style?: BoxStyle & TextStyle }`, `BarcodeNode { content; symbology; readable?; barHeight?: Length; style? }`, `QrCodeNode { content; errorCorrection?; moduleSize?: Length; style? }`, `ImageNode { source: ImageNodeSource; style? }` với `ImageNodeSource = { asset } | { var }`, `LineNode { thickness?: Length; pattern?: LinePattern; style? }`, `RepeatNode { collection; expand?; maxItemsPerPage?; template }` — mọi node có `id`, `visibleWhen?: Condition`
  - `TemplateNodeType`, `LinePattern = 'solid' | 'dashed'`, `DEFAULT_FONT_SIZE: Length = 12px`
  - `TemplateIssue { path; message }`, `ParseResult`, `parseTemplate(json: unknown): ParseResult`, `validateTemplateStructure(document: unknown): readonly TemplateIssue[]`
  - `TemplateMigration`, `TemplateMigrations`, `TEMPLATE_MIGRATIONS`, `MigrationResult`, `migrateTemplate(json, migrations = TEMPLATE_MIGRATIONS, targetVersion = TEMPLATE_SCHEMA_VERSION)`

- [ ] **Step 1: Xoá model cũ**

```bash
git rm -r packages/printer-core/src/template/PrintTemplate.ts packages/printer-core/src/template/PrintTemplateType.ts packages/printer-core/src/template/style/VisibilityCondition.ts packages/printer-core/src/template/__tests__ packages/printer-core/src/template/style/__tests__ packages/printer-core/src/template/nodes/__tests__ packages/printer-core/src/template/builder
```

- [ ] **Step 2: Viết test parse/migrate**

`packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts`:

```ts
import { parseTemplate } from '..';

function validLabelJson(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: 'product-label-default',
    name: 'Tem món mặc định',
    catalog: 'test-order',
    media: 'label',
    locale: 'vi-VN',
    paper: { widthMm: 50, heightMm: 30 },
    root: {
      type: 'container',
      id: 'root',
      style: { direction: 'column', gap: { value: 1, unit: 'mm' }, padding: uniformInsets(2) },
      children: [
        {
          type: 'text',
          id: 'title',
          content: [{ text: 'Bàn ' }, { var: 'tableName', format: { type: 'text', transform: 'upper' } }],
          style: { fontSize: { value: 16, unit: 'px' }, fontWeight: 'bold', lineHeight: 1.2 },
          visibleWhen: { op: 'exists', var: 'tableName' },
        },
        { type: 'line', id: 'divider', pattern: 'dashed', thickness: { value: 0.3, unit: 'mm' } },
        { type: 'image', id: 'logo', source: { var: 'storeLogo' } },
        { type: 'barcode', id: 'code', content: [{ var: 'orderCode' }], symbology: 'code128', readable: true },
        {
          type: 'repeat',
          id: 'items',
          collection: 'items',
          expand: 'quantity',
          maxItemsPerPage: 1,
          template: { type: 'qrcode', id: 'qr', content: [{ var: 'itemName' }], errorCorrection: 'M' },
        },
      ],
    },
  };
}

function uniformInsets(valueMm: number): Record<string, unknown> {
  const side = { value: valueMm, unit: 'mm' };
  return { top: side, right: side, bottom: side, left: side };
}

function withRoot(root: unknown): Record<string, unknown> {
  return { ...validLabelJson(), root };
}

function issuePaths(json: unknown): readonly string[] {
  const result = parseTemplate(json);
  return result.ok ? [] : result.issues.map((issue) => issue.path);
}

describe('parseTemplate', () => {
  it('chấp nhận template hợp lệ và trả đúng object', () => {
    const json = validLabelJson();
    const result = parseTemplate(json);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.template).toEqual(json);
  });

  it('báo lỗi khi input không phải object', () => {
    const result = parseTemplate('not a template');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toEqual([{ path: '', message: 'template phải là object JSON' }]);
  });

  it('báo lỗi rõ ràng khi schemaVersion cao hơn app đang chạy', () => {
    const result = parseTemplate({ ...validLabelJson(), schemaVersion: 2 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].message).toContain('phiên bản app mới hơn');
  });

  it('báo lỗi đơn vị độ dài sai kèm path chính xác', () => {
    const json = withRoot({
      type: 'container',
      id: 'root',
      style: { padding: { ...uniformInsets(2), top: { value: 2, unit: 'cm' } } },
      children: [],
    });

    expect(issuePaths(json)).toEqual(['root.style.padding.top.unit']);
  });

  it('báo lỗi độ dài âm', () => {
    const json = withRoot({ type: 'line', id: 'line', thickness: { value: -1, unit: 'mm' } });

    expect(issuePaths(json)).toEqual(['root.thickness.value']);
  });

  it('báo lỗi loại node lạ thay vì bỏ qua', () => {
    const json = withRoot({ type: 'container', id: 'root', children: [{ type: 'table', id: 't' }] });

    expect(issuePaths(json)).toEqual(['root.children[0].type']);
  });

  it('báo lỗi id node trùng', () => {
    const json = withRoot({
      type: 'container',
      id: 'root',
      children: [
        { type: 'text', id: 'same', content: [] },
        { type: 'text', id: 'same', content: [] },
      ],
    });

    expect(issuePaths(json)).toEqual(['root.children[1].id']);
  });

  it('bắt buộc chiều cao với label và cấm chiều cao với receipt', () => {
    expect(issuePaths({ ...validLabelJson(), paper: { widthMm: 50 } })).toEqual(['paper.heightMm']);
    expect(issuePaths({ ...validLabelJson(), media: 'receipt' })).toEqual(['paper.heightMm']);
  });

  it('báo lỗi segment không có text lẫn var, và format sai loại', () => {
    const json = withRoot({
      type: 'text',
      id: 'text',
      content: [{}, { var: 'orderCode', format: { type: 'percent' } }],
    });

    expect(issuePaths(json)).toEqual(['root.content[0]', 'root.content[1].format.type']);
  });

  it('báo lỗi điều kiện sai dạng, kể cả điều kiện lồng', () => {
    const json = withRoot({
      type: 'text',
      id: 'text',
      content: [],
      visibleWhen: { op: 'and', conditions: [{ op: 'gt', var: 'discount', value: null }, { op: 'between' }] },
    });

    expect(issuePaths(json)).toEqual([
      'root.visibleWhen.conditions[0].value',
      'root.visibleWhen.conditions[1].op',
    ]);
  });

  it('báo lỗi ảnh khai báo cả asset lẫn var', () => {
    const json = withRoot({ type: 'image', id: 'logo', source: { asset: 'logo@v1', var: 'storeLogo' } });

    expect(issuePaths(json)).toEqual(['root.source']);
  });

  it('báo lỗi repeat thiếu collection và maxItemsPerPage không phải số nguyên dương', () => {
    const json = withRoot({
      type: 'repeat',
      id: 'items',
      maxItemsPerPage: 0,
      template: { type: 'text', id: 'name', content: [] },
    });

    expect(issuePaths(json)).toEqual(['root.collection', 'root.maxItemsPerPage']);
  });
});
```

`packages/printer-core/src/template/parse/__tests__/migrateTemplate.test.ts`:

```ts
import { migrateTemplate, type TemplateMigrations } from '..';

describe('migrateTemplate', () => {
  it('không đổi document đã ở schema đích', () => {
    const document = { schemaVersion: 1, id: 'x' };

    expect(migrateTemplate(document)).toEqual({ ok: true, document });
  });

  it('chạy lần lượt từng migration theo thứ tự schema', () => {
    const calls: number[] = [];
    const migrations: TemplateMigrations = {
      1: (document) => {
        calls.push(1);
        return { ...document, schemaVersion: 2, renamed: document.old };
      },
      2: (document) => {
        calls.push(2);
        return { ...document, schemaVersion: 3, upper: String(document.renamed).toUpperCase() };
      },
    };

    const result = migrateTemplate({ schemaVersion: 1, old: 'abc' }, migrations, 3);

    expect(calls).toEqual([1, 2]);
    expect(result).toEqual({
      ok: true,
      document: { schemaVersion: 3, old: 'abc', renamed: 'abc', upper: 'ABC' },
    });
  });

  it('báo lỗi khi thiếu migration cho 1 bước', () => {
    const result = migrateTemplate({ schemaVersion: 1 }, {}, 2);

    expect(result).toEqual({ ok: false, issues: [{ path: 'schemaVersion', message: 'thiếu migration từ schema 1' }] });
  });

  it('báo lỗi khi migration quên cập nhật schemaVersion', () => {
    const migrations: TemplateMigrations = { 1: (document) => ({ ...document }) };

    const result = migrateTemplate({ schemaVersion: 1 }, migrations, 2);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].message).toContain('không cập nhật schemaVersion');
  });

  it('báo lỗi schemaVersion không phải số nguyên dương', () => {
    expect(migrateTemplate({ schemaVersion: '1' }).ok).toBe(false);
    expect(migrateTemplate({ schemaVersion: 0 }).ok).toBe(false);
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `npx jest packages/printer-core/src/template/parse`
Expected: FAIL — `Cannot find module '..'`.

- [ ] **Step 4: Viết style + node + TemplateDocument (ghi đè toàn bộ file cũ)**

`packages/printer-core/src/template/style/Dimension.ts`:

```ts
import type { Length } from './Length';

/** Kích thước cố định đúng bằng `value`. */
export interface FixedDimension {
  readonly type: 'fixed';

  /** Kích thước cố định. */
  readonly value: Length;
}

/** Chiếm hết phần còn trống của container cha. */
export interface FillDimension {
  readonly type: 'fill';
}

/** Co theo nội dung. */
export interface AutoDimension {
  readonly type: 'auto';
}

/** Cách xác định chiều rộng/cao của 1 node. */
export type Dimension = FixedDimension | FillDimension | AutoDimension;
```

`packages/printer-core/src/template/style/Insets.ts`:

```ts
import type { Length } from './Length';

/** Khoảng cách 4 cạnh, dùng cho `margin`/`padding`. */
export interface Insets {
  readonly top: Length;

  readonly right: Length;

  readonly bottom: Length;

  readonly left: Length;
}
```

`packages/printer-core/src/template/style/BoxStyle.ts`:

```ts
import type { Dimension } from './Dimension';
import type { Insets } from './Insets';

/** Style hộp dùng chung cho mọi node. */
export interface BoxStyle {
  /** Chiều rộng; bỏ trống là `auto`. Với `LineNode`, `fixed` quyết định độ dài nét. */
  readonly width?: Dimension;

  /** Chiều cao; bỏ trống là `auto`. */
  readonly height?: Dimension;

  /** Khoảng cách bên ngoài hộp. */
  readonly margin?: Insets;

  /** Khoảng cách bên trong hộp, giữa viền và nội dung. */
  readonly padding?: Insets;
}
```

`packages/printer-core/src/template/style/LayoutStyle.ts`:

```ts
import type { BoxStyle } from './BoxStyle';
import type { Length } from './Length';

/** Style của container: hướng xếp và khoảng cách giữa các node con. */
export interface LayoutStyle extends BoxStyle {
  /** Hướng xếp node con; mặc định `column`. */
  readonly direction?: 'row' | 'column';

  /** Khoảng cách giữa 2 node con liền kề; mặc định 0. */
  readonly gap?: Length;

  /** Phân bố node con theo trục chính; mặc định `start`. */
  readonly justifyContent?: 'start' | 'center' | 'end' | 'space-between';

  /** Căn node con theo trục phụ; mặc định `start`. */
  readonly alignItems?: 'start' | 'center' | 'end';
}
```

`packages/printer-core/src/template/style/TextStyle.ts`:

```ts
import type { Length } from './Length';

/** Cỡ chữ mặc định khi `TextStyle.fontSize` bỏ trống. */
export const DEFAULT_FONT_SIZE: Length = { value: 12, unit: 'px' };

/** Style chữ của `TextNode`. */
export interface TextStyle {
  /** Cỡ chữ (chiều cao glyph danh nghĩa); mặc định `DEFAULT_FONT_SIZE`. */
  readonly fontSize?: Length;

  /** Độ đậm; mặc định `normal`. */
  readonly fontWeight?: 'normal' | 'bold';

  /** Hệ số chiều cao dòng so với cỡ chữ, không đơn vị (VD 1.2), giống CSS; mặc định 1.2. */
  readonly lineHeight?: number;

  /** Căn lề ngang; mặc định `left`. */
  readonly textAlign?: 'left' | 'center' | 'right';
}
```

`packages/printer-core/src/template/nodes/TemplateNodeBase.ts`:

```ts
import type { Condition } from '../content/Condition';

/** Field chung của mọi node. */
export interface TemplateNodeBase {
  /** Mã node, duy nhất trong template; dùng để báo lỗi đúng chỗ. */
  readonly id: string;

  /** Điều kiện hiển thị; bỏ trống là luôn hiện. */
  readonly visibleWhen?: Condition;
}
```

`packages/printer-core/src/template/nodes/ContainerNode.ts`:

```ts
import type { LayoutStyle } from '../style/LayoutStyle';
import type { TemplateNode } from './TemplateNode';
import type { TemplateNodeBase } from './TemplateNodeBase';

/** Hộp chứa, xếp các node con theo hàng hoặc cột. */
export interface ContainerNode extends TemplateNodeBase {
  readonly type: 'container';

  readonly style?: LayoutStyle;

  /** Các node con, xếp theo thứ tự khai báo. */
  readonly children: readonly TemplateNode[];
}
```

`packages/printer-core/src/template/nodes/TextNode.ts`:

```ts
import type { Segment } from '../content/Segment';
import type { BoxStyle } from '../style/BoxStyle';
import type { TextStyle } from '../style/TextStyle';
import type { TemplateNodeBase } from './TemplateNodeBase';

/** Đoạn chữ, tự xuống dòng theo chiều rộng còn trống. */
export interface TextNode extends TemplateNodeBase {
  readonly type: 'text';

  /** Nội dung: các segment ghép liền nhau thành 1 chuỗi. */
  readonly content: readonly Segment[];

  readonly style?: BoxStyle & TextStyle;
}
```

`packages/printer-core/src/template/nodes/BarcodeNode.ts`:

```ts
import type { BarcodeSymbology } from '../../symbology';
import type { Segment } from '../content/Segment';
import type { BoxStyle } from '../style/BoxStyle';
import type { Length } from '../style/Length';
import type { TemplateNodeBase } from './TemplateNodeBase';

/** Mã vạch 1D. */
export interface BarcodeNode extends TemplateNodeBase {
  readonly type: 'barcode';

  /** Dữ liệu mã hoá: các segment ghép liền nhau. */
  readonly content: readonly Segment[];

  /** Loại mã vạch, VD `code128`. */
  readonly symbology: BarcodeSymbology;

  /** In kèm chữ đọc được bên dưới vạch; mặc định theo máy in. */
  readonly readable?: boolean;

  /** Chiều cao vạch; mặc định theo máy in. */
  readonly barHeight?: Length;

  readonly style?: BoxStyle;
}
```

`packages/printer-core/src/template/nodes/QrCodeNode.ts`:

```ts
import type { QrErrorCorrectionLevel } from '../../symbology';
import type { Segment } from '../content/Segment';
import type { BoxStyle } from '../style/BoxStyle';
import type { Length } from '../style/Length';
import type { TemplateNodeBase } from './TemplateNodeBase';

/** Mã QR. */
export interface QrCodeNode extends TemplateNodeBase {
  readonly type: 'qrcode';

  /** Dữ liệu mã hoá: các segment ghép liền nhau. */
  readonly content: readonly Segment[];

  /** Mức sửa lỗi; mặc định theo máy in. */
  readonly errorCorrection?: QrErrorCorrectionLevel;

  /** Cạnh 1 module (ô vuông) của QR; mặc định theo máy in. */
  readonly moduleSize?: Length;

  readonly style?: BoxStyle;
}
```

`packages/printer-core/src/template/nodes/ImageNode.ts`:

```ts
import type { BoxStyle } from '../style/BoxStyle';
import type { TemplateNodeBase } from './TemplateNodeBase';

/** Ảnh tĩnh thuộc thiết kế template (icon, hoa văn), tham chiếu bằng mã asset có version. */
export interface StaticImageSource {
  /** Mã asset, VD `icon-cup@v2`. */
  readonly asset: string;
}

/** Ảnh lấy từ 1 biến kiểu `asset` của catalog (VD logo cửa hàng). */
export interface VariableImageSource {
  /** Tên biến kiểu `asset`. */
  readonly var: string;
}

/** Nguồn ảnh: chỉ lưu mã asset, không lưu dữ liệu ảnh. */
export type ImageNodeSource = StaticImageSource | VariableImageSource;

/** Ảnh bitmap, tra qua `AssetProvider` lúc resolve. */
export interface ImageNode extends TemplateNodeBase {
  readonly type: 'image';

  readonly source: ImageNodeSource;

  readonly style?: BoxStyle;
}
```

`packages/printer-core/src/template/nodes/LineNode.ts`:

```ts
import type { BoxStyle } from '../style/BoxStyle';
import type { Length } from '../style/Length';
import type { TemplateNodeBase } from './TemplateNodeBase';

/** Kiểu nét kẻ. */
export type LinePattern = 'solid' | 'dashed';

/** Đường kẻ ngang; dài hết chiều rộng còn trống, trừ khi `style.width` là `fixed`. */
export interface LineNode extends TemplateNodeBase {
  readonly type: 'line';

  /** Độ dày nét; mặc định theo máy in (thường 1 dot). */
  readonly thickness?: Length;

  /** Kiểu nét; mặc định `solid`. */
  readonly pattern?: LinePattern;

  readonly style?: BoxStyle;
}
```

`packages/printer-core/src/template/nodes/RepeatNode.ts`:

```ts
import type { TemplateNode } from './TemplateNode';
import type { TemplateNodeBase } from './TemplateNodeBase';

/** Lặp `template` cho từng phần tử của 1 collection trong catalog. */
export interface RepeatNode extends TemplateNodeBase {
  readonly type: 'repeat';

  /** Tên collection trong catalog, VD `items`. */
  readonly collection: string;

  /** Tên biến kiểu `number` của collection: nhân mỗi phần tử thành đúng số bản sao đó (VD mỗi ly 1 tem). */
  readonly expand?: string;

  /** Số phần tử tối đa mỗi trang (tính sau khi expand); bỏ trống là không phân trang. */
  readonly maxItemsPerPage?: number;

  /** Node được lặp cho từng phần tử. */
  readonly template: TemplateNode;
}
```

`packages/printer-core/src/template/nodes/TemplateNode.ts`:

```ts
import type { BarcodeNode } from './BarcodeNode';
import type { ContainerNode } from './ContainerNode';
import type { ImageNode } from './ImageNode';
import type { LineNode } from './LineNode';
import type { QrCodeNode } from './QrCodeNode';
import type { RepeatNode } from './RepeatNode';
import type { TextNode } from './TextNode';

/** Mọi loại node của template, phân biệt theo `type`. */
export type TemplateNode = ContainerNode | TextNode | LineNode | BarcodeNode | QrCodeNode | ImageNode | RepeatNode;

/** Tên các loại node. */
export type TemplateNodeType = TemplateNode['type'];
```

`packages/printer-core/src/template/TemplateDocument.ts`:

```ts
import type { TemplateNode } from './nodes/TemplateNode';

/** Phiên bản schema hiện tại của `TemplateDocument`; tăng khi đổi cấu trúc JSON (kèm 1 migration). */
export const TEMPLATE_SCHEMA_VERSION = 1;

/** Loại giấy: `label` có chiều cao cố định và phân trang, `receipt` là giấy cuộn. */
export type TemplateMedia = 'label' | 'receipt';

/** Locale quyết định dấu phân cách số; hiện chỉ hỗ trợ tiếng Việt. */
export type TemplateLocale = 'vi-VN';

/** Khổ giấy, tính bằng mm. */
export interface PaperSize {
  /** Chiều rộng vùng in, mm. */
  readonly widthMm: number;

  /** Chiều cao 1 tem, mm; chỉ có ở `label`. */
  readonly heightMm?: number;
}

/** Template in dạng JSON thuần: chỉ chứa cấu trúc + placeholder, không chứa data, ảnh hay hàm. */
export interface TemplateDocument {
  /** Phiên bản schema, dùng để migrate khi đọc template cũ. */
  readonly schemaVersion: typeof TEMPLATE_SCHEMA_VERSION;

  /** Mã template do người tạo đặt hoặc BE cấp. */
  readonly id: string;

  /** Tên hiển thị, VD 'Tem món mặc định'. */
  readonly name: string;

  /** Mã catalog mà template dùng biến, VD 'product-label'. */
  readonly catalog: string;

  readonly media: TemplateMedia;

  readonly locale: TemplateLocale;

  readonly paper: PaperSize;

  /** Node gốc. */
  readonly root: TemplateNode;
}
```

- [ ] **Step 5: Viết parse/validate/migrate**

`packages/printer-core/src/template/parse/TemplateIssue.ts`:

```ts
import type { TemplateDocument } from '../TemplateDocument';

/** 1 lỗi (hoặc cảnh báo) trong template, kèm vị trí. */
export interface TemplateIssue {
  /** Đường dẫn JSON tới chỗ lỗi, VD `root.children[2].style.padding.top`; rỗng là cả document. */
  readonly path: string;

  /** Mô tả lỗi bằng tiếng Việt, hiển thị được cho người dùng. */
  readonly message: string;
}

/** Kết quả `parseTemplate`: template đã migrate + hợp lệ, hoặc danh sách lỗi. */
export type ParseResult =
  | { readonly ok: true; readonly template: TemplateDocument }
  | { readonly ok: false; readonly issues: readonly TemplateIssue[] };
```

`packages/printer-core/src/template/parse/JsonCursor.ts`:

```ts
import type { TemplateIssue } from './TemplateIssue';

/** Object JSON đã kiểm tra là object (không phải mảng, không phải null). */
export type JsonObject = Readonly<Record<string, unknown>>;

/** Kiểm tra giá trị là object JSON thường. */
export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Con trỏ tới 1 giá trị trong JSON đang validate: biết đường dẫn của mình và ghi lỗi vào danh sách chung.
 * Nhờ vậy mỗi hàm validate chỉ cần 1 tham số.
 */
export class JsonCursor {
  private constructor(
    readonly value: unknown,
    readonly path: string,
    private readonly issues: TemplateIssue[],
  ) {}

  /** Tạo con trỏ gốc; mọi lỗi ghi vào `issues`. */
  static root(value: unknown, issues: TemplateIssue[]): JsonCursor {
    return new JsonCursor(value, '', issues);
  }

  /** Con trỏ tới field `key` (giá trị `undefined` nếu không có). */
  field(key: string): JsonCursor {
    const fieldValue = isJsonObject(this.value) ? this.value[key] : undefined;
    const fieldPath = this.path === '' ? key : `${this.path}.${key}`;
    return new JsonCursor(fieldValue, fieldPath, this.issues);
  }

  /** Field `key` có giá trị (khác `undefined`) hay không. */
  has(key: string): boolean {
    return isJsonObject(this.value) && this.value[key] !== undefined;
  }

  /** Ghi 1 lỗi tại vị trí hiện tại. */
  report(message: string): void {
    this.issues.push({ path: this.path, message });
  }

  /** Trả object nếu đúng kiểu, ngược lại ghi lỗi và trả `undefined`. */
  expectObject(): JsonObject | undefined {
    if (isJsonObject(this.value)) return this.value;
    this.report('phải là object');
    return undefined;
  }

  /** Trả con trỏ của từng phần tử nếu là mảng, ngược lại ghi lỗi và trả mảng rỗng. */
  expectItems(): readonly JsonCursor[] {
    if (!Array.isArray(this.value)) {
      this.report('phải là mảng');
      return [];
    }
    return this.value.map((item, index) => new JsonCursor(item, `${this.path}[${index}]`, this.issues));
  }

  /** Ghi lỗi nếu không phải chuỗi khác rỗng. */
  expectNonEmptyString(): void {
    if (typeof this.value !== 'string' || this.value === '') this.report('phải là chuỗi khác rỗng');
  }

  /** Trả `true` nếu giá trị nằm trong danh sách cho phép, ngược lại ghi lỗi (kể cả khi bỏ trống). */
  expectOneOf(allowed: readonly string[]): boolean {
    if (typeof this.value === 'string' && allowed.includes(this.value)) return true;
    this.report(`phải là 1 trong: ${allowed.map((value) => `"${value}"`).join(', ')}`);
    return false;
  }

  /** Như `expectOneOf` nhưng cho phép bỏ trống. */
  expectOptionalOneOf(allowed: readonly string[]): void {
    if (this.value !== undefined) this.expectOneOf(allowed);
  }

  /** Ghi lỗi nếu có giá trị nhưng không phải số nguyên trong khoảng [min, max]. */
  expectOptionalInteger(min: number, max: number): void {
    const value = this.value;
    if (value === undefined) return;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      this.report(`phải là số nguyên từ ${min} đến ${max}`);
    }
  }
}
```

`packages/printer-core/src/template/parse/validateStyle.ts`:

```ts
import type { JsonCursor } from './JsonCursor';

const LENGTH_UNITS: readonly string[] = ['mm', 'pt', 'px'];
const DIMENSION_TYPES: readonly string[] = ['fixed', 'fill', 'auto'];
const INSET_SIDES: readonly string[] = ['top', 'right', 'bottom', 'left'];
const DIRECTIONS: readonly string[] = ['row', 'column'];
const JUSTIFY_CONTENT_VALUES: readonly string[] = ['start', 'center', 'end', 'space-between'];
const ALIGN_ITEMS_VALUES: readonly string[] = ['start', 'center', 'end'];
const FONT_WEIGHTS: readonly string[] = ['normal', 'bold'];
const TEXT_ALIGNS: readonly string[] = ['left', 'center', 'right'];

/** Kiểm tra `Length`: `value` là số hữu hạn không âm, `unit` là mm/pt/px. */
export function validateLength(cursor: JsonCursor): void {
  if (!cursor.expectObject()) return;

  const value = cursor.field('value').value;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    cursor.field('value').report('phải là số không âm');
  }
  cursor.field('unit').expectOneOf(LENGTH_UNITS);
}

/** Kiểm tra field `Length` tuỳ chọn. */
export function validateOptionalLength(cursor: JsonCursor): void {
  if (cursor.value !== undefined) validateLength(cursor);
}

/** Kiểm tra `BoxStyle` (dùng cho node không có style riêng). */
export function validateBoxStyle(cursor: JsonCursor): void {
  if (cursor.value === undefined || !cursor.expectObject()) return;
  validateBoxFields(cursor);
}

/** Kiểm tra `LayoutStyle` của container. */
export function validateLayoutStyle(cursor: JsonCursor): void {
  if (cursor.value === undefined || !cursor.expectObject()) return;

  validateBoxFields(cursor);
  cursor.field('direction').expectOptionalOneOf(DIRECTIONS);
  validateOptionalLength(cursor.field('gap'));
  cursor.field('justifyContent').expectOptionalOneOf(JUSTIFY_CONTENT_VALUES);
  cursor.field('alignItems').expectOptionalOneOf(ALIGN_ITEMS_VALUES);
}

/** Kiểm tra `BoxStyle & TextStyle` của text. */
export function validateTextStyle(cursor: JsonCursor): void {
  if (cursor.value === undefined || !cursor.expectObject()) return;

  validateBoxFields(cursor);
  validateOptionalLength(cursor.field('fontSize'));
  cursor.field('fontWeight').expectOptionalOneOf(FONT_WEIGHTS);
  cursor.field('textAlign').expectOptionalOneOf(TEXT_ALIGNS);

  const lineHeight = cursor.field('lineHeight').value;
  if (lineHeight !== undefined && (typeof lineHeight !== 'number' || !(lineHeight > 0))) {
    cursor.field('lineHeight').report('phải là hệ số dương, VD 1.2');
  }
}

function validateBoxFields(cursor: JsonCursor): void {
  validateOptionalDimension(cursor.field('width'));
  validateOptionalDimension(cursor.field('height'));
  validateOptionalInsets(cursor.field('margin'));
  validateOptionalInsets(cursor.field('padding'));
}

function validateOptionalDimension(cursor: JsonCursor): void {
  if (cursor.value === undefined || !cursor.expectObject()) return;

  cursor.field('type').expectOneOf(DIMENSION_TYPES);
  if (cursor.field('type').value === 'fixed') validateLength(cursor.field('value'));
}

function validateOptionalInsets(cursor: JsonCursor): void {
  if (cursor.value === undefined || !cursor.expectObject()) return;

  for (const side of INSET_SIDES) validateLength(cursor.field(side));
}
```

`packages/printer-core/src/template/parse/validateContent.ts`:

```ts
import type { JsonCursor } from './JsonCursor';

/** Số chữ số thập phân tối đa cho format số/tiền. */
const MAX_FORMAT_DECIMALS = 6;

/** Giới hạn trên của `TextFormat.maxLength` — chỉ để chặn giá trị vô lý. */
const MAX_TEXT_LENGTH = 1000;

const FORMAT_TYPES: readonly string[] = ['number', 'currency', 'datetime', 'text'];
const CURRENCY_SYMBOLS: readonly string[] = ['đ', '₫', 'VND', ''];
const TEXT_TRANSFORMS: readonly string[] = ['upper', 'lower'];
const PRESENCE_OPERATORS: readonly string[] = ['exists', 'notEmpty'];
const COMPARISON_OPERATORS: readonly string[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'];
const GROUP_OPERATORS: readonly string[] = ['and', 'or'];

/** Kiểm tra mảng `Segment` (nội dung text/barcode/QR). */
export function validateSegments(cursor: JsonCursor): void {
  for (const segment of cursor.expectItems()) validateSegment(segment);
}

/** Kiểm tra `Condition` (đệ quy qua `and`/`or`/`not`). */
export function validateCondition(cursor: JsonCursor): void {
  if (!cursor.expectObject()) return;

  const operator = cursor.field('op').value;
  if (typeof operator === 'string' && PRESENCE_OPERATORS.includes(operator)) {
    cursor.field('var').expectNonEmptyString();
    return;
  }
  if (typeof operator === 'string' && COMPARISON_OPERATORS.includes(operator)) {
    validateComparison(cursor);
    return;
  }
  if (typeof operator === 'string' && GROUP_OPERATORS.includes(operator)) {
    validateGroup(cursor);
    return;
  }
  if (operator === 'not') {
    validateCondition(cursor.field('condition'));
    return;
  }
  cursor.field('op').report(`điều kiện "${String(operator)}" không hợp lệ`);
}

function validateSegment(cursor: JsonCursor): void {
  if (!cursor.expectObject()) return;

  if (cursor.has('text')) {
    if (typeof cursor.field('text').value !== 'string') cursor.field('text').report('phải là chuỗi');
    return;
  }
  if (!cursor.has('var')) {
    cursor.report('segment phải có "text" hoặc "var"');
    return;
  }
  cursor.field('var').expectNonEmptyString();
  if (cursor.has('format')) validateValueFormat(cursor.field('format'));
}

function validateValueFormat(cursor: JsonCursor): void {
  if (!cursor.expectObject()) return;

  const type = cursor.field('type');
  if (!type.expectOneOf(FORMAT_TYPES)) return;

  cursor.field('decimals').expectOptionalInteger(0, MAX_FORMAT_DECIMALS);
  if (type.value === 'currency') cursor.field('symbol').expectOptionalOneOf(CURRENCY_SYMBOLS);
  if (type.value === 'datetime') cursor.field('pattern').expectNonEmptyString();
  if (type.value === 'text') validateTextFormat(cursor);
}

function validateTextFormat(cursor: JsonCursor): void {
  cursor.field('transform').expectOptionalOneOf(TEXT_TRANSFORMS);
  cursor.field('maxLength').expectOptionalInteger(1, MAX_TEXT_LENGTH);
}

function validateComparison(cursor: JsonCursor): void {
  cursor.field('var').expectNonEmptyString();

  const valueType = typeof cursor.field('value').value;
  if (valueType !== 'string' && valueType !== 'number' && valueType !== 'boolean') {
    cursor.field('value').report('phải là chuỗi, số hoặc boolean');
  }
}

function validateGroup(cursor: JsonCursor): void {
  const conditions = cursor.field('conditions').expectItems();
  if (conditions.length === 0) cursor.field('conditions').report('phải có ít nhất 1 điều kiện');
  for (const condition of conditions) validateCondition(condition);
}
```

`packages/printer-core/src/template/parse/validateNode.ts`:

```ts
import type { BarcodeSymbology, QrErrorCorrectionLevel } from '../../symbology';
import type { TemplateNodeType } from '../nodes/TemplateNode';
import type { JsonCursor } from './JsonCursor';
import { validateCondition, validateSegments } from './validateContent';
import { validateBoxStyle, validateLayoutStyle, validateOptionalLength, validateTextStyle } from './validateStyle';

/** Số phần tử tối đa mỗi trang — chỉ để chặn giá trị vô lý. */
const MAX_ITEMS_PER_PAGE = 1000;

// Record thay cho mảng để TypeScript báo lỗi khi union thêm giá trị mà danh sách này quên cập nhật.
const BARCODE_SYMBOLOGIES: Readonly<Record<BarcodeSymbology, true>> = {
  code39: true,
  code93: true,
  code128: true,
  ean8: true,
  ean13: true,
  upca: true,
  upce: true,
  itf: true,
  codabar: true,
};

const QR_ERROR_CORRECTION_LEVELS: Readonly<Record<QrErrorCorrectionLevel, true>> = {
  L: true,
  M: true,
  Q: true,
  H: true,
};

const LINE_PATTERNS: readonly string[] = ['solid', 'dashed'];

type NodeValidator = (cursor: JsonCursor, seenIds: Set<string>) => void;

const NODE_VALIDATORS: Readonly<Record<TemplateNodeType, NodeValidator>> = {
  container: validateContainer,
  text: validateText,
  line: validateLine,
  barcode: validateBarcode,
  qrcode: validateQrCode,
  image: validateImage,
  repeat: validateRepeat,
};

/** Kiểm tra 1 node và toàn bộ node con; `seenIds` dùng chung để phát hiện `id` trùng. */
export function validateNode(cursor: JsonCursor, seenIds: Set<string>): void {
  if (!cursor.expectObject()) return;

  validateNodeId(cursor.field('id'), seenIds);
  if (cursor.has('visibleWhen')) validateCondition(cursor.field('visibleWhen'));

  const type = cursor.field('type').value;
  const validator = typeof type === 'string' ? findNodeValidator(type) : undefined;
  if (!validator) {
    cursor.field('type').report(`loại node "${String(type)}" không hợp lệ`);
    return;
  }
  validator(cursor, seenIds);
}

function findNodeValidator(type: string): NodeValidator | undefined {
  if (!Object.prototype.hasOwnProperty.call(NODE_VALIDATORS, type)) return undefined;
  return NODE_VALIDATORS[type as TemplateNodeType];
}

function validateNodeId(cursor: JsonCursor, seenIds: Set<string>): void {
  if (typeof cursor.value !== 'string' || cursor.value === '') {
    cursor.report('phải là chuỗi khác rỗng');
    return;
  }
  if (seenIds.has(cursor.value)) cursor.report(`id "${cursor.value}" bị trùng`);
  seenIds.add(cursor.value);
}

function validateContainer(cursor: JsonCursor, seenIds: Set<string>): void {
  validateLayoutStyle(cursor.field('style'));
  for (const child of cursor.field('children').expectItems()) validateNode(child, seenIds);
}

function validateText(cursor: JsonCursor): void {
  validateSegments(cursor.field('content'));
  validateTextStyle(cursor.field('style'));
}

function validateLine(cursor: JsonCursor): void {
  validateOptionalLength(cursor.field('thickness'));
  cursor.field('pattern').expectOptionalOneOf(LINE_PATTERNS);
  validateBoxStyle(cursor.field('style'));
}

function validateBarcode(cursor: JsonCursor): void {
  validateSegments(cursor.field('content'));
  cursor.field('symbology').expectOneOf(Object.keys(BARCODE_SYMBOLOGIES));
  validateOptionalLength(cursor.field('barHeight'));
  validateBoxStyle(cursor.field('style'));

  const readable = cursor.field('readable').value;
  if (readable !== undefined && typeof readable !== 'boolean') cursor.field('readable').report('phải là boolean');
}

function validateQrCode(cursor: JsonCursor): void {
  validateSegments(cursor.field('content'));
  cursor.field('errorCorrection').expectOptionalOneOf(Object.keys(QR_ERROR_CORRECTION_LEVELS));
  validateOptionalLength(cursor.field('moduleSize'));
  validateBoxStyle(cursor.field('style'));
}

function validateImage(cursor: JsonCursor): void {
  validateBoxStyle(cursor.field('style'));

  const source = cursor.field('source');
  if (!source.expectObject()) return;
  if (source.has('asset') === source.has('var')) {
    source.report('phải có đúng 1 trong 2 field "asset" hoặc "var"');
    return;
  }
  source.field(source.has('asset') ? 'asset' : 'var').expectNonEmptyString();
}

function validateRepeat(cursor: JsonCursor, seenIds: Set<string>): void {
  cursor.field('collection').expectNonEmptyString();
  if (cursor.has('expand')) cursor.field('expand').expectNonEmptyString();
  cursor.field('maxItemsPerPage').expectOptionalInteger(1, MAX_ITEMS_PER_PAGE);
  validateNode(cursor.field('template'), seenIds);
}
```

`packages/printer-core/src/template/parse/validateTemplateStructure.ts`:

```ts
import { TEMPLATE_SCHEMA_VERSION } from '../TemplateDocument';
import { JsonCursor } from './JsonCursor';
import type { TemplateIssue } from './TemplateIssue';
import { validateNode } from './validateNode';

const MEDIA_TYPES: readonly string[] = ['label', 'receipt'];
const LOCALES: readonly string[] = ['vi-VN'];

/** Kiểm tra cấu trúc 1 document đã ở schema hiện tại; trả danh sách lỗi (rỗng là hợp lệ). */
export function validateTemplateStructure(document: unknown): readonly TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const cursor = JsonCursor.root(document, issues);
  if (!cursor.expectObject()) return issues;

  if (cursor.field('schemaVersion').value !== TEMPLATE_SCHEMA_VERSION) {
    cursor.field('schemaVersion').report(`phải là ${TEMPLATE_SCHEMA_VERSION}`);
  }
  cursor.field('id').expectNonEmptyString();
  cursor.field('name').expectNonEmptyString();
  cursor.field('catalog').expectNonEmptyString();
  cursor.field('locale').expectOneOf(LOCALES);
  validatePaper(cursor);
  validateNode(cursor.field('root'), new Set());

  return issues;
}

function validatePaper(document: JsonCursor): void {
  const media = document.field('media');
  const paper = document.field('paper');
  if (!media.expectOneOf(MEDIA_TYPES) || !paper.expectObject()) return;

  if (!isPositiveNumber(paper.field('widthMm').value)) paper.field('widthMm').report('phải là số dương (mm)');

  const heightMm = paper.field('heightMm');
  if (media.value === 'label' && !isPositiveNumber(heightMm.value)) {
    heightMm.report('tem (label) phải có chiều cao là số dương (mm)');
  }
  if (media.value === 'receipt' && heightMm.value !== undefined) {
    heightMm.report('giấy cuộn (receipt) không có chiều cao cố định');
  }
}

function isPositiveNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
```

`packages/printer-core/src/template/parse/migrateTemplate.ts`:

```ts
import { TEMPLATE_SCHEMA_VERSION } from '../TemplateDocument';
import { isJsonObject, type JsonObject } from './JsonCursor';
import type { TemplateIssue } from './TemplateIssue';

/** 1 bước migrate: nhận document schema `n`, trả document schema `n + 1` (phải tự cập nhật `schemaVersion`). */
export type TemplateMigration = (document: JsonObject) => JsonObject;

/** Bảng migration theo schema nguồn: `migrations[n]` đổi schema `n` thành `n + 1`. */
export type TemplateMigrations = Readonly<Record<number, TemplateMigration>>;

/** Migration của app. Rỗng vì schema hiện tại là bản đầu tiên. */
export const TEMPLATE_MIGRATIONS: TemplateMigrations = {};

/** Kết quả migrate: document ở schema đích, hoặc lỗi. */
export type MigrationResult =
  | { readonly ok: true; readonly document: JsonObject }
  | { readonly ok: false; readonly issues: readonly TemplateIssue[] };

/**
 * Đưa document JSON về schema đích bằng cách chạy lần lượt từng migration.
 * Schema cao hơn đích nghĩa là template tạo bởi app mới hơn — báo lỗi, không đoán.
 */
export function migrateTemplate(
  json: unknown,
  migrations: TemplateMigrations = TEMPLATE_MIGRATIONS,
  targetVersion: number = TEMPLATE_SCHEMA_VERSION,
): MigrationResult {
  if (!isJsonObject(json)) return failure('', 'template phải là object JSON');

  const version = json.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return failure('schemaVersion', 'phải là số nguyên ≥ 1');
  }
  if (version > targetVersion) {
    const message = `template được tạo bởi phiên bản app mới hơn (schema ${version}), cần cập nhật app`;
    return failure('schemaVersion', message);
  }

  let document = json;
  for (let fromVersion = version; fromVersion < targetVersion; fromVersion++) {
    const migration = migrations[fromVersion];
    if (!migration) return failure('schemaVersion', `thiếu migration từ schema ${fromVersion}`);

    document = migration(document);
    if (document.schemaVersion !== fromVersion + 1) {
      return failure('schemaVersion', `migration từ schema ${fromVersion} không cập nhật schemaVersion`);
    }
  }
  return { ok: true, document };
}

function failure(path: string, message: string): MigrationResult {
  return { ok: false, issues: [{ path, message }] };
}
```

`packages/printer-core/src/template/parse/parseTemplate.ts`:

```ts
import type { TemplateDocument } from '../TemplateDocument';
import { migrateTemplate } from './migrateTemplate';
import type { ParseResult } from './TemplateIssue';
import { validateTemplateStructure } from './validateTemplateStructure';

/**
 * Đọc template từ nguồn không có kiểu (BE, file import): migrate về schema hiện tại rồi kiểm tra cấu trúc.
 * Không kiểm tra biến có khớp catalog — việc đó là của `validateTemplateAgainstCatalog`.
 */
export function parseTemplate(json: unknown): ParseResult {
  const migrated = migrateTemplate(json);
  if (!migrated.ok) return migrated;

  const issues = validateTemplateStructure(migrated.document);
  if (issues.length > 0) return { ok: false, issues };

  // Cấu trúc đã được kiểm tra đầy đủ ở trên, nên ép kiểu ở đây là an toàn.
  return { ok: true, template: migrated.document as unknown as TemplateDocument };
}
```

`packages/printer-core/src/template/parse/index.ts` (Task 4 thêm dòng export `validateTemplateAgainstCatalog`):

```ts
export type { TemplateIssue, ParseResult } from './TemplateIssue';
export { parseTemplate } from './parseTemplate';
export { validateTemplateStructure } from './validateTemplateStructure';
export {
  migrateTemplate,
  TEMPLATE_MIGRATIONS,
  type TemplateMigration,
  type TemplateMigrations,
  type MigrationResult,
} from './migrateTemplate';
```

`packages/printer-core/src/template/index.ts` (ghi đè toàn bộ; Task 5 thêm dòng `export * from './builder';`):

```ts
export * from './TemplateDocument';
export * from './style/Length';
export * from './style/Dimension';
export * from './style/Insets';
export * from './style/BoxStyle';
export * from './style/LayoutStyle';
export * from './style/TextStyle';
export * from './content/ValueFormat';
export * from './content/Segment';
export * from './content/Condition';
export * from './nodes/TemplateNodeBase';
export * from './nodes/ContainerNode';
export * from './nodes/TextNode';
export * from './nodes/BarcodeNode';
export * from './nodes/QrCodeNode';
export * from './nodes/ImageNode';
export * from './nodes/LineNode';
export * from './nodes/RepeatNode';
export * from './nodes/TemplateNode';
export * from './format';
export * from './parse';
```

- [ ] **Step 6: Chạy test, xác nhận pass**

Run: `npx jest packages/printer-core/src/template packages/printer-core/src/catalog`
Expected: PASS — gồm `parseTemplate.test.ts` (12 tests), `migrateTemplate.test.ts` (5 tests) và các test Task 1-2.

- [ ] **Step 7: Verify (scoped — cửa sổ đỏ)**

```bash
npx tsc --noEmit -p packages/printer-core/tsconfig.json 2>&1 | grep -E "src/(catalog|template)/"
npx eslint packages/printer-core/src/template
```

Expected: lệnh tsc lọc **không in dòng nào** (lỗi chỉ được phép nằm ở `resolution/`, `layout/`, `src/__tests__/layout-engine-integration.test.ts`); eslint 0 error. Line-length với `packages/printer-core/src/template`.

- [ ] **Step 8: Commit**

```bash
git add packages/printer-core/src/template
git commit -m "refactor: replace print template model with JSON TemplateDocument and parseTemplate

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `validateTemplateAgainstCatalog`

**Files:**
- Create: `packages/printer-core/src/template/parse/validateTemplateAgainstCatalog.ts`
- Test: `packages/printer-core/src/template/parse/__tests__/validateTemplateAgainstCatalog.test.ts`
- Modify: `packages/printer-core/src/template/parse/index.ts`

**Interfaces:**
- Consumes: `CatalogDescription`, `createCatalogIndex`, `BUILT_IN_VARIABLE_SCOPES`, `isBuiltInVariableName` (Task 1); `TemplateDocument`, node types (Task 3); `TEST_ORDER_CATALOG` (Task 1).
- Produces: `validateTemplateAgainstCatalog(template: TemplateDocument, description: CatalogDescription): CatalogValidationResult` với `CatalogValidationResult { errors: readonly TemplateIssue[]; warnings: readonly TemplateIssue[] }`. Message lỗi được Task 5 (DSL) và Task 9 (preview) dựa vào, VD `biến "itemName" chỉ dùng được trong vòng lặp "Danh sách món"`.

- [ ] **Step 1: Viết test**

`packages/printer-core/src/template/parse/__tests__/validateTemplateAgainstCatalog.test.ts`:

```ts
import { validateTemplateAgainstCatalog } from '..';
import { TEST_ORDER_CATALOG } from '../../../testing';
import type { TemplateDocument, TemplateNode } from '../..';

const description = TEST_ORDER_CATALOG.describe();

function documentWithRoot(root: TemplateNode): TemplateDocument {
  return {
    schemaVersion: 1,
    id: 'template',
    name: 'Template',
    catalog: 'test-order',
    media: 'receipt',
    locale: 'vi-VN',
    paper: { widthMm: 72 },
    root,
  };
}

function textOf(variable: string, format?: { readonly type: 'currency' }): TemplateNode {
  return { type: 'text', id: `text-${variable}`, content: [format ? { var: variable, format } : { var: variable }] };
}

function repeatItems(template: TemplateNode, expand?: string): TemplateNode {
  return { type: 'repeat', id: 'items', collection: 'items', ...(expand ? { expand } : {}), template };
}

function errorsOf(root: TemplateNode): readonly string[] {
  return validateTemplateAgainstCatalog(documentWithRoot(root), description).errors.map((issue) => issue.message);
}

describe('validateTemplateAgainstCatalog', () => {
  it('không có lỗi với template dùng đúng biến và scope', () => {
    const root: TemplateNode = {
      type: 'container',
      id: 'root',
      children: [
        textOf('orderCode'),
        textOf('$page'),
        { type: 'image', id: 'logo', source: { var: 'storeLogo' } },
        repeatItems(
          {
            type: 'container',
            id: 'item',
            children: [
              textOf('itemName'),
              textOf('orderCode'),
              textOf('$unit'),
              { type: 'repeat', id: 'toppings', collection: 'toppings', template: textOf('toppingName') },
            ],
          },
          'quantity',
        ),
      ],
    };

    const result = validateTemplateAgainstCatalog(documentWithRoot(root), description);

    expect(result).toEqual({ errors: [], warnings: [] });
  });

  it('báo lỗi khi template dùng catalog khác', () => {
    const result = validateTemplateAgainstCatalog(
      { ...documentWithRoot(textOf('orderCode')), catalog: 'kitchen-ticket' },
      description,
    );

    expect(result.errors).toEqual([
      { path: 'catalog', message: 'template dùng catalog "kitchen-ticket", không phải "test-order"' },
    ]);
  });

  it('báo lỗi biến không có trong catalog', () => {
    expect(errorsOf(textOf('missing'))).toEqual(['catalog "test-order" không có biến "missing"']);
  });

  it('báo lỗi biến của collection dùng ngoài vòng lặp, kèm tên hiển thị của collection', () => {
    const result = validateTemplateAgainstCatalog(documentWithRoot(textOf('itemName')), description);

    expect(result.errors).toEqual([
      { path: 'root.content[0]', message: 'biến "itemName" chỉ dùng được trong vòng lặp "Danh sách món"' },
    ]);
  });

  it('báo lỗi collection lồng được lặp ngoài collection cha', () => {
    const root: TemplateNode = {
      type: 'repeat',
      id: 'toppings',
      collection: 'toppings',
      template: textOf('toppingName'),
    };

    expect(errorsOf(root)).toEqual(['collection "toppings" chỉ lặp được bên trong vòng lặp "Danh sách món"']);
  });

  it('báo lỗi collection không tồn tại', () => {
    const root: TemplateNode = { type: 'repeat', id: 'r', collection: 'payments', template: textOf('orderCode') };

    expect(errorsOf(root)).toEqual(['catalog không có collection "payments"']);
  });

  it('báo lỗi expand không phải biến number của đúng collection', () => {
    expect(errorsOf(repeatItems(textOf('itemName'), 'itemName'))).toEqual([
      'expand phải là biến kiểu "number", "itemName" là "string"',
    ]);
    expect(errorsOf(repeatItems(textOf('itemName'), 'discount'))).toEqual([
      'expand phải là biến của collection "items"',
    ]);
  });

  it('báo lỗi ảnh dùng biến không phải kiểu asset', () => {
    const root: TemplateNode = { type: 'image', id: 'logo', source: { var: 'orderCode' } };

    expect(errorsOf(root)).toEqual(['ảnh phải dùng biến kiểu "asset", "orderCode" là "string"']);
  });

  it('báo lỗi format không hợp kiểu biến', () => {
    expect(errorsOf(textOf('orderCode', { type: 'currency' }))).toEqual([
      'format "currency" không dùng được cho biến kiểu "string"',
    ]);
  });

  it('báo lỗi biến có sẵn dùng sai scope', () => {
    expect(errorsOf(textOf('$position'))).toEqual(['biến "$position" chỉ dùng được bên trong repeat']);
    expect(errorsOf(repeatItems(textOf('$unit')))).toEqual(['biến "$unit" chỉ dùng được bên trong repeat có expand']);
  });

  it('kiểm tra cả biến trong điều kiện ẩn/hiện', () => {
    const root: TemplateNode = {
      type: 'text',
      id: 'note',
      content: [{ text: 'Ghi chú' }],
      visibleWhen: { op: 'not', condition: { op: 'exists', var: 'itemNote' } },
    };

    expect(errorsOf(root)).toEqual(['biến "itemNote" chỉ dùng được trong vòng lặp "Danh sách món"']);
  });

  it('biến deprecated chỉ cảnh báo, không phải lỗi', () => {
    const result = validateTemplateAgainstCatalog(
      documentWithRoot(repeatItems(textOf('legacyItemName'))),
      description,
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      { path: 'root.template.content[0]', message: 'biến "legacyItemName" đã ngừng dùng: Dùng itemName' },
    ]);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx jest packages/printer-core/src/template/parse/__tests__/validateTemplateAgainstCatalog.test.ts`
Expected: FAIL — `validateTemplateAgainstCatalog is not a function`.

- [ ] **Step 3: Viết implementation**

`packages/printer-core/src/template/parse/validateTemplateAgainstCatalog.ts`:

```ts
import {
  BUILT_IN_VARIABLE_SCOPES,
  createCatalogIndex,
  isBuiltInVariableName,
  type BuiltInVariableName,
  type CatalogDescription,
  type CatalogIndex,
  type VariableType,
} from '../../catalog';
import type { Condition } from '../content/Condition';
import type { Segment } from '../content/Segment';
import type { ValueFormat } from '../content/ValueFormat';
import type { ImageNode } from '../nodes/ImageNode';
import type { RepeatNode } from '../nodes/RepeatNode';
import type { TemplateNode } from '../nodes/TemplateNode';
import type { TemplateDocument } from '../TemplateDocument';
import type { TemplateIssue } from './TemplateIssue';

/** Kết quả kiểm tra template theo catalog. */
export interface CatalogValidationResult {
  /** Lỗi chặn — template không resolve đúng được. */
  readonly errors: readonly TemplateIssue[];

  /** Cảnh báo không chặn, VD dùng biến `deprecated`. */
  readonly warnings: readonly TemplateIssue[];
}

/** Scope tại 1 vị trí trong cây node. */
interface TemplateScope {
  /** Các collection đang được `repeat`, từ ngoài vào trong. */
  readonly collections: readonly string[];

  /** `repeat` trong cùng có `expand` hay không (quyết định dùng được `$unit`). */
  readonly expanded: boolean;
}

/** Trạng thái 1 lần kiểm tra: bảng tra catalog + lỗi/cảnh báo gom được. */
interface CatalogCheck {
  readonly description: CatalogDescription;

  readonly index: CatalogIndex;

  readonly errors: TemplateIssue[];

  readonly warnings: TemplateIssue[];
}

/** Kiểu biến tương thích với từng loại format. */
const FORMAT_COMPATIBLE_TYPES: Readonly<Record<ValueFormat['type'], readonly VariableType[]>> = {
  number: ['number', 'money'],
  currency: ['number', 'money'],
  datetime: ['datetime'],
  text: ['string', 'number', 'money', 'datetime', 'boolean'],
};

/** Kiểu của mọi biến có sẵn. */
const BUILT_IN_VARIABLE_TYPE: VariableType = 'number';

const ROOT_SCOPE: TemplateScope = { collections: [], expanded: false };

/**
 * Kiểm tra template khớp catalog: biến tồn tại và dùng đúng scope, collection/expand hợp lệ, ảnh dùng biến
 * kiểu `asset`, format hợp kiểu biến. Nhận metadata (`describe()`) nên BE/designer dùng chung được.
 */
export function validateTemplateAgainstCatalog(
  template: TemplateDocument,
  description: CatalogDescription,
): CatalogValidationResult {
  const check: CatalogCheck = { description, index: createCatalogIndex(description), errors: [], warnings: [] };
  if (template.catalog !== description.id) {
    addError(check, 'catalog', `template dùng catalog "${template.catalog}", không phải "${description.id}"`);
  }
  checkNode(check, template.root, 'root', ROOT_SCOPE);
  return { errors: check.errors, warnings: check.warnings };
}

function addError(
  check: CatalogCheck,
  path: string,
  message: string,
): void {
  check.errors.push({ path, message });
}

function collectionLabel(check: CatalogCheck, collection: string): string {
  return check.index.collections.get(collection)?.description.label ?? collection;
}

function checkNode(
  check: CatalogCheck,
  node: TemplateNode,
  path: string,
  scope: TemplateScope,
): void {
  if (node.visibleWhen) checkCondition(check, node.visibleWhen, `${path}.visibleWhen`, scope);

  switch (node.type) {
    case 'container':
      node.children.forEach((child, index) => checkNode(check, child, `${path}.children[${index}]`, scope));
      return;
    case 'text':
    case 'barcode':
    case 'qrcode':
      checkSegments(check, node.content, `${path}.content`, scope);
      return;
    case 'image':
      checkImage(check, node, path, scope);
      return;
    case 'repeat':
      checkRepeat(check, node, path, scope);
      return;
    case 'line':
      return;
  }
}

function checkSegments(
  check: CatalogCheck,
  segments: readonly Segment[],
  path: string,
  scope: TemplateScope,
): void {
  segments.forEach((segment, index) => {
    if (!('var' in segment)) return;

    const segmentPath = `${path}[${index}]`;
    const type = checkVariableUse(check, segment.var, segmentPath, scope);
    if (type !== undefined && segment.format) checkFormat(check, segment.format, type, `${segmentPath}.format`);
  });
}

function checkFormat(
  check: CatalogCheck,
  format: ValueFormat,
  type: VariableType,
  path: string,
): void {
  if (FORMAT_COMPATIBLE_TYPES[format.type].includes(type)) return;
  addError(check, path, `format "${format.type}" không dùng được cho biến kiểu "${type}"`);
}

function checkImage(
  check: CatalogCheck,
  node: ImageNode,
  path: string,
  scope: TemplateScope,
): void {
  if (!('var' in node.source)) return;

  const sourcePath = `${path}.source`;
  const type = checkVariableUse(check, node.source.var, sourcePath, scope);
  if (type !== undefined && type !== 'asset') {
    addError(check, sourcePath, `ảnh phải dùng biến kiểu "asset", "${node.source.var}" là "${type}"`);
  }
}

function checkRepeat(
  check: CatalogCheck,
  node: RepeatNode,
  path: string,
  scope: TemplateScope,
): void {
  const collection = check.index.collections.get(node.collection);
  if (!collection) {
    addError(check, `${path}.collection`, `catalog không có collection "${node.collection}"`);
    return;
  }
  if (collection.parent !== null && !scope.collections.includes(collection.parent)) {
    const parentLabel = collectionLabel(check, collection.parent);
    const message = `collection "${node.collection}" chỉ lặp được bên trong vòng lặp "${parentLabel}"`;
    addError(check, `${path}.collection`, message);
  }
  if (node.expand !== undefined) checkExpand(check, node, `${path}.expand`);

  const innerScope: TemplateScope = {
    collections: [...scope.collections, node.collection],
    expanded: node.expand !== undefined,
  };
  checkNode(check, node.template, `${path}.template`, innerScope);
}

function checkExpand(
  check: CatalogCheck,
  node: RepeatNode,
  path: string,
): void {
  const variable = node.expand === undefined ? undefined : check.index.variables.get(node.expand);
  if (!variable || variable.collection !== node.collection) {
    addError(check, path, `expand phải là biến của collection "${node.collection}"`);
    return;
  }

  const type = variable.description.type;
  if (type !== 'number') addError(check, path, `expand phải là biến kiểu "number", "${node.expand}" là "${type}"`);
}

function checkCondition(
  check: CatalogCheck,
  condition: Condition,
  path: string,
  scope: TemplateScope,
): void {
  switch (condition.op) {
    case 'and':
    case 'or':
      condition.conditions.forEach((child, index) =>
        checkCondition(check, child, `${path}.conditions[${index}]`, scope),
      );
      return;
    case 'not':
      checkCondition(check, condition.condition, `${path}.condition`, scope);
      return;
    default:
      checkVariableUse(check, condition.var, path, scope);
  }
}

/** Kiểm tra 1 lần dùng biến; trả kiểu biến nếu biến tồn tại. */
function checkVariableUse(
  check: CatalogCheck,
  name: string,
  path: string,
  scope: TemplateScope,
): VariableType | undefined {
  if (isBuiltInVariableName(name)) {
    checkBuiltInVariableScope(check, name, path, scope);
    return BUILT_IN_VARIABLE_TYPE;
  }

  const variable = check.index.variables.get(name);
  if (!variable) {
    addError(check, path, `catalog "${check.description.id}" không có biến "${name}"`);
    return undefined;
  }
  if (variable.collection !== null && !scope.collections.includes(variable.collection)) {
    const label = collectionLabel(check, variable.collection);
    addError(check, path, `biến "${name}" chỉ dùng được trong vòng lặp "${label}"`);
  }
  if (variable.description.deprecated !== undefined) {
    check.warnings.push({ path, message: `biến "${name}" đã ngừng dùng: ${variable.description.deprecated}` });
  }
  return variable.description.type;
}

function checkBuiltInVariableScope(
  check: CatalogCheck,
  name: BuiltInVariableName,
  path: string,
  scope: TemplateScope,
): void {
  const required = BUILT_IN_VARIABLE_SCOPES[name];
  if (required === 'repeat' && scope.collections.length === 0) {
    addError(check, path, `biến "${name}" chỉ dùng được bên trong repeat`);
  }
  if (required === 'expand' && !scope.expanded) {
    addError(check, path, `biến "${name}" chỉ dùng được bên trong repeat có expand`);
  }
}
```

Thêm vào cuối `packages/printer-core/src/template/parse/index.ts`:

```ts
export { validateTemplateAgainstCatalog, type CatalogValidationResult } from './validateTemplateAgainstCatalog';
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx jest packages/printer-core/src/template/parse`
Expected: PASS — 3 suites (`validateTemplateAgainstCatalog.test.ts` 12 tests).

- [ ] **Step 5: Verify (scoped)**

```bash
npx tsc --noEmit -p packages/printer-core/tsconfig.json 2>&1 | grep -E "src/(catalog|template)/"
npx eslint packages/printer-core/src/template/parse
```

Expected: tsc lọc không in dòng nào; eslint 0 error. Line-length với `packages/printer-core/src/template/parse`.

- [ ] **Step 6: Commit**

```bash
git add packages/printer-core/src/template/parse
git commit -m "feat: validate template variables, scopes and formats against catalog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: DSL builder kiểm tra kiểu theo catalog

**Files:**
- Create: `packages/printer-core/src/template/builder/lengths.ts`, `dimensions.ts`, `conditions.ts`, `BuildContext.ts`, `NodeBuilder.ts`, `segments.ts`, `ContainerBuilder.ts`, `TextBuilder.ts`, `BarcodeBuilder.ts`, `QrCodeBuilder.ts`, `ImageBuilder.ts`, `LineBuilder.ts`, `RepeatBuilder.ts`, `TemplateScope.ts`, `TemplateDocumentBuilder.ts`, `index.ts`
- Test: `packages/printer-core/src/template/builder/__tests__/lengths.test.ts`, `dimensions.test.ts`, `conditions.test.ts`, `TextBuilder.test.ts`, `ContainerBuilder.test.ts`, `BarcodeBuilder.test.ts`, `QrCodeBuilder.test.ts`, `ImageBuilder.test.ts`, `LineBuilder.test.ts`, `TemplateDocumentBuilder.test.ts`
- Modify: `packages/printer-core/src/template/index.ts`

**Interfaces:**
- Consumes: type Task 2-3; `validateTemplateStructure`, `validateTemplateAgainstCatalog`, `TemplateIssue` (Task 3-4); `BuiltInVariableName`, `CatalogDescription` (Task 1).
- Produces:
  - `mm(value)`, `pt(value)`, `px(value)`, `insets(top, right = top, bottom = top, left = right)`, `fixed(length)`, `fill()`, `auto()`
  - `exists`, `notEmpty`, `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `and(...)`, `or(...)`, `not(condition)`
  - `column()`, `row()`, `text(content: string | Segment[])`, `barcode(content, symbology)`, `qrcode(content)`, `image(StaticImageSource | VariableSegment)`, `line()`; mọi node builder có `.id()`, `.visibleWhen()`, node có hộp có `.width/.height/.margin/.padding`
  - `TemplateScope<TNames, TCollections>` với `var(name, format?)` và `repeat({ collection, expand? }, (scope) => builder): RepeatBuilder`; `RepeatBuilder.maxItemsPerPage(n)`
  - `labelTemplate(catalog)`, `receiptTemplate(catalog)` → `TemplateDocumentBuilder` với `.id() .name() .paper() .root(builder | (scope) => builder) .build(): TemplateDocument`; `TemplateBuildError { issues }`; `CatalogShape`, `RootScope`, `PaperFor`, `RootContent`, `RepeatOptions`, `SegmentInput`

- [ ] **Step 1: Viết test**

`packages/printer-core/src/template/builder/__tests__/lengths.test.ts`:

```ts
import { insets, mm, pt, px } from '..';

describe('mm / pt / px', () => {
  it('giữ nguyên giá trị và đơn vị như người viết khai báo', () => {
    expect(mm(2.5)).toEqual({ value: 2.5, unit: 'mm' });
    expect(pt(9)).toEqual({ value: 9, unit: 'pt' });
    expect(px(16)).toEqual({ value: 16, unit: 'px' });
  });
});

describe('insets', () => {
  it('theo quy ước CSS 1-4 tham số', () => {
    expect(insets(mm(1))).toEqual({ top: mm(1), right: mm(1), bottom: mm(1), left: mm(1) });
    expect(insets(mm(1), mm(2))).toEqual({ top: mm(1), right: mm(2), bottom: mm(1), left: mm(2) });
    expect(insets(mm(1), mm(2), mm(3))).toEqual({ top: mm(1), right: mm(2), bottom: mm(3), left: mm(2) });
    expect(insets(mm(1), mm(2), mm(3), mm(4))).toEqual({ top: mm(1), right: mm(2), bottom: mm(3), left: mm(4) });
  });
});
```

`packages/printer-core/src/template/builder/__tests__/dimensions.test.ts`:

```ts
import { auto, fill, fixed, mm } from '..';

describe('fixed / fill / auto', () => {
  it('tạo đúng dạng Dimension', () => {
    expect(fixed(mm(10))).toEqual({ type: 'fixed', value: mm(10) });
    expect(fill()).toEqual({ type: 'fill' });
    expect(auto()).toEqual({ type: 'auto' });
  });
});
```

`packages/printer-core/src/template/builder/__tests__/conditions.test.ts`:

```ts
import { and, eq, exists, gt, gte, lt, lte, neq, not, notEmpty, or } from '..';

describe('helper điều kiện', () => {
  it('so sánh tạo đúng op, tên biến và hằng', () => {
    expect(eq('orderCode', 'X')).toEqual({ op: 'eq', var: 'orderCode', value: 'X' });
    expect(neq('orderCode', 'X')).toEqual({ op: 'neq', var: 'orderCode', value: 'X' });
    expect(gt('discount', 0)).toEqual({ op: 'gt', var: 'discount', value: 0 });
    expect(gte('discount', 0)).toEqual({ op: 'gte', var: 'discount', value: 0 });
    expect(lt('discount', 0)).toEqual({ op: 'lt', var: 'discount', value: 0 });
    expect(lte('discount', 0)).toEqual({ op: 'lte', var: 'discount', value: 0 });
  });

  it('lồng and/or/not thành data thuần', () => {
    const condition = and(exists('tableName'), or(gt('discount', 0), not(eq('orderCode', 'X'))), notEmpty('itemNote'));

    expect(condition).toEqual({
      op: 'and',
      conditions: [
        { op: 'exists', var: 'tableName' },
        {
          op: 'or',
          conditions: [
            { op: 'gt', var: 'discount', value: 0 },
            { op: 'not', condition: { op: 'eq', var: 'orderCode', value: 'X' } },
          ],
        },
        { op: 'notEmpty', var: 'itemNote' },
      ],
    });
  });
});
```

`packages/printer-core/src/template/builder/__tests__/TextBuilder.test.ts`:

```ts
import { gt, insets, mm, px, text } from '..';
import { TemplateNodeIdGenerator, type BuildContext } from '../BuildContext';

function newContext(): BuildContext {
  return { idGenerator: new TemplateNodeIdGenerator() };
}

describe('text', () => {
  it('chuỗi thành 1 segment chữ, style gộp box + chữ', () => {
    const node = text('Xin chào')
      .id('greeting')
      .fontSize(px(16))
      .bold()
      .align('center')
      .lineHeight(1.3)
      .padding(insets(mm(1)))
      .build(newContext());

    expect(node).toEqual({
      type: 'text',
      id: 'greeting',
      content: [{ text: 'Xin chào' }],
      style: { padding: insets(mm(1)), fontSize: px(16), fontWeight: 'bold', textAlign: 'center', lineHeight: 1.3 },
    });
  });

  it('không có style thì không có field style, id tự sinh', () => {
    expect(text([{ var: 'orderCode' }]).build(newContext())).toEqual({
      type: 'text',
      id: 'text-1',
      content: [{ var: 'orderCode' }],
    });
  });

  it('visibleWhen gắn điều kiện vào node', () => {
    const node = text('Giảm giá').visibleWhen(gt('discount', 0)).build(newContext());

    expect(node.visibleWhen).toEqual({ op: 'gt', var: 'discount', value: 0 });
  });
});
```

`packages/printer-core/src/template/builder/__tests__/ContainerBuilder.test.ts`:

```ts
import { column, mm, row, text } from '..';
import { TemplateNodeIdGenerator, type BuildContext } from '../BuildContext';

function newContext(): BuildContext {
  return { idGenerator: new TemplateNodeIdGenerator() };
}

describe('column / row', () => {
  it('hướng, gap, căn chỉnh, node con; id tự sinh theo thứ tự build', () => {
    const node = row()
      .gap(mm(1))
      .justifyContent('space-between')
      .alignItems('center')
      .children(text('A'), text('B'))
      .build(newContext());

    expect(node).toEqual({
      type: 'container',
      id: 'container-1',
      style: { direction: 'row', gap: mm(1), justifyContent: 'space-between', alignItems: 'center' },
      children: [
        { type: 'text', id: 'text-2', content: [{ text: 'A' }] },
        { type: 'text', id: 'text-3', content: [{ text: 'B' }] },
      ],
    });
  });

  it('column mặc định chỉ có direction', () => {
    expect(column().build(newContext()).style).toEqual({ direction: 'column' });
  });
});
```

`packages/printer-core/src/template/builder/__tests__/BarcodeBuilder.test.ts`:

```ts
import { barcode, mm } from '..';
import { TemplateNodeIdGenerator } from '../BuildContext';

describe('barcode', () => {
  it('symbology bắt buộc, readable + chiều cao vạch tuỳ chọn', () => {
    const node = barcode([{ var: 'orderCode' }], 'code128')
      .readable(true)
      .barHeight(mm(8))
      .build({ idGenerator: new TemplateNodeIdGenerator() });

    expect(node).toEqual({
      type: 'barcode',
      id: 'barcode-1',
      content: [{ var: 'orderCode' }],
      symbology: 'code128',
      readable: true,
      barHeight: mm(8),
    });
  });
});
```

`packages/printer-core/src/template/builder/__tests__/QrCodeBuilder.test.ts`:

```ts
import { mm, qrcode } from '..';
import { TemplateNodeIdGenerator } from '../BuildContext';

describe('qrcode', () => {
  it('mức sửa lỗi + cỡ module', () => {
    const node = qrcode('https://ndt.vn')
      .errorCorrection('M')
      .moduleSize(mm(0.5))
      .build({ idGenerator: new TemplateNodeIdGenerator() });

    expect(node).toEqual({
      type: 'qrcode',
      id: 'qrcode-1',
      content: [{ text: 'https://ndt.vn' }],
      errorCorrection: 'M',
      moduleSize: mm(0.5),
    });
  });
});
```

`packages/printer-core/src/template/builder/__tests__/ImageBuilder.test.ts`:

```ts
import { fixed, image, mm } from '..';
import { TemplateNodeIdGenerator, type BuildContext } from '../BuildContext';

function newContext(): BuildContext {
  return { idGenerator: new TemplateNodeIdGenerator() };
}

describe('image', () => {
  it('nguồn biến chỉ giữ tên biến (bỏ format của segment)', () => {
    const node = image({ var: 'storeLogo', format: { type: 'text' } }).build(newContext());

    expect(node).toEqual({ type: 'image', id: 'image-1', source: { var: 'storeLogo' } });
  });

  it('nguồn asset tĩnh giữ mã asset', () => {
    const node = image({ asset: 'icon-cup@v2' }).width(fixed(mm(10))).build(newContext());

    expect(node).toEqual({
      type: 'image',
      id: 'image-1',
      source: { asset: 'icon-cup@v2' },
      style: { width: fixed(mm(10)) },
    });
  });
});
```

`packages/printer-core/src/template/builder/__tests__/LineBuilder.test.ts`:

```ts
import { line, mm } from '..';
import { TemplateNodeIdGenerator, type BuildContext } from '../BuildContext';

function newContext(): BuildContext {
  return { idGenerator: new TemplateNodeIdGenerator() };
}

describe('line', () => {
  it('độ dày + nét đứt', () => {
    expect(line().thickness(mm(0.3)).dashed().build(newContext())).toEqual({
      type: 'line',
      id: 'line-1',
      thickness: mm(0.3),
      pattern: 'dashed',
    });
  });

  it('mặc định không có field thừa', () => {
    expect(line().build(newContext())).toEqual({ type: 'line', id: 'line-1' });
  });
});
```

`TemplateDocumentBuilder.test.ts` có 1 test chỉ để TypeScript kiểm tra (`// @ts-expect-error`): nếu type DSL sai, lỗi xuất hiện ở bước type-check chứ không ở Jest.

`packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts`:

```ts
import {
  column,
  insets,
  labelTemplate,
  mm,
  parseTemplate,
  px,
  receiptTemplate,
  text,
  TemplateBuildError,
} from '../..';
import { TEST_ORDER_CATALOG } from '../../../testing';

function buildProductLabel() {
  return labelTemplate(TEST_ORDER_CATALOG)
    .id('product-label-default')
    .name('Tem món mặc định')
    .paper({ widthMm: 50, heightMm: 30 })
    .root((scope) =>
      scope
        .repeat({ collection: 'items', expand: 'quantity' }, (item) =>
          column()
            .padding(insets(mm(2)))
            .gap(mm(1))
            .children(
              text([item.var('itemName')]).fontSize(px(16)).bold(),
              item.repeat({ collection: 'toppings' }, (topping) => text([{ text: '+ ' }, topping.var('toppingName')])),
              text([item.var('orderCode'), { text: ' · ' }, item.var('$unit'), { text: '/' }, item.var('$unitCount')]),
            ),
        )
        .maxItemsPerPage(1),
    )
    .build();
}

describe('labelTemplate / receiptTemplate', () => {
  it('build ra TemplateDocument JSON thuần đúng cấu trúc', () => {
    const template = buildProductLabel();

    expect(template).toEqual({
      schemaVersion: 1,
      id: 'product-label-default',
      name: 'Tem món mặc định',
      catalog: 'test-order',
      media: 'label',
      locale: 'vi-VN',
      paper: { widthMm: 50, heightMm: 30 },
      root: {
        type: 'repeat',
        id: 'repeat-1',
        collection: 'items',
        expand: 'quantity',
        maxItemsPerPage: 1,
        template: {
          type: 'container',
          id: 'container-2',
          style: { padding: insets(mm(2)), direction: 'column', gap: mm(1) },
          children: [
            {
              type: 'text',
              id: 'text-3',
              content: [{ var: 'itemName' }],
              style: { fontSize: px(16), fontWeight: 'bold' },
            },
            {
              type: 'repeat',
              id: 'repeat-4',
              collection: 'toppings',
              template: { type: 'text', id: 'text-5', content: [{ text: '+ ' }, { var: 'toppingName' }] },
            },
            {
              type: 'text',
              id: 'text-6',
              content: [{ var: 'orderCode' }, { text: ' · ' }, { var: '$unit' }, { text: '/' }, { var: '$unitCount' }],
            },
          ],
        },
      },
    });
  });

  it('round-trip JSON.stringify → JSON.parse → parseTemplate không mất dữ liệu', () => {
    const template = buildProductLabel();
    const result = parseTemplate(JSON.parse(JSON.stringify(template)));

    expect(result).toEqual({ ok: true, template });
  });

  it('receipt không có chiều cao giấy', () => {
    const template = receiptTemplate(TEST_ORDER_CATALOG)
      .id('receipt')
      .name('Hoá đơn')
      .paper({ widthMm: 72 })
      .root((scope) => text([{ text: 'Mã đơn: ' }, scope.var('orderCode')]))
      .build();

    expect(template.media).toBe('receipt');
    expect(template.paper).toEqual({ widthMm: 72 });
  });

  it('throw TemplateBuildError khi segment viết tay dùng biến sai scope', () => {
    const builder = receiptTemplate(TEST_ORDER_CATALOG)
      .id('receipt')
      .name('Hoá đơn')
      .paper({ widthMm: 72 })
      .root(text([{ var: 'itemName' }]));

    expect(() => builder.build()).toThrow(TemplateBuildError);
    expect(() => builder.build()).toThrow('biến "itemName" chỉ dùng được trong vòng lặp "Danh sách món"');
  });

  it('không throw khi chỉ có cảnh báo deprecated', () => {
    const build = () =>
      receiptTemplate(TEST_ORDER_CATALOG)
        .id('receipt')
        .name('Hoá đơn')
        .paper({ widthMm: 72 })
        .root((scope) => scope.repeat({ collection: 'items' }, (item) => text([item.var('legacyItemName')])))
        .build();

    expect(build).not.toThrow();
  });

  it('throw khi thiếu id, name, paper hoặc root', () => {
    expect(() => receiptTemplate(TEST_ORDER_CATALOG).build()).toThrow('Template cần .id(...)');
    expect(() => receiptTemplate(TEST_ORDER_CATALOG).id('x').build()).toThrow('Template cần .name(...)');
    expect(() => receiptTemplate(TEST_ORDER_CATALOG).id('x').name('x').build()).toThrow('Template cần .paper(...)');
    expect(() => receiptTemplate(TEST_ORDER_CATALOG).id('x').name('x').paper({ widthMm: 72 }).build()).toThrow(
      'Template cần .root(...)',
    );
  });

  it('TypeScript chặn tên biến sai, biến sai scope và khổ giấy sai loại', () => {
    const checkTypesOnly = () => {
      // @ts-expect-error label bắt buộc heightMm
      labelTemplate(TEST_ORDER_CATALOG).paper({ widthMm: 50 });
      // @ts-expect-error receipt không có heightMm
      receiptTemplate(TEST_ORDER_CATALOG).paper({ widthMm: 72, heightMm: 30 });

      receiptTemplate(TEST_ORDER_CATALOG).root((scope) => {
        // @ts-expect-error tên biến sai
        scope.var('orderCod');
        // @ts-expect-error biến của collection không dùng được ở gốc
        scope.var('itemName');
        // @ts-expect-error collection lồng không lặp được ở gốc
        scope.repeat({ collection: 'toppings' }, () => text(''));

        return scope.repeat({ collection: 'items', expand: 'quantity' }, (item) => {
          // @ts-expect-error biến của collection con chưa dùng được
          item.var('toppingName');
          return text([item.var('itemName'), item.var('orderCode'), item.var('$position')]);
        });
      });
    };

    expect(checkTypesOnly).toBeInstanceOf(Function);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx jest packages/printer-core/src/template/builder`
Expected: FAIL — `Cannot find module '..'` / `'../BuildContext'`.

- [ ] **Step 3: Viết helper**

`packages/printer-core/src/template/builder/lengths.ts`:

```ts
import type { Insets } from '../style/Insets';
import type { Length } from '../style/Length';

/** Độ dài tính bằng milimét. */
export function mm(value: number): Length {
  return { value, unit: 'mm' };
}

/** Độ dài tính bằng point (1/72 inch). */
export function pt(value: number): Length {
  return { value, unit: 'pt' };
}

/** Độ dài tính bằng pixel chuẩn CSS (1/96 inch). */
export function px(value: number): Length {
  return { value, unit: 'px' };
}

/**
 * Khoảng cách 4 cạnh theo quy ước CSS: `insets(a)` 4 cạnh bằng nhau, `insets(a, b)` trên-dưới `a` và
 * trái-phải `b`, `insets(a, b, c)` trên `a` trái-phải `b` dưới `c`, `insets(a, b, c, d)` theo chiều kim đồng hồ.
 */
export function insets(
  top: Length,
  right: Length = top,
  bottom: Length = top,
  left: Length = right,
): Insets {
  return { top, right, bottom, left };
}
```

`packages/printer-core/src/template/builder/dimensions.ts`:

```ts
import type { AutoDimension, FillDimension, FixedDimension } from '../style/Dimension';
import type { Length } from '../style/Length';

/** Kích thước cố định. */
export function fixed(value: Length): FixedDimension {
  return { type: 'fixed', value };
}

/** Chiếm hết phần còn trống của container cha. */
export function fill(): FillDimension {
  return { type: 'fill' };
}

/** Co theo nội dung. */
export function auto(): AutoDimension {
  return { type: 'auto' };
}
```

`packages/printer-core/src/template/builder/conditions.ts`:

```ts
import type {
  ComparisonCondition,
  ComparisonValue,
  Condition,
  GroupCondition,
  NotCondition,
  PresenceCondition,
} from '../content/Condition';

/** Biến có giá trị (khác `undefined`/`null`). */
export function exists(variable: string): PresenceCondition {
  return { op: 'exists', var: variable };
}

/** Biến có giá trị và không phải chuỗi rỗng/mảng rỗng. */
export function notEmpty(variable: string): PresenceCondition {
  return { op: 'notEmpty', var: variable };
}

/** Giá trị raw của biến bằng `value`. */
export function eq(variable: string, value: ComparisonValue): ComparisonCondition {
  return { op: 'eq', var: variable, value };
}

/** Giá trị raw của biến khác `value`. */
export function neq(variable: string, value: ComparisonValue): ComparisonCondition {
  return { op: 'neq', var: variable, value };
}

/** Giá trị raw của biến lớn hơn `value` (chỉ đúng khi cả 2 là số). */
export function gt(variable: string, value: number): ComparisonCondition {
  return { op: 'gt', var: variable, value };
}

/** Giá trị raw của biến lớn hơn hoặc bằng `value`. */
export function gte(variable: string, value: number): ComparisonCondition {
  return { op: 'gte', var: variable, value };
}

/** Giá trị raw của biến nhỏ hơn `value`. */
export function lt(variable: string, value: number): ComparisonCondition {
  return { op: 'lt', var: variable, value };
}

/** Giá trị raw của biến nhỏ hơn hoặc bằng `value`. */
export function lte(variable: string, value: number): ComparisonCondition {
  return { op: 'lte', var: variable, value };
}

/** Mọi điều kiện con đều đúng. */
export function and(...conditions: Condition[]): GroupCondition {
  return { op: 'and', conditions };
}

/** Ít nhất 1 điều kiện con đúng. */
export function or(...conditions: Condition[]): GroupCondition {
  return { op: 'or', conditions };
}

/** Phủ định điều kiện. */
export function not(condition: Condition): NotCondition {
  return { op: 'not', condition };
}
```

`packages/printer-core/src/template/builder/BuildContext.ts`:

```ts
/** Sinh `id` node dạng `<loại>-<số thứ tự>` cho node không tự đặt `id`. */
export class TemplateNodeIdGenerator {
  private sequence = 0;

  next(nodeType: string): string {
    this.sequence += 1;
    return `${nodeType}-${this.sequence}`;
  }
}

/** Trạng thái dùng chung trong 1 lần build template. */
export interface BuildContext {
  readonly idGenerator: TemplateNodeIdGenerator;
}
```

`packages/printer-core/src/template/builder/segments.ts`:

```ts
import type { Segment } from '../content/Segment';

/** Nội dung truyền vào builder: chuỗi cố định hoặc mảng segment. */
export type SegmentInput = string | readonly Segment[];

/** Chuẩn hoá nội dung thành mảng segment; chuỗi cố định thành 1 segment `text`. */
export function toSegments(content: SegmentInput): readonly Segment[] {
  return typeof content === 'string' ? [{ text: content }] : content;
}
```

- [ ] **Step 4: Viết node builder**

`packages/printer-core/src/template/builder/NodeBuilder.ts`:

```ts
import type { Condition } from '../content/Condition';
import type { TemplateNode } from '../nodes/TemplateNode';
import type { BoxStyle } from '../style/BoxStyle';
import type { Dimension } from '../style/Dimension';
import type { Insets } from '../style/Insets';
import type { BuildContext } from './BuildContext';

/** Builder gốc của mọi node: đặt `id` và điều kiện hiển thị. */
export abstract class TemplateNodeBuilder<TNode extends TemplateNode = TemplateNode> {
  protected nodeId?: string;

  protected visibility?: Condition;

  /** Đặt `id` node; bỏ qua thì tự sinh dạng `text-1`. */
  id(value: string): this {
    this.nodeId = value;
    return this;
  }

  /** Chỉ hiện node khi điều kiện đúng. */
  visibleWhen(condition: Condition): this {
    this.visibility = condition;
    return this;
  }

  abstract build(context: BuildContext): TNode;

  /** `id` đã đặt hoặc id tự sinh theo loại node. */
  protected resolveId(context: BuildContext, nodeType: TNode['type']): string {
    return this.nodeId ?? context.idGenerator.next(nodeType);
  }

  /** Field `visibleWhen` để spread vào node; rỗng nếu không đặt, để JSON không có field `undefined`. */
  protected visibilityField(): { readonly visibleWhen?: Condition } {
    return this.visibility ? { visibleWhen: this.visibility } : {};
  }
}

/** Builder của node có style hộp (mọi node trừ `repeat`). */
export abstract class NodeBuilder<TNode extends TemplateNode = TemplateNode> extends TemplateNodeBuilder<TNode> {
  protected boxStyle: BoxStyle = {};

  width(value: Dimension): this {
    this.boxStyle = { ...this.boxStyle, width: value };
    return this;
  }

  height(value: Dimension): this {
    this.boxStyle = { ...this.boxStyle, height: value };
    return this;
  }

  margin(value: Insets): this {
    this.boxStyle = { ...this.boxStyle, margin: value };
    return this;
  }

  padding(value: Insets): this {
    this.boxStyle = { ...this.boxStyle, padding: value };
    return this;
  }

  /** Field `style` để spread vào node; bỏ hẳn field khi style rỗng cho JSON gọn. */
  protected styleField<TStyle extends BoxStyle>(style: TStyle): { readonly style?: TStyle } {
    return Object.keys(style).length > 0 ? { style } : {};
  }
}
```

`packages/printer-core/src/template/builder/ContainerBuilder.ts`:

```ts
import type { ContainerNode } from '../nodes/ContainerNode';
import type { LayoutStyle } from '../style/LayoutStyle';
import type { Length } from '../style/Length';
import type { BuildContext } from './BuildContext';
import { NodeBuilder, type TemplateNodeBuilder } from './NodeBuilder';

/** Builder của container xếp node con theo hàng hoặc cột. */
export class ContainerBuilder extends NodeBuilder<ContainerNode> {
  private readonly childBuilders: TemplateNodeBuilder[] = [];

  private layout: LayoutStyle;

  constructor(direction: 'row' | 'column') {
    super();
    this.layout = { direction };
  }

  gap(value: Length): this {
    this.layout = { ...this.layout, gap: value };
    return this;
  }

  justifyContent(value: NonNullable<LayoutStyle['justifyContent']>): this {
    this.layout = { ...this.layout, justifyContent: value };
    return this;
  }

  alignItems(value: NonNullable<LayoutStyle['alignItems']>): this {
    this.layout = { ...this.layout, alignItems: value };
    return this;
  }

  children(...builders: TemplateNodeBuilder[]): this {
    this.childBuilders.push(...builders);
    return this;
  }

  build(context: BuildContext): ContainerNode {
    return {
      type: 'container',
      id: this.resolveId(context, 'container'),
      ...this.visibilityField(),
      style: { ...this.boxStyle, ...this.layout },
      children: this.childBuilders.map((child) => child.build(context)),
    };
  }
}

/** Container xếp node con theo cột (từ trên xuống). */
export function column(): ContainerBuilder {
  return new ContainerBuilder('column');
}

/** Container xếp node con theo hàng (từ trái sang). */
export function row(): ContainerBuilder {
  return new ContainerBuilder('row');
}
```

`packages/printer-core/src/template/builder/TextBuilder.ts`:

```ts
import type { Segment } from '../content/Segment';
import type { TextNode } from '../nodes/TextNode';
import type { Length } from '../style/Length';
import type { TextStyle } from '../style/TextStyle';
import type { BuildContext } from './BuildContext';
import { NodeBuilder } from './NodeBuilder';
import { toSegments, type SegmentInput } from './segments';

/** Builder của đoạn chữ. */
export class TextBuilder extends NodeBuilder<TextNode> {
  private readonly content: readonly Segment[];

  private textStyle: TextStyle = {};

  constructor(content: SegmentInput) {
    super();
    this.content = toSegments(content);
  }

  fontSize(value: Length): this {
    this.textStyle = { ...this.textStyle, fontSize: value };
    return this;
  }

  bold(): this {
    this.textStyle = { ...this.textStyle, fontWeight: 'bold' };
    return this;
  }

  align(value: NonNullable<TextStyle['textAlign']>): this {
    this.textStyle = { ...this.textStyle, textAlign: value };
    return this;
  }

  /** Hệ số chiều cao dòng so với cỡ chữ, VD 1.2. */
  lineHeight(ratio: number): this {
    this.textStyle = { ...this.textStyle, lineHeight: ratio };
    return this;
  }

  build(context: BuildContext): TextNode {
    return {
      type: 'text',
      id: this.resolveId(context, 'text'),
      ...this.visibilityField(),
      content: this.content,
      ...this.styleField({ ...this.boxStyle, ...this.textStyle }),
    };
  }
}

/** Đoạn chữ: chuỗi cố định, hoặc mảng segment ghép chữ + biến. */
export function text(content: SegmentInput): TextBuilder {
  return new TextBuilder(content);
}
```

`packages/printer-core/src/template/builder/BarcodeBuilder.ts`:

```ts
import type { BarcodeSymbology } from '../../symbology';
import type { Segment } from '../content/Segment';
import type { BarcodeNode } from '../nodes/BarcodeNode';
import type { Length } from '../style/Length';
import type { BuildContext } from './BuildContext';
import { NodeBuilder } from './NodeBuilder';
import { toSegments, type SegmentInput } from './segments';

/** Builder của mã vạch 1D. */
export class BarcodeBuilder extends NodeBuilder<BarcodeNode> {
  private readonly content: readonly Segment[];

  private readonly symbology: BarcodeSymbology;

  private readableValue?: boolean;

  private barHeightValue?: Length;

  constructor(content: SegmentInput, symbology: BarcodeSymbology) {
    super();
    this.content = toSegments(content);
    this.symbology = symbology;
  }

  /** In kèm chữ đọc được bên dưới vạch. */
  readable(value: boolean): this {
    this.readableValue = value;
    return this;
  }

  /** Chiều cao vạch. */
  barHeight(value: Length): this {
    this.barHeightValue = value;
    return this;
  }

  build(context: BuildContext): BarcodeNode {
    return {
      type: 'barcode',
      id: this.resolveId(context, 'barcode'),
      ...this.visibilityField(),
      content: this.content,
      symbology: this.symbology,
      ...(this.readableValue !== undefined ? { readable: this.readableValue } : {}),
      ...(this.barHeightValue !== undefined ? { barHeight: this.barHeightValue } : {}),
      ...this.styleField(this.boxStyle),
    };
  }
}

/** Mã vạch 1D với nội dung và loại mã vạch. */
export function barcode(content: SegmentInput, symbology: BarcodeSymbology): BarcodeBuilder {
  return new BarcodeBuilder(content, symbology);
}
```

`packages/printer-core/src/template/builder/QrCodeBuilder.ts`:

```ts
import type { QrErrorCorrectionLevel } from '../../symbology';
import type { Segment } from '../content/Segment';
import type { QrCodeNode } from '../nodes/QrCodeNode';
import type { Length } from '../style/Length';
import type { BuildContext } from './BuildContext';
import { NodeBuilder } from './NodeBuilder';
import { toSegments, type SegmentInput } from './segments';

/** Builder của mã QR. */
export class QrCodeBuilder extends NodeBuilder<QrCodeNode> {
  private readonly content: readonly Segment[];

  private errorCorrectionValue?: QrErrorCorrectionLevel;

  private moduleSizeValue?: Length;

  constructor(content: SegmentInput) {
    super();
    this.content = toSegments(content);
  }

  errorCorrection(value: QrErrorCorrectionLevel): this {
    this.errorCorrectionValue = value;
    return this;
  }

  /** Cạnh 1 module (ô vuông) của QR. */
  moduleSize(value: Length): this {
    this.moduleSizeValue = value;
    return this;
  }

  build(context: BuildContext): QrCodeNode {
    return {
      type: 'qrcode',
      id: this.resolveId(context, 'qrcode'),
      ...this.visibilityField(),
      content: this.content,
      ...(this.errorCorrectionValue !== undefined ? { errorCorrection: this.errorCorrectionValue } : {}),
      ...(this.moduleSizeValue !== undefined ? { moduleSize: this.moduleSizeValue } : {}),
      ...this.styleField(this.boxStyle),
    };
  }
}

/** Mã QR với nội dung cho trước. */
export function qrcode(content: SegmentInput): QrCodeBuilder {
  return new QrCodeBuilder(content);
}
```

`packages/printer-core/src/template/builder/ImageBuilder.ts`:

```ts
import type { VariableSegment } from '../content/Segment';
import type { ImageNode, ImageNodeSource, StaticImageSource } from '../nodes/ImageNode';
import type { BuildContext } from './BuildContext';
import { NodeBuilder } from './NodeBuilder';

/** Builder của ảnh bitmap. */
export class ImageBuilder extends NodeBuilder<ImageNode> {
  private readonly source: ImageNodeSource;

  constructor(source: ImageNodeSource) {
    super();
    this.source = source;
  }

  build(context: BuildContext): ImageNode {
    return {
      type: 'image',
      id: this.resolveId(context, 'image'),
      ...this.visibilityField(),
      source: this.source,
      ...this.styleField(this.boxStyle),
    };
  }
}

/** Ảnh từ asset tĩnh (`{ asset: 'icon@v1' }`) hoặc từ biến kiểu `asset` (`scope.var('storeLogo')`). */
export function image(source: StaticImageSource | VariableSegment): ImageBuilder {
  // Ảnh không có format, nên chỉ giữ tên biến của segment.
  return new ImageBuilder('var' in source ? { var: source.var } : { asset: source.asset });
}
```

`packages/printer-core/src/template/builder/LineBuilder.ts`:

```ts
import type { LineNode } from '../nodes/LineNode';
import type { Length } from '../style/Length';
import type { BuildContext } from './BuildContext';
import { NodeBuilder } from './NodeBuilder';

/** Builder của đường kẻ ngang. */
export class LineBuilder extends NodeBuilder<LineNode> {
  private thicknessValue?: Length;

  private isDashed = false;

  /** Độ dày nét. */
  thickness(value: Length): this {
    this.thicknessValue = value;
    return this;
  }

  /** Nét đứt thay vì nét liền. */
  dashed(): this {
    this.isDashed = true;
    return this;
  }

  build(context: BuildContext): LineNode {
    return {
      type: 'line',
      id: this.resolveId(context, 'line'),
      ...this.visibilityField(),
      ...(this.thicknessValue !== undefined ? { thickness: this.thicknessValue } : {}),
      ...(this.isDashed ? { pattern: 'dashed' as const } : {}),
      ...this.styleField(this.boxStyle),
    };
  }
}

/** Đường kẻ ngang, dài hết chiều rộng còn trống (hoặc theo `width(fixed(...))`). */
export function line(): LineBuilder {
  return new LineBuilder();
}
```

`packages/printer-core/src/template/builder/RepeatBuilder.ts`:

```ts
import type { RepeatNode } from '../nodes/RepeatNode';
import type { BuildContext } from './BuildContext';
import { TemplateNodeBuilder } from './NodeBuilder';

/** Tuỳ chọn của `repeat`. */
export interface RepeatOptions<TCollection extends string = string, TExpand extends string = string> {
  /** Tên collection trong catalog. */
  readonly collection: TCollection;

  /** Tên biến kiểu `number` của collection để nhân mỗi phần tử thành bấy nhiêu bản sao. */
  readonly expand?: TExpand;
}

/** Builder của `repeat` — tạo qua `scope.repeat(...)` để tên biến bên trong được kiểm tra kiểu. */
export class RepeatBuilder extends TemplateNodeBuilder<RepeatNode> {
  private readonly options: RepeatOptions;

  private readonly templateBuilder: TemplateNodeBuilder;

  private perPage?: number;

  constructor(options: RepeatOptions, templateBuilder: TemplateNodeBuilder) {
    super();
    this.options = options;
    this.templateBuilder = templateBuilder;
  }

  /** Số phần tử tối đa mỗi trang (tính sau khi expand); VD mỗi tem 1 ly thì truyền 1. */
  maxItemsPerPage(value: number): this {
    this.perPage = value;
    return this;
  }

  build(context: BuildContext): RepeatNode {
    return {
      type: 'repeat',
      id: this.resolveId(context, 'repeat'),
      ...this.visibilityField(),
      collection: this.options.collection,
      ...(this.options.expand !== undefined ? { expand: this.options.expand } : {}),
      ...(this.perPage !== undefined ? { maxItemsPerPage: this.perPage } : {}),
      template: this.templateBuilder.build(context),
    };
  }
}
```

- [ ] **Step 5: Viết scope + document builder**

`packages/printer-core/src/template/builder/TemplateScope.ts`:

```ts
import type { BuiltInVariableName } from '../../catalog';
import type { VariableSegment } from '../content/Segment';
import type { ValueFormat } from '../content/ValueFormat';
import type { TemplateNodeBuilder } from './NodeBuilder';
import { RepeatBuilder, type RepeatOptions } from './RepeatBuilder';

type NameOf<TMap> = Extract<keyof TMap, string>;

type ItemVariableNames<TCollection> = TCollection extends { readonly variables: infer TVariables }
  ? NameOf<TVariables>
  : never;

type ChildCollections<TCollection> = TCollection extends { readonly collections: infer TChildren } ? TChildren : never;

/** Scope bên trong `repeat` của collection `TName`: thêm biến của collection đó, collection con thành lặp được. */
export type RepeatScope<TNames extends string, TCollections, TName extends NameOf<TCollections>> = TemplateScope<
  TNames | ItemVariableNames<TCollections[TName]>,
  ChildCollections<TCollections[TName]>
>;

/**
 * Scope của DSL: chỉ để TypeScript kiểm tra tên biến/collection theo catalog ngay trong editor.
 * `TNames` là biến dùng được tại đây, `TCollections` là collection lặp được tại đây.
 */
export class TemplateScope<TNames extends string, TCollections> {
  /** Segment lấy giá trị biến; gõ sai tên hoặc dùng biến ngoài scope là lỗi TypeScript. */
  var(name: TNames | BuiltInVariableName, format?: ValueFormat): VariableSegment {
    return format === undefined ? { var: name } : { var: name, format };
  }

  /** Lặp `render` cho từng phần tử của collection; callback nhận scope đã thêm biến của collection đó. */
  repeat<TName extends NameOf<TCollections>>(
    options: RepeatOptions<TName, ItemVariableNames<TCollections[TName]>>,
    render: (scope: RepeatScope<TNames, TCollections, TName>) => TemplateNodeBuilder,
  ): RepeatBuilder {
    return new RepeatBuilder(options, render(new TemplateScope()));
  }
}
```

`packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts`:

```ts
import type { CatalogDescription } from '../../catalog';
import type { TemplateIssue } from '../parse/TemplateIssue';
import { validateTemplateAgainstCatalog } from '../parse/validateTemplateAgainstCatalog';
import { validateTemplateStructure } from '../parse/validateTemplateStructure';
import {
  TEMPLATE_SCHEMA_VERSION,
  type PaperSize,
  type TemplateDocument,
  type TemplateMedia,
} from '../TemplateDocument';
import { TemplateNodeIdGenerator, type BuildContext } from './BuildContext';
import type { TemplateNodeBuilder } from './NodeBuilder';
import { TemplateScope } from './TemplateScope';

/** Phần catalog mà DSL cần: tên biến/collection để kiểm tra kiểu, `id` + `describe()` để validate. */
export interface CatalogShape {
  readonly id: string;

  readonly variables: object;

  readonly collections: object;

  describe(): CatalogDescription;
}

/** Scope gốc của template: biến gốc + collection cấp 1 của catalog. */
export type RootScope<TCatalog extends CatalogShape> = TemplateScope<
  Extract<keyof TCatalog['variables'], string>,
  TCatalog['collections']
>;

/** Khổ giấy theo loại: label bắt buộc có chiều cao, receipt không có. */
export type PaperFor<TMedia extends TemplateMedia> = TMedia extends 'label'
  ? Required<PaperSize>
  : Omit<PaperSize, 'heightMm'>;

/** Nội dung gốc: 1 builder, hoặc callback nhận scope gốc để dùng `scope.var`/`scope.repeat`. */
export type RootContent<TCatalog extends CatalogShape> =
  | TemplateNodeBuilder
  | ((scope: RootScope<TCatalog>) => TemplateNodeBuilder);

/** Lỗi khi `build()` gặp template không hợp lệ; `issues` chứa từng lỗi kèm vị trí. */
export class TemplateBuildError extends Error {
  constructor(readonly issues: readonly TemplateIssue[]) {
    super(`Template không hợp lệ:\n${issues.map((issue) => `- ${issue.path}: ${issue.message}`).join('\n')}`);
    this.name = 'TemplateBuildError';
  }
}

/** Builder của `TemplateDocument`; tạo qua `labelTemplate(catalog)` hoặc `receiptTemplate(catalog)`. */
export class TemplateDocumentBuilder<TCatalog extends CatalogShape, TMedia extends TemplateMedia> {
  private templateId?: string;

  private templateName?: string;

  private paperSize?: PaperFor<TMedia>;

  private rootContent?: RootContent<TCatalog>;

  constructor(
    private readonly catalog: TCatalog,
    private readonly media: TMedia,
  ) {}

  /** Mã template (bắt buộc). */
  id(value: string): this {
    this.templateId = value;
    return this;
  }

  /** Tên hiển thị (bắt buộc). */
  name(value: string): this {
    this.templateName = value;
    return this;
  }

  /** Khổ giấy tính bằng mm (bắt buộc). */
  paper(value: PaperFor<TMedia>): this {
    this.paperSize = value;
    return this;
  }

  /** Node gốc (bắt buộc). */
  root(content: RootContent<TCatalog>): this {
    this.rootContent = content;
    return this;
  }

  /**
   * Tạo `TemplateDocument` JSON thuần. Throw `TemplateBuildError` nếu cấu trúc sai hoặc biến không khớp catalog
   * (sai scope, sai kiểu...); cảnh báo `deprecated` không chặn.
   */
  build(): TemplateDocument {
    const document = this.assemble();
    const structureIssues = validateTemplateStructure(document);
    if (structureIssues.length > 0) throw new TemplateBuildError(structureIssues);

    const catalogResult = validateTemplateAgainstCatalog(document, this.catalog.describe());
    if (catalogResult.errors.length > 0) throw new TemplateBuildError(catalogResult.errors);

    return Object.freeze(document);
  }

  private assemble(): TemplateDocument {
    if (this.templateId === undefined) throw new Error('Template cần .id(...)');
    if (this.templateName === undefined) throw new Error('Template cần .name(...)');
    if (this.paperSize === undefined) throw new Error('Template cần .paper(...)');
    if (this.rootContent === undefined) throw new Error('Template cần .root(...)');

    const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
    const rootBuilder =
      typeof this.rootContent === 'function' ? this.rootContent(new TemplateScope()) : this.rootContent;

    return {
      schemaVersion: TEMPLATE_SCHEMA_VERSION,
      id: this.templateId,
      name: this.templateName,
      catalog: this.catalog.id,
      media: this.media,
      locale: 'vi-VN',
      paper: this.paperSize,
      root: rootBuilder.build(context),
    };
  }
}

/** Template tem nhãn (chiều cao cố định, có phân trang) dùng biến của `catalog`. */
export function labelTemplate<TCatalog extends CatalogShape>(
  catalog: TCatalog,
): TemplateDocumentBuilder<TCatalog, 'label'> {
  return new TemplateDocumentBuilder(catalog, 'label');
}

/** Template hoá đơn giấy cuộn dùng biến của `catalog`. */
export function receiptTemplate<TCatalog extends CatalogShape>(
  catalog: TCatalog,
): TemplateDocumentBuilder<TCatalog, 'receipt'> {
  return new TemplateDocumentBuilder(catalog, 'receipt');
}
```

`packages/printer-core/src/template/builder/index.ts`:

```ts
export { mm, pt, px, insets } from './lengths';
export { fixed, fill, auto } from './dimensions';
export { exists, notEmpty, eq, neq, gt, gte, lt, lte, and, or, not } from './conditions';
export { TemplateNodeBuilder, NodeBuilder } from './NodeBuilder';
export { column, row, ContainerBuilder } from './ContainerBuilder';
export { text, TextBuilder } from './TextBuilder';
export { barcode, BarcodeBuilder } from './BarcodeBuilder';
export { qrcode, QrCodeBuilder } from './QrCodeBuilder';
export { image, ImageBuilder } from './ImageBuilder';
export { line, LineBuilder } from './LineBuilder';
export { RepeatBuilder, type RepeatOptions } from './RepeatBuilder';
export { TemplateScope, type RepeatScope } from './TemplateScope';
export type { SegmentInput } from './segments';
export {
  labelTemplate,
  receiptTemplate,
  TemplateDocumentBuilder,
  TemplateBuildError,
  type CatalogShape,
  type RootScope,
  type PaperFor,
  type RootContent,
} from './TemplateDocumentBuilder';
```

Thêm vào cuối `packages/printer-core/src/template/index.ts`:

```ts
export * from './builder';
```

- [ ] **Step 6: Chạy test, xác nhận pass**

Run: `npx jest packages/printer-core/src/template packages/printer-core/src/catalog`
Expected: PASS — toàn bộ suite của `template/` + `catalog/` (builder: 10 suites).

- [ ] **Step 7: Verify (scoped) — gồm test kiểu `@ts-expect-error`**

```bash
npx tsc --noEmit -p packages/printer-core/tsconfig.json 2>&1 | grep -E "src/(catalog|template|testing)/"
npx eslint packages/printer-core/src/template
```

Expected: tsc lọc không in dòng nào — đặc biệt không có `Unused '@ts-expect-error' directive` (nghĩa là DSL chặn đúng tên biến sai/biến sai scope/khổ giấy sai loại); eslint 0 error. Line-length với `packages/printer-core/src/template/builder`.

- [ ] **Step 8: Commit**

```bash
git add packages/printer-core/src/template/builder packages/printer-core/src/template/index.ts
git commit -m "feat: rewrite template DSL with catalog-typed scopes and build-time validation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Viết lại `resolution/`

**Files:**
- Create: `packages/printer-core/src/resolution/AssetProvider.ts`, `ResolveError.ts`, `ResolveContext.ts`, `readVariable.ts`, `resolveContent.ts`, `evaluateCondition.ts`, `readRepeatEntries.ts`, `resolveNode.ts`, `countPages.ts`, `collectAssetIds.ts`
- Replace: `packages/printer-core/src/resolution/ResolvedNode.ts`, `ResolvedPage.ts`, `DocumentResolver.ts`, `index.ts`
- Delete: `packages/printer-core/src/resolution/PrintData.ts`, `resolution/__tests__/DocumentResolver.test.ts`, `resolution/__tests__/DocumentResolver.pagination.test.ts`, `resolution/__tests__/ResolvedNode.test.ts`
- Test: `packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts` (mới), `collectAssetIds.test.ts`

**Interfaces:**
- Consumes: `Catalog`, `createCatalogIndex`, `isBuiltInVariableName`, `VariableType` (Task 1); `formatValue`, node/style types, `TemplateDocument` (Task 2-3); `TEST_ORDER_CATALOG`, `TEST_ORDER_SAMPLE`, `TestOrder` (Task 1).
- Produces:
  - `AssetProvider { get(assetId): Bitmap | undefined }`
  - `ResolvedNode` = `ResolvedContainer | ResolvedText { value; style? } | ResolvedLine { thickness?: Length; pattern: LinePattern; style? } | ResolvedBarcode { value; symbology; readable?; barHeight?: Length; style? } | ResolvedQrCode { value; errorCorrection?; moduleSize?: Length; style? } | ResolvedImage { bitmap; style? }` — kích thước vẫn là `Length`
  - `ResolvedPage` (ok/error, không đổi shape), `ResolveError`
  - `DocumentResolver.resolve<TData>(template, data: TData, options: ResolveOptions<TData>): readonly ResolvedPage[]` với `ResolveOptions<TData> { catalog: Catalog<TData>; assets: AssetProvider }`; `createDocumentResolver()`
  - `collectAssetIds<TData>(template, catalog, data): readonly string[]`

- [ ] **Step 1: Xoá file cũ**

```bash
git rm packages/printer-core/src/resolution/PrintData.ts packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts packages/printer-core/src/resolution/__tests__/DocumentResolver.pagination.test.ts packages/printer-core/src/resolution/__tests__/ResolvedNode.test.ts
```

- [ ] **Step 2: Viết test**

`packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts`:

```ts
import { createDocumentResolver, type AssetProvider, type ResolvedNode, type ResolvedPage } from '..';
import { defineCatalog, defineCollection } from '../../catalog';
import type { TemplateDocument, TemplateMedia, TemplateNode } from '../../template';
import { TEST_ORDER_CATALOG, TEST_ORDER_SAMPLE, type TestOrder } from '../../testing';
import type { Bitmap } from '../../types';

const LOGO_BITMAP: Bitmap = { data: new Uint8Array(8), width: 8, height: 8, bytesPerRow: 1 };
const NO_ASSETS: AssetProvider = { get: () => undefined };
const LOGO_ASSETS: AssetProvider = { get: (assetId) => (assetId === 'store-logo@v1' ? LOGO_BITMAP : undefined) };

const resolver = createDocumentResolver();

function documentWith(root: TemplateNode, media: TemplateMedia = 'receipt'): TemplateDocument {
  return {
    schemaVersion: 1,
    id: 'template',
    name: 'Template',
    catalog: 'test-order',
    media,
    locale: 'vi-VN',
    paper: media === 'label' ? { widthMm: 50, heightMm: 30 } : { widthMm: 72 },
    root,
  };
}

function resolvePages(
  root: TemplateNode,
  data: TestOrder = TEST_ORDER_SAMPLE,
  assets: AssetProvider = NO_ASSETS,
): readonly ResolvedPage[] {
  return resolver.resolve(documentWith(root), data, { catalog: TEST_ORDER_CATALOG, assets });
}

/** Mọi chuỗi text trong cây, theo thứ tự duyệt. */
function textsOf(node: ResolvedNode): readonly string[] {
  if (node.type === 'text') return [node.value];
  if (node.type === 'container') return node.children.flatMap(textsOf);
  return [];
}

function pageTexts(page: ResolvedPage): readonly string[] {
  if (page.status !== 'ok') throw new Error(`trang ${page.pageIndex} lỗi: ${page.message}`);
  return textsOf(page.node);
}

function itemLabel(): TemplateNode {
  return {
    type: 'repeat',
    id: 'items',
    collection: 'items',
    expand: 'quantity',
    maxItemsPerPage: 1,
    template: {
      type: 'text',
      id: 'label',
      content: [
        { var: 'itemName' },
        { text: ' ' },
        { var: '$position' },
        { text: '/' },
        { var: '$total' },
        { text: ' ly ' },
        { var: '$unit' },
        { text: '/' },
        { var: '$unitCount' },
      ],
    },
  };
}

describe('DocumentResolver — nội dung', () => {
  it('ghép segment chữ + biến, format mặc định theo kiểu và format khai báo', () => {
    const root: TemplateNode = {
      type: 'text',
      id: 'header',
      content: [
        { var: 'tableName' },
        { text: ' · ' },
        { var: 'createdAt', format: { type: 'datetime', pattern: 'HH:mm' } },
        { text: ' · giảm ' },
        { var: 'discount' },
      ],
    };

    expect(pageTexts(resolvePages(root)[0])).toEqual(['Bàn 5 · 10:30 · giảm 5.000đ']);
  });

  it('biến optional rỗng in chuỗi rỗng', () => {
    const root: TemplateNode = { type: 'text', id: 'table', content: [{ text: 'Bàn: ' }, { var: 'tableName' }] };
    const takeAway: TestOrder = { ...TEST_ORDER_SAMPLE, tableName: undefined };

    expect(pageTexts(resolvePages(root, takeAway)[0])).toEqual(['Bàn: ']);
  });

  it('biến bắt buộc rỗng thành trang lỗi có nodeId', () => {
    const root: TemplateNode = { type: 'text', id: 'code', content: [{ var: 'orderCode' }] };
    const noCode = { ...TEST_ORDER_SAMPLE, code: undefined } as unknown as TestOrder;

    expect(resolvePages(root, noCode)).toEqual([
      { status: 'error', pageIndex: 0, nodeId: 'code', message: 'biến "orderCode" không có giá trị' },
    ]);
  });

  it('giá trị không hợp format thành trang lỗi', () => {
    const root: TemplateNode = { type: 'text', id: 'time', content: [{ var: 'createdAt' }] };
    const badTime: TestOrder = { ...TEST_ORDER_SAMPLE, createdAt: 'hôm qua' };
    const [page] = resolvePages(root, badTime);

    expect(page.status).toBe('error');
    if (page.status === 'error') expect(page.message).toContain('biến "createdAt"');
  });

  it('barcode/QR dùng chung segment', () => {
    const root: TemplateNode = {
      type: 'container',
      id: 'root',
      children: [
        { type: 'barcode', id: 'barcode', content: [{ var: 'orderCode' }], symbology: 'code128' },
        { type: 'qrcode', id: 'qr', content: [{ text: 'https://ndt.vn/o/' }, { var: 'orderCode' }] },
      ],
    };
    const [page] = resolvePages(root);

    expect(page.status === 'ok' && page.node.type === 'container' && page.node.children).toEqual([
      { type: 'barcode', id: 'barcode', value: 'HD001', symbology: 'code128' },
      { type: 'qrcode', id: 'qr', value: 'https://ndt.vn/o/HD001' },
    ]);
  });
});

describe('DocumentResolver — scope tường minh', () => {
  it('biến collection dùng ngoài vòng lặp thành trang lỗi', () => {
    const root: TemplateNode = { type: 'text', id: 'name', content: [{ var: 'itemName' }] };

    expect(resolvePages(root)[0]).toMatchObject({ status: 'error', nodeId: 'name' });
  });

  it('biến gốc trong vòng lặp luôn đọc từ data gốc, không bị field trùng tên của phần tử che', () => {
    const lines = defineCollection({
      label: 'Dòng',
      get: (order: { readonly lines: readonly { readonly code: string }[] }) => order.lines,
      variables: { lineCode: { label: 'Mã dòng', type: 'string', get: (line) => line.code } },
    });
    const catalog = defineCatalog({
      id: 'shadow',
      version: 1,
      sample: { code: 'ORDER', lines: [{ code: 'LINE' }] },
      variables: { orderCode: { label: 'Mã đơn', type: 'string', get: (order) => order.code } },
      collections: { lines },
    });
    const template: TemplateDocument = {
      ...documentWith({
        type: 'repeat',
        id: 'lines',
        collection: 'lines',
        template: { type: 'text', id: 'text', content: [{ var: 'orderCode' }, { text: '/' }, { var: 'lineCode' }] },
      }),
      catalog: 'shadow',
    };

    const [page] = resolver.resolve(template, catalog.sample, { catalog, assets: NO_ASSETS });

    expect(pageTexts(page)).toEqual(['ORDER/LINE']);
  });

  it('collection lồng đọc từ phần tử của collection cha', () => {
    const root: TemplateNode = {
      type: 'repeat',
      id: 'items',
      collection: 'items',
      template: {
        type: 'repeat',
        id: 'toppings',
        collection: 'toppings',
        template: {
          type: 'text',
          id: 'topping',
          content: [{ var: 'itemName' }, { text: ' + ' }, { var: 'toppingName' }],
        },
      },
    };

    expect(pageTexts(resolvePages(root)[0])).toEqual(['Trà sữa + Trân châu']);
  });
});

describe('DocumentResolver — lặp, expand, phân trang', () => {
  it('expand mỗi ly 1 tem: $position/$total tính sau expand, $unit/$unitCount theo từng món', () => {
    const pages = resolvePages(itemLabel());

    expect(pages.map((page) => pageTexts(page)[0])).toEqual([
      'Trà sữa 1/5 ly 1/3',
      'Trà sữa 2/5 ly 2/3',
      'Trà sữa 3/5 ly 3/3',
      'Cà phê 4/5 ly 1/2',
      'Cà phê 5/5 ly 2/2',
    ]);
  });

  it('maxItemsPerPage áp dụng trên danh sách sau expand', () => {
    const root: TemplateNode = { ...itemLabel(), maxItemsPerPage: 2 } as TemplateNode;
    const pages = resolvePages(root);

    expect(pages.map((page) => pageTexts(page).length)).toEqual([2, 2, 1]);
  });

  it('$page/$pageCount dùng được ở mọi chỗ', () => {
    const root: TemplateNode = {
      type: 'container',
      id: 'root',
      children: [
        itemLabel(),
        {
          type: 'text',
          id: 'footer',
          content: [{ text: 'Trang ' }, { var: '$page' }, { text: '/' }, { var: '$pageCount' }],
        },
      ],
    };

    expect(resolvePages(root).map((page) => pageTexts(page)[1])).toEqual([
      'Trang 1/5',
      'Trang 2/5',
      'Trang 3/5',
      'Trang 4/5',
      'Trang 5/5',
    ]);
  });

  it('repeat không phân trang in mọi phần tử trên 1 trang', () => {
    const root: TemplateNode = {
      type: 'repeat',
      id: 'items',
      collection: 'items',
      template: { type: 'text', id: 'name', content: [{ var: 'itemName' }] },
    };

    expect(resolvePages(root).map(pageTexts)).toEqual([['Trà sữa', 'Cà phê']]);
  });

  it('repeat bị ẩn không tạo thêm trang', () => {
    const root: TemplateNode = { ...itemLabel(), visibleWhen: { op: 'eq', var: 'orderCode', value: 'KHÁC' } };

    expect(resolvePages(root)).toHaveLength(1);
  });

  it('expand không phải số nguyên dương thành trang lỗi', () => {
    const zeroQuantity: TestOrder = {
      ...TEST_ORDER_SAMPLE,
      items: [{ ...TEST_ORDER_SAMPLE.items[0], quantity: 0 }],
    };

    expect(resolvePages(itemLabel(), zeroQuantity)).toEqual([
      {
        status: 'error',
        pageIndex: 0,
        nodeId: 'items',
        message: 'expand "quantity" phải là số nguyên dương, nhận "0"',
      },
    ]);
  });

  it('collection không phải mảng thành trang lỗi thay vì throw', () => {
    const broken = { ...TEST_ORDER_SAMPLE, items: undefined } as unknown as TestOrder;

    expect(resolvePages(itemLabel(), broken)[0]).toMatchObject({ status: 'error', nodeId: 'items' });
  });
});

describe('DocumentResolver — điều kiện', () => {
  function visibleTextFor(condition: NonNullable<TemplateNode['visibleWhen']>): readonly string[] {
    const root: TemplateNode = { type: 'text', id: 'text', content: [{ text: 'X' }], visibleWhen: condition };
    return pageTexts(resolvePages(root)[0]);
  }

  it.each([
    [{ op: 'exists', var: 'tableName' }, ['X']],
    [{ op: 'notEmpty', var: 'tableName' }, ['X']],
    [{ op: 'eq', var: 'orderCode', value: 'HD001' }, ['X']],
    [{ op: 'neq', var: 'orderCode', value: 'HD001' }, []],
    [{ op: 'gt', var: 'discount', value: 0 }, ['X']],
    [{ op: 'gte', var: 'discount', value: 5000 }, ['X']],
    [{ op: 'lt', var: 'discount', value: 5000 }, []],
    [{ op: 'lte', var: 'discount', value: 4999 }, []],
    [{ op: 'gt', var: 'orderCode', value: 0 }, []],
    [{ op: 'and', conditions: [{ op: 'exists', var: 'tableName' }, { op: 'gt', var: 'discount', value: 0 }] }, ['X']],
    [{ op: 'or', conditions: [{ op: 'lt', var: 'discount', value: 0 }, { op: 'exists', var: 'orderCode' }] }, ['X']],
    [{ op: 'not', condition: { op: 'exists', var: 'tableName' } }, []],
  ] as const)('%j', (condition, expected) => {
    expect(visibleTextFor(condition)).toEqual(expected);
  });

  it('notEmpty sai với chuỗi rỗng, exists đúng', () => {
    const emptyTable: TestOrder = { ...TEST_ORDER_SAMPLE, tableName: '' };
    const root: TemplateNode = {
      type: 'container',
      id: 'root',
      children: [
        { type: 'text', id: 'a', content: [{ text: 'exists' }], visibleWhen: { op: 'exists', var: 'tableName' } },
        { type: 'text', id: 'b', content: [{ text: 'notEmpty' }], visibleWhen: { op: 'notEmpty', var: 'tableName' } },
      ],
    };

    expect(pageTexts(resolvePages(root, emptyTable)[0])).toEqual(['exists']);
  });
});

describe('DocumentResolver — ảnh', () => {
  it('tra bitmap theo mã asset lấy từ biến', () => {
    const root: TemplateNode = { type: 'image', id: 'logo', source: { var: 'storeLogo' } };
    const [page] = resolvePages(root, TEST_ORDER_SAMPLE, LOGO_ASSETS);

    expect(page).toEqual({ status: 'ok', pageIndex: 0, node: { type: 'image', id: 'logo', bitmap: LOGO_BITMAP } });
  });

  it('biến ảnh optional rỗng thì bỏ qua ảnh', () => {
    const root: TemplateNode = {
      type: 'container',
      id: 'root',
      children: [{ type: 'image', id: 'logo', source: { var: 'storeLogo' } }],
    };
    const noLogo: TestOrder = { ...TEST_ORDER_SAMPLE, storeLogo: undefined };
    const [page] = resolvePages(root, noLogo, LOGO_ASSETS);

    expect(page.status === 'ok' && page.node.type === 'container' && page.node.children).toEqual([]);
  });

  it('thiếu asset chỉ làm lỗi đúng trang cần ảnh đó, trang khác vẫn in được', () => {
    const root: TemplateNode = {
      ...itemLabel(),
      template: {
        type: 'container',
        id: 'item',
        children: [
          { type: 'text', id: 'name', content: [{ var: 'itemName' }] },
          {
            type: 'image',
            id: 'coffee-icon',
            source: { asset: 'coffee@v1' },
            visibleWhen: { op: 'eq', var: 'itemName', value: 'Cà phê' },
          },
        ],
      },
    } as TemplateNode;

    const statuses = resolvePages(root).map((page) => page.status);

    expect(statuses).toEqual(['ok', 'ok', 'ok', 'error', 'error']);
  });
});

describe('DocumentResolver — catalog', () => {
  it('throw khi template dùng catalog khác catalog truyền vào', () => {
    const template = { ...documentWith({ type: 'text', id: 't', content: [] }), catalog: 'kitchen' };

    const options = { catalog: TEST_ORDER_CATALOG, assets: NO_ASSETS };

    expect(() => resolver.resolve(template, TEST_ORDER_SAMPLE, options)).toThrow(
      'Template dùng catalog "kitchen", không phải "test-order"',
    );
  });
});
```

`packages/printer-core/src/resolution/__tests__/collectAssetIds.test.ts`:

```ts
import { collectAssetIds } from '..';
import type { TemplateDocument } from '../../template';
import { TEST_ORDER_CATALOG, TEST_ORDER_SAMPLE } from '../../testing';

const TEMPLATE: TemplateDocument = {
  schemaVersion: 1,
  id: 'template',
  name: 'Template',
  catalog: 'test-order',
  media: 'receipt',
  locale: 'vi-VN',
  paper: { widthMm: 72 },
  root: {
    type: 'container',
    id: 'root',
    children: [
      { type: 'image', id: 'logo', source: { var: 'storeLogo' } },
      {
        type: 'image',
        id: 'hidden-icon',
        source: { asset: 'icon@v1' },
        visibleWhen: { op: 'eq', var: 'orderCode', value: 'X' },
      },
      {
        type: 'repeat',
        id: 'items',
        collection: 'items',
        template: { type: 'image', id: 'cup', source: { asset: 'cup@v2' } },
      },
      { type: 'image', id: 'logo-again', source: { var: 'storeLogo' } },
    ],
  },
};

describe('collectAssetIds', () => {
  it('thu asset tĩnh + giá trị biến asset, bỏ qua điều kiện ẩn/hiện, không trùng lặp', () => {
    expect(collectAssetIds(TEMPLATE, TEST_ORDER_CATALOG, TEST_ORDER_SAMPLE)).toEqual([
      'store-logo@v1',
      'icon@v1',
      'cup@v2',
    ]);
  });

  it('bỏ qua biến asset rỗng', () => {
    const noLogo = { ...TEST_ORDER_SAMPLE, storeLogo: undefined };

    expect(collectAssetIds(TEMPLATE, TEST_ORDER_CATALOG, noLogo)).toEqual(['icon@v1', 'cup@v2']);
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `npx jest packages/printer-core/src/resolution`
Expected: FAIL — `index.ts` cũ còn export `./PrintData` đã xoá (`Cannot find module './PrintData'`).

- [ ] **Step 4: Viết type + context**

`packages/printer-core/src/resolution/AssetProvider.ts`:

```ts
import type { Bitmap } from '../types';

/** Nguồn ảnh đã decode sẵn, tra đồng bộ theo mã asset. App tự tải + decode trước khi resolve. */
export interface AssetProvider {
  /** Bitmap của asset; `undefined` nếu chưa tải được. */
  get(assetId: string): Bitmap | undefined;
}
```

`packages/printer-core/src/resolution/ResolvedNode.ts`:

```ts
import type { BarcodeSymbology, QrErrorCorrectionLevel } from '../symbology';
import type { BoxStyle, LayoutStyle, Length, LinePattern, TextStyle } from '../template';
import type { Bitmap } from '../types';

/** Node sau khi resolve: giá trị đã thành chuỗi, kích thước vẫn là `Length` (Layout mới đổi sang dots). */
export type ResolvedNode =
  | ResolvedContainer
  | ResolvedText
  | ResolvedLine
  | ResolvedBarcode
  | ResolvedQrCode
  | ResolvedImage;

/** Container; `repeat` cũng resolve thành container chứa các bản lặp. */
export interface ResolvedContainer {
  readonly type: 'container';

  readonly id: string;

  readonly style?: LayoutStyle;

  readonly children: readonly ResolvedNode[];
}

/** Đoạn chữ đã ghép + format xong. */
export interface ResolvedText {
  readonly type: 'text';

  readonly id: string;

  /** Chuỗi cần in. */
  readonly value: string;

  readonly style?: BoxStyle & TextStyle;
}

/** Đường kẻ ngang. */
export interface ResolvedLine {
  readonly type: 'line';

  readonly id: string;

  /** Độ dày nét; bỏ trống là mặc định của máy in. */
  readonly thickness?: Length;

  readonly pattern: LinePattern;

  readonly style?: BoxStyle;
}

/** Mã vạch 1D. */
export interface ResolvedBarcode {
  readonly type: 'barcode';

  readonly id: string;

  /** Dữ liệu mã hoá. */
  readonly value: string;

  readonly symbology: BarcodeSymbology;

  /** In kèm chữ đọc được. */
  readonly readable?: boolean;

  /** Chiều cao vạch. */
  readonly barHeight?: Length;

  readonly style?: BoxStyle;
}

/** Mã QR. */
export interface ResolvedQrCode {
  readonly type: 'qrcode';

  readonly id: string;

  /** Dữ liệu mã hoá. */
  readonly value: string;

  readonly errorCorrection?: QrErrorCorrectionLevel;

  /** Cạnh 1 module. */
  readonly moduleSize?: Length;

  readonly style?: BoxStyle;
}

/** Ảnh đã tra được bitmap từ `AssetProvider`. */
export interface ResolvedImage {
  readonly type: 'image';

  readonly id: string;

  /** Bitmap 1-bit; mỗi pixel là 1 dot khi in. */
  readonly bitmap: Bitmap;

  readonly style?: BoxStyle;
}
```

`packages/printer-core/src/resolution/ResolvedPage.ts`:

```ts
import type { ResolvedNode } from './ResolvedNode';

/** Kết quả resolve 1 trang: thành công, hoặc lỗi cô lập trong trang đó (trang khác vẫn in được). */
export type ResolvedPage =
  | { readonly status: 'ok'; readonly pageIndex: number; readonly node: ResolvedNode }
  | { readonly status: 'error'; readonly pageIndex: number; readonly nodeId: string; readonly message: string };
```

`packages/printer-core/src/resolution/ResolveError.ts`:

```ts
/** Lỗi resolve gắn với 1 node — `DocumentResolver` bắt lại và chuyển thành trang lỗi. */
export class ResolveError extends Error {
  constructor(
    readonly nodeId: string,
    message: string,
  ) {
    super(message);
    this.name = 'ResolveError';
  }
}

/** Lấy message của lỗi bất kỳ. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

`packages/printer-core/src/resolution/ResolveContext.ts`:

```ts
import type { Catalog, CatalogIndex } from '../catalog';
import type { AssetProvider } from './AssetProvider';

/** Phần catalog mà resolver cần — không phụ thuộc kiểu data. */
export type CatalogReader = Pick<Catalog<unknown>, 'id' | 'describe' | 'readVariable' | 'readCollection'>;

/** 1 tầng scope: data gốc, hoặc 1 phần tử đang lặp. */
export interface ScopeFrame {
  /** Collection của phần tử; `null` là data gốc. */
  readonly collection: string | null;

  /** Data gốc hoặc phần tử hiện tại. */
  readonly item: unknown;

  /** Thứ tự phần tử (từ 1) trong danh sách sau expand; 0 ở tầng gốc. */
  readonly position: number;

  /** Tổng số phần tử sau expand; 0 ở tầng gốc. */
  readonly total: number;

  /** Thứ tự bản sao (từ 1) của phần tử khi expand; 1 nếu không expand, 0 ở tầng gốc. */
  readonly unit: number;

  /** Tổng số bản sao của phần tử; 1 nếu không expand, 0 ở tầng gốc. */
  readonly unitCount: number;
}

/** Thông tin trang đang resolve. */
export interface PageInfo {
  /** Số trang, đếm từ 1. */
  readonly pageNumber: number;

  /** Tổng số trang. */
  readonly pageCount: number;
}

/** Trạng thái khi resolve 1 node. */
export interface ResolveContext {
  readonly catalog: CatalogReader;

  /** Bảng tra biến/collection dựng từ `catalog.describe()`. */
  readonly index: CatalogIndex;

  readonly assets: AssetProvider;

  /** Stack scope tường minh: `[data gốc, phần tử cấp 1, phần tử cấp 2...]`. */
  readonly frames: readonly ScopeFrame[];

  readonly page: PageInfo;
}

/** Tầng scope gốc chứa data của cả document. */
export function createRootFrame(data: unknown): ScopeFrame {
  return { collection: null, item: data, position: 0, total: 0, unit: 0, unitCount: 0 };
}

/** Context mới với thêm 1 tầng scope ở trong cùng. */
export function pushFrame(context: ResolveContext, frame: ScopeFrame): ResolveContext {
  return { ...context, frames: [...context.frames, frame] };
}

/** Tầng scope trong cùng của `collection` (`null` là tầng gốc); `undefined` nếu không nằm trong vòng lặp đó. */
export function findScopeFrame(context: ResolveContext, collection: string | null): ScopeFrame | undefined {
  for (let index = context.frames.length - 1; index >= 0; index--) {
    if (context.frames[index].collection === collection) return context.frames[index];
  }
  return undefined;
}

/** Tầng scope trong cùng. */
export function innermostFrame(context: ResolveContext): ScopeFrame {
  return context.frames[context.frames.length - 1];
}
```

- [ ] **Step 5: Viết đọc biến, nội dung, điều kiện, repeat**

`packages/printer-core/src/resolution/readVariable.ts`:

```ts
import { isBuiltInVariableName, type BuiltInVariableName, type VariableType } from '../catalog';
import { findScopeFrame, innermostFrame, type ResolveContext } from './ResolveContext';
import { errorMessage, ResolveError } from './ResolveError';

type BuiltInVariableReader = (context: ResolveContext) => number;

const BUILT_IN_VARIABLE_READERS: Readonly<Record<BuiltInVariableName, BuiltInVariableReader>> = {
  $position: (context) => innermostFrame(context).position,
  $total: (context) => innermostFrame(context).total,
  $unit: (context) => innermostFrame(context).unit,
  $unitCount: (context) => innermostFrame(context).unitCount,
  $page: (context) => context.page.pageNumber,
  $pageCount: (context) => context.page.pageCount,
};

/**
 * Giá trị raw của biến (chưa format, có thể `undefined`). Biến collection lấy từ đúng tầng scope của
 * collection đó — không dò ngược lên scope ngoài, nên không bao giờ khớp nhầm biến trùng tên.
 */
export function readVariableValue(
  context: ResolveContext,
  name: string,
  nodeId: string,
): unknown {
  if (isBuiltInVariableName(name)) return BUILT_IN_VARIABLE_READERS[name](context);

  const variable = context.index.variables.get(name);
  if (!variable) throw new ResolveError(nodeId, `catalog không có biến "${name}"`);

  const frame = findScopeFrame(context, variable.collection);
  if (!frame) throw new ResolveError(nodeId, `biến "${name}" chỉ dùng được trong vòng lặp "${variable.collection}"`);

  return readFromCatalog(nodeId, name, () => context.catalog.readVariable(name, frame.item));
}

/** Kiểu của biến; biến có sẵn luôn là `number`. */
export function variableTypeOf(context: ResolveContext, name: string): VariableType {
  return context.index.variables.get(name)?.description.type ?? 'number';
}

/** Biến có được phép rỗng không; biến có sẵn luôn có giá trị. */
export function isOptionalVariable(context: ResolveContext, name: string): boolean {
  return context.index.variables.get(name)?.description.optional ?? false;
}

/** Gọi hàm `get` của catalog; lỗi trong `get` (data sai cấu trúc) thành lỗi trang thay vì làm hỏng cả lần in. */
export function readFromCatalog(
  nodeId: string,
  name: string,
  read: () => unknown,
): unknown {
  try {
    return read();
  } catch (error) {
    throw new ResolveError(nodeId, `không đọc được "${name}" từ data: ${errorMessage(error)}`);
  }
}
```

`packages/printer-core/src/resolution/resolveContent.ts`:

```ts
import { formatValue, type Segment, type VariableSegment } from '../template';
import { isOptionalVariable, readVariableValue, variableTypeOf } from './readVariable';
import type { ResolveContext } from './ResolveContext';
import { errorMessage, ResolveError } from './ResolveError';

/** Ghép các segment thành chuỗi cần in: segment chữ giữ nguyên, segment biến đọc + format. */
export function resolveContent(
  segments: readonly Segment[],
  context: ResolveContext,
  nodeId: string,
): string {
  return segments.map((segment) => resolveSegment(segment, context, nodeId)).join('');
}

function resolveSegment(
  segment: Segment,
  context: ResolveContext,
  nodeId: string,
): string {
  if (!('var' in segment)) return segment.text;

  const value = readVariableValue(context, segment.var, nodeId);
  if (value !== undefined && value !== null) return formatSegment(segment, value, context, nodeId);
  if (isOptionalVariable(context, segment.var)) return '';
  throw new ResolveError(nodeId, `biến "${segment.var}" không có giá trị`);
}

function formatSegment(
  segment: VariableSegment,
  value: unknown,
  context: ResolveContext,
  nodeId: string,
): string {
  try {
    return formatValue(value, segment.format, variableTypeOf(context, segment.var));
  } catch (error) {
    throw new ResolveError(nodeId, `biến "${segment.var}": ${errorMessage(error)}`);
  }
}
```

`packages/printer-core/src/resolution/evaluateCondition.ts`:

```ts
import type { ComparisonCondition, Condition, TemplateNode } from '../template';
import { readVariableValue } from './readVariable';
import type { ResolveContext } from './ResolveContext';

type NumericOperator = 'gt' | 'gte' | 'lt' | 'lte';

const NUMERIC_COMPARATORS: Readonly<Record<NumericOperator, (left: number, right: number) => boolean>> = {
  gt: (left, right) => left > right,
  gte: (left, right) => left >= right,
  lt: (left, right) => left < right,
  lte: (left, right) => left <= right,
};

/** Node có hiện không; không có `visibleWhen` là luôn hiện. */
export function isNodeVisible(node: TemplateNode, context: ResolveContext): boolean {
  return node.visibleWhen === undefined || evaluateCondition(node.visibleWhen, context, node.id);
}

/** Đánh giá điều kiện trên giá trị raw của biến (trước khi format). */
export function evaluateCondition(
  condition: Condition,
  context: ResolveContext,
  nodeId: string,
): boolean {
  switch (condition.op) {
    case 'and':
      return condition.conditions.every((child) => evaluateCondition(child, context, nodeId));
    case 'or':
      return condition.conditions.some((child) => evaluateCondition(child, context, nodeId));
    case 'not':
      return !evaluateCondition(condition.condition, context, nodeId);
    case 'exists':
      return hasValue(readVariableValue(context, condition.var, nodeId));
    case 'notEmpty':
      return isNotEmpty(readVariableValue(context, condition.var, nodeId));
    default:
      return compare(condition, readVariableValue(context, condition.var, nodeId));
  }
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function isNotEmpty(value: unknown): boolean {
  if (!hasValue(value) || value === '') return false;
  return !Array.isArray(value) || value.length > 0;
}

function compare(condition: ComparisonCondition, value: unknown): boolean {
  if (condition.op === 'eq') return value === condition.value;
  if (condition.op === 'neq') return value !== condition.value;

  // So sánh lớn/nhỏ chỉ có nghĩa với số; chuỗi như '45.000đ' không được so theo thứ tự chữ cái.
  if (typeof value !== 'number' || typeof condition.value !== 'number') return false;
  return NUMERIC_COMPARATORS[condition.op](value, condition.value);
}
```

`packages/printer-core/src/resolution/readRepeatEntries.ts`:

```ts
import type { RepeatNode } from '../template';
import { readFromCatalog } from './readVariable';
import { findScopeFrame, type ResolveContext } from './ResolveContext';
import { ResolveError } from './ResolveError';

/** 1 phần tử của `repeat` sau khi expand. */
export interface RepeatEntry {
  /** Phần tử gốc của collection (các bản sao dùng chung 1 phần tử). */
  readonly item: unknown;

  /** Thứ tự bản sao, từ 1. */
  readonly unit: number;

  /** Tổng số bản sao của phần tử. */
  readonly unitCount: number;
}

/** Đọc mảng phần tử của collection từ đúng tầng scope cha, rồi expand nếu có. */
export function readRepeatEntries(node: RepeatNode, context: ResolveContext): readonly RepeatEntry[] {
  return readCollectionItems(node, context).flatMap((item) => expandItem(node, item, context));
}

/** Mảng phần tử raw của collection (chưa expand). */
export function readCollectionItems(node: RepeatNode, context: ResolveContext): readonly unknown[] {
  const collection = context.index.collections.get(node.collection);
  if (!collection) throw new ResolveError(node.id, `catalog không có collection "${node.collection}"`);

  const parentFrame = findScopeFrame(context, collection.parent);
  if (!parentFrame) {
    const message = `collection "${node.collection}" chỉ lặp được trong vòng lặp "${collection.parent}"`;
    throw new ResolveError(node.id, message);
  }

  const items = readFromCatalog(node.id, node.collection, () =>
    context.catalog.readCollection(node.collection, parentFrame.item),
  );
  if (!Array.isArray(items)) throw new ResolveError(node.id, `collection "${node.collection}" không phải mảng`);
  return items;
}

function expandItem(
  node: RepeatNode,
  item: unknown,
  context: ResolveContext,
): readonly RepeatEntry[] {
  if (node.expand === undefined) return [{ item, unit: 1, unitCount: 1 }];

  const unitCount = readExpandCount(node, node.expand, item, context);
  return Array.from({ length: unitCount }, (_, index) => ({ item, unit: index + 1, unitCount }));
}

function readExpandCount(
  node: RepeatNode,
  expand: string,
  item: unknown,
  context: ResolveContext,
): number {
  const count = readFromCatalog(node.id, expand, () => context.catalog.readVariable(expand, item));
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
    throw new ResolveError(node.id, `expand "${expand}" phải là số nguyên dương, nhận "${String(count)}"`);
  }
  return count;
}
```

- [ ] **Step 6: Viết resolve node, đếm trang, resolver, thu asset**

`packages/printer-core/src/resolution/resolveNode.ts`:

```ts
import type {
  BarcodeNode,
  ContainerNode,
  ImageNode,
  LineNode,
  QrCodeNode,
  RepeatNode,
  TemplateNode,
  TextNode,
} from '../template';
import { isNodeVisible } from './evaluateCondition';
import { readRepeatEntries } from './readRepeatEntries';
import { isOptionalVariable, readVariableValue } from './readVariable';
import { resolveContent } from './resolveContent';
import { pushFrame, type ResolveContext } from './ResolveContext';
import type {
  ResolvedBarcode,
  ResolvedContainer,
  ResolvedImage,
  ResolvedLine,
  ResolvedNode,
  ResolvedQrCode,
  ResolvedText,
} from './ResolvedNode';
import { ResolveError } from './ResolveError';

/** Vị trí [start, end) của các phần tử `repeat` thuộc trang hiện tại. */
interface EntryRange {
  readonly start: number;

  readonly end: number;
}

/** Resolve 1 node và toàn bộ node con; trả `null` nếu node bị ẩn. */
export function resolveNode(node: TemplateNode, context: ResolveContext): ResolvedNode | null {
  if (!isNodeVisible(node, context)) return null;

  switch (node.type) {
    case 'container':
      return resolveContainer(node, context);
    case 'text':
      return resolveText(node, context);
    case 'line':
      return resolveLine(node);
    case 'barcode':
      return resolveBarcode(node, context);
    case 'qrcode':
      return resolveQrCode(node, context);
    case 'image':
      return resolveImage(node, context);
    case 'repeat':
      return resolveRepeat(node, context);
  }
}

function resolveChildren(nodes: readonly TemplateNode[], context: ResolveContext): readonly ResolvedNode[] {
  return nodes
    .map((child) => resolveNode(child, context))
    .filter((child): child is ResolvedNode => child !== null);
}

function resolveContainer(node: ContainerNode, context: ResolveContext): ResolvedContainer {
  return { type: 'container', id: node.id, style: node.style, children: resolveChildren(node.children, context) };
}

function resolveText(node: TextNode, context: ResolveContext): ResolvedText {
  return { type: 'text', id: node.id, value: resolveContent(node.content, context, node.id), style: node.style };
}

function resolveLine(node: LineNode): ResolvedLine {
  return { type: 'line', id: node.id, thickness: node.thickness, pattern: node.pattern ?? 'solid', style: node.style };
}

function resolveBarcode(node: BarcodeNode, context: ResolveContext): ResolvedBarcode {
  return {
    type: 'barcode',
    id: node.id,
    value: resolveContent(node.content, context, node.id),
    symbology: node.symbology,
    readable: node.readable,
    barHeight: node.barHeight,
    style: node.style,
  };
}

function resolveQrCode(node: QrCodeNode, context: ResolveContext): ResolvedQrCode {
  return {
    type: 'qrcode',
    id: node.id,
    value: resolveContent(node.content, context, node.id),
    errorCorrection: node.errorCorrection,
    moduleSize: node.moduleSize,
    style: node.style,
  };
}

function resolveImage(node: ImageNode, context: ResolveContext): ResolvedImage | null {
  const assetId = resolveAssetId(node, context);
  if (assetId === undefined) return null;

  const bitmap = context.assets.get(assetId);
  if (!bitmap) throw new ResolveError(node.id, `không tìm thấy asset "${assetId}"`);
  return { type: 'image', id: node.id, bitmap, style: node.style };
}

// Trả `undefined` khi biến ảnh optional không có giá trị: ảnh tuỳ chọn thì bỏ qua, không báo lỗi.
function resolveAssetId(node: ImageNode, context: ResolveContext): string | undefined {
  if ('asset' in node.source) return node.source.asset;

  const variable = node.source.var;
  const value = readVariableValue(context, variable, node.id);
  if ((value === undefined || value === null) && isOptionalVariable(context, variable)) return undefined;
  if (typeof value !== 'string' || value === '') {
    throw new ResolveError(node.id, `biến ảnh "${variable}" phải là mã asset, nhận "${String(value)}"`);
  }
  return value;
}

function resolveRepeat(node: RepeatNode, context: ResolveContext): ResolvedContainer {
  const entries = readRepeatEntries(node, context);
  const range = entryRangeForPage(node, context, entries.length);

  const children: ResolvedNode[] = [];
  for (let index = range.start; index < range.end; index++) {
    const entry = entries[index];
    const itemContext = pushFrame(context, {
      collection: node.collection,
      item: entry.item,
      position: index + 1,
      total: entries.length,
      unit: entry.unit,
      unitCount: entry.unitCount,
    });
    const child = resolveNode(node.template, itemContext);
    if (child) children.push(child);
  }
  return { type: 'container', id: node.id, children };
}

// Chỉ `repeat` cấp ngoài cùng (không nằm trong repeat khác) mới phân trang, giống hành vi cũ.
function entryRangeForPage(
  node: RepeatNode,
  context: ResolveContext,
  total: number,
): EntryRange {
  const perPage = node.maxItemsPerPage;
  if (perPage === undefined || context.frames.length > 1) return { start: 0, end: total };

  const start = (context.page.pageNumber - 1) * perPage;
  return { start, end: Math.min(total, start + perPage) };
}
```

`packages/printer-core/src/resolution/countPages.ts`:

```ts
import type { RepeatNode, TemplateNode } from '../template';
import { isNodeVisible } from './evaluateCondition';
import { readRepeatEntries } from './readRepeatEntries';
import type { ResolveContext } from './ResolveContext';
import { ResolveError } from './ResolveError';

/**
 * Số trang = max của các `repeat` cấp ngoài cùng có `maxItemsPerPage`, tính trên danh sách sau expand; tối thiểu 1.
 * Lỗi gặp khi đếm không chặn ở đây — lỗi đó sẽ hiện ra đúng trang khi resolve.
 */
export function countPages(root: TemplateNode, context: ResolveContext): number {
  return Math.max(1, ...collectPageCounts(root, context));
}

function collectPageCounts(node: TemplateNode, context: ResolveContext): readonly number[] {
  if (!isVisibleWhileCounting(node, context)) return [];

  if (node.type === 'container') return node.children.flatMap((child) => collectPageCounts(child, context));
  if (node.type === 'repeat') return [countRepeatPages(node, context)];
  return [];
}

// Repeat lồng không phân trang, nên không đi sâu vào `template` của repeat.
function countRepeatPages(node: RepeatNode, context: ResolveContext): number {
  const perPage = node.maxItemsPerPage;
  if (perPage === undefined) return 1;

  try {
    return Math.ceil(readRepeatEntries(node, context).length / perPage);
  } catch (error) {
    if (error instanceof ResolveError) return 1;
    throw error;
  }
}

function isVisibleWhileCounting(node: TemplateNode, context: ResolveContext): boolean {
  try {
    return isNodeVisible(node, context);
  } catch (error) {
    if (error instanceof ResolveError) return true;
    throw error;
  }
}
```

`packages/printer-core/src/resolution/DocumentResolver.ts`:

```ts
import { createCatalogIndex, type Catalog } from '../catalog';
import type { TemplateDocument, TemplateNode } from '../template';
import type { AssetProvider } from './AssetProvider';
import { countPages } from './countPages';
import { createRootFrame, type ResolveContext } from './ResolveContext';
import type { ResolvedPage } from './ResolvedPage';
import { ResolveError } from './ResolveError';
import { resolveNode } from './resolveNode';

/** Nguồn phụ trợ cho 1 lần resolve. */
export interface ResolveOptions<TData> {
  /** Catalog mà template dùng; `id` phải khớp `template.catalog`. */
  readonly catalog: Catalog<TData>;

  /** Ảnh đã tải + decode sẵn. */
  readonly assets: AssetProvider;
}

// Khi đếm trang chưa biết tổng số trang; điều kiện dùng `$page` ở bước đếm được coi như đang ở trang 1/1.
const COUNTING_PAGE = { pageNumber: 1, pageCount: 1 };

/** Ghép template với data qua catalog: giá trị biến, format, ẩn/hiện, lặp/expand/phân trang, tra ảnh. */
export class DocumentResolver {
  /**
   * Resolve thành các trang; lỗi data (thiếu biến bắt buộc, thiếu ảnh...) được cô lập theo trang.
   * Throw nếu template không dùng catalog được truyền vào — đó là lỗi lập trình, không phải lỗi data.
   */
  resolve<TData>(
    template: TemplateDocument,
    data: TData,
    options: ResolveOptions<TData>,
  ): readonly ResolvedPage[] {
    if (template.catalog !== options.catalog.id) {
      throw new Error(`Template dùng catalog "${template.catalog}", không phải "${options.catalog.id}"`);
    }

    const baseContext: ResolveContext = {
      catalog: options.catalog,
      index: createCatalogIndex(options.catalog.describe()),
      assets: options.assets,
      frames: [createRootFrame(data)],
      page: COUNTING_PAGE,
    };
    const pageCount = countPages(template.root, baseContext);

    return Array.from({ length: pageCount }, (_, pageIndex) =>
      resolvePage(template.root, { ...baseContext, page: { pageNumber: pageIndex + 1, pageCount } }),
    );
  }
}

function resolvePage(root: TemplateNode, context: ResolveContext): ResolvedPage {
  const pageIndex = context.page.pageNumber - 1;
  try {
    const node = resolveNode(root, context);
    return { status: 'ok', pageIndex, node: node ?? { type: 'container', id: root.id, children: [] } };
  } catch (error) {
    if (!(error instanceof ResolveError)) throw error;
    return { status: 'error', pageIndex, nodeId: error.nodeId, message: error.message };
  }
}

/** Tạo resolver. */
export function createDocumentResolver(): DocumentResolver {
  return new DocumentResolver();
}
```

`packages/printer-core/src/resolution/collectAssetIds.ts`:

```ts
import { createCatalogIndex, type Catalog } from '../catalog';
import type { ImageNode, RepeatNode, TemplateDocument, TemplateNode } from '../template';
import { readCollectionItems } from './readRepeatEntries';
import { readVariableValue } from './readVariable';
import { createRootFrame, pushFrame, type ResolveContext } from './ResolveContext';
import { ResolveError } from './ResolveError';

/** Asset rỗng — chỉ dùng khi duyệt cây để thu mã asset, không tra ảnh. */
const NO_ASSETS = { get: () => undefined };

/**
 * Mã asset cần tải trước khi resolve: asset tĩnh trong template + giá trị các biến kiểu `asset` đang dùng
 * (duyệt mọi phần tử của mọi `repeat`, bỏ qua điều kiện ẩn/hiện). Không trùng lặp, theo thứ tự gặp.
 */
export function collectAssetIds<TData>(
  template: TemplateDocument,
  catalog: Catalog<TData>,
  data: TData,
): readonly string[] {
  const context: ResolveContext = {
    catalog,
    index: createCatalogIndex(catalog.describe()),
    assets: NO_ASSETS,
    frames: [createRootFrame(data)],
    page: { pageNumber: 1, pageCount: 1 },
  };
  const assetIds = new Set<string>();
  collectFromNode(template.root, context, assetIds);
  return [...assetIds];
}

function collectFromNode(
  templateNode: TemplateNode,
  context: ResolveContext,
  assetIds: Set<string>,
): void {
  switch (templateNode.type) {
    case 'image':
      collectFromImage(templateNode, context, assetIds);
      return;
    case 'container':
      templateNode.children.forEach((child) => collectFromNode(child, context, assetIds));
      return;
    case 'repeat':
      collectFromRepeat(templateNode, context, assetIds);
      return;
    default:
      return;
  }
}

function collectFromImage(
  image: ImageNode,
  context: ResolveContext,
  assetIds: Set<string>,
): void {
  if ('asset' in image.source) {
    assetIds.add(image.source.asset);
    return;
  }

  const variable = image.source.var;
  const value = readOrUndefined(() => readVariableValue(context, variable, image.id));
  if (typeof value === 'string' && value !== '') assetIds.add(value);
}

function collectFromRepeat(
  repeat: RepeatNode,
  context: ResolveContext,
  assetIds: Set<string>,
): void {
  const items = readOrUndefined(() => readCollectionItems(repeat, context)) ?? [];
  for (const item of items) {
    const itemContext = pushFrame(context, {
      collection: repeat.collection,
      item,
      position: 0,
      total: 0,
      unit: 0,
      unitCount: 0,
    });
    collectFromNode(repeat.template, itemContext, assetIds);
  }
}

// Data lỗi thì bỏ qua ở bước thu mã asset; lỗi sẽ hiện ra đúng trang khi resolve.
function readOrUndefined<TValue>(read: () => TValue): TValue | undefined {
  try {
    return read();
  } catch (error) {
    if (error instanceof ResolveError) return undefined;
    throw error;
  }
}
```

`packages/printer-core/src/resolution/index.ts`:

```ts
export * from './AssetProvider';
export * from './ResolvedNode';
export * from './ResolvedPage';
export { ResolveError } from './ResolveError';
export { DocumentResolver, createDocumentResolver, type ResolveOptions } from './DocumentResolver';
export { collectAssetIds } from './collectAssetIds';
```

- [ ] **Step 7: Chạy test, xác nhận pass**

Run: `npx jest packages/printer-core/src/resolution`
Expected: PASS — 2 suites, 34 tests.

- [ ] **Step 8: Verify (scoped)**

```bash
npx tsc --noEmit -p packages/printer-core/tsconfig.json 2>&1 | grep -E "src/(catalog|template|testing|resolution)/"
npx eslint packages/printer-core/src/resolution
```

Expected: tsc lọc không in dòng nào (còn lỗi ở `layout/` và integration test cũ); eslint 0 error. Line-length với `packages/printer-core/src/resolution`.

- [ ] **Step 9: Commit**

```bash
git add packages/printer-core/src/resolution
git commit -m "refactor: resolve templates through catalog with explicit scope stack, expand and assets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `layout/` — đổi `Length → dots` theo DPI, nét đứt

**Files:**
- Create: `packages/printer-core/src/layout/lengthToDots.ts`, `LayoutNode.ts`, `toLayoutNode.ts`
- Replace: `packages/printer-core/src/layout/LayoutConfig.ts`, `FontMetrics.ts`, `LayoutEngine.ts`, `index.ts`
- Modify: `packages/printer-core/src/layout/ApproximateFontMetrics.ts`
- Replace test: `packages/printer-core/src/layout/__tests__/LayoutEngine.test.ts`, `LayoutEngine.sizing.test.ts`
- Test: `packages/printer-core/src/layout/__tests__/lengthToDots.test.ts`

**Interfaces:**
- Consumes: `ResolvedNode` (Task 6); `Length`, `LengthUnit`, `PaperSize`, `TemplateMedia`, style types, `DEFAULT_FONT_SIZE`, `mm/pt/px` (Task 2-5); `PrintElement` từ `../document`.
- Produces:
  - `LayoutConfig { paper: PaperSize; media: TemplateMedia; dpi: number }`
  - `lengthToDots(length, dpi)` = `round(value × dpi ÷ đơn vị/inch)`, `strokeLengthToDots` (tối thiểu 1), `paperSizeToDots(paper, dpi): PaperDots { widthDots; heightDots? }`
  - `LayoutNode` (dots): `LayoutContainer | LayoutText | LayoutLine { thickness?; dash?: LayoutDash } | LayoutBarcode { barHeight? } | LayoutQrCode { moduleSize? } | LayoutImage`; `LayoutTextStyle { fontSize?; fontWeight?; lineHeight? (dots); textAlign? }`
  - `FontMetrics.measure(text, style: LayoutTextStyle)`, `.wrap(text, maxWidthDots, style: LayoutTextStyle)`
  - `LayoutEngine.resolve(root: ResolvedNode, config: LayoutConfig, typography, fontMetrics): PrintElement[]` — barcode ra `options.height`, QR ra `options.cellWidth`, nét đứt ra nhiều `LineElement`

- [ ] **Step 1: Viết test**

`packages/printer-core/src/layout/__tests__/lengthToDots.test.ts`:

```ts
import { lengthToDots, paperSizeToDots, strokeLengthToDots } from '..';
import { mm, pt, px } from '../../template';

describe('lengthToDots', () => {
  it.each([
    [mm(25.4), 203, 203],
    [mm(2), 203, 16],
    [mm(2), 300, 24],
    [pt(72), 300, 300],
    [px(96), 203, 203],
    [px(16), 203, 34],
  ])('%j ở %i dpi = %i dots', (length, dpi, expected) => {
    expect(lengthToDots(length, dpi)).toBe(expected);
  });

  it('nét tối thiểu 1 dot', () => {
    expect(lengthToDots(pt(0.1), 203)).toBe(0);
    expect(strokeLengthToDots(pt(0.1), 203)).toBe(1);
  });
});

describe('paperSizeToDots', () => {
  it('đổi khổ giấy mm sang dots, receipt không có chiều cao', () => {
    expect(paperSizeToDots({ widthMm: 50, heightMm: 30 }, 203)).toEqual({ widthDots: 400, heightDots: 240 });
    expect(paperSizeToDots({ widthMm: 72 }, 203)).toEqual({ widthDots: 575 });
  });
});
```

Ghi đè `LayoutEngine.test.ts` (dùng 96 dpi + `px` để 1px = 1 dot, giữ nguyên số liệu của test cũ):

`packages/printer-core/src/layout/__tests__/LayoutEngine.test.ts`:

```ts
import { ApproximateFontMetrics, createLayoutEngine, type LayoutConfig, type TypographyProfile } from '..';
import type { ResolvedNode } from '../../resolution';
import { mm, pt, px } from '../../template';

/** Ở 96 dpi, 1px = đúng 1 dot — test đặt số liệu bằng px để đọc thẳng ra dots. */
const DOTS_EQUAL_PIXELS_DPI = 96;

const engine = createLayoutEngine();
const fontMetrics = new ApproximateFontMetrics();
const typography: TypographyProfile = { fontScaleLevels: [{ id: 'default', fontScale: 1, lineHeightScale: 1 }] };

/** Khổ giấy tính bằng mm tương ứng số dots ở 96 dpi. */
function millimetersForDots(dots: number): number {
  return (dots * 25.4) / DOTS_EQUAL_PIXELS_DPI;
}

const receiptConfig: LayoutConfig = {
  paper: { widthMm: millimetersForDots(576) },
  media: 'receipt',
  dpi: DOTS_EQUAL_PIXELS_DPI,
};

function textNode(
  id: string,
  value: string,
  fontSizePixels = 10,
): ResolvedNode {
  return { type: 'text', id, value, style: { fontSize: px(fontSizePixels) } };
}

describe('LayoutEngine', () => {
  it('text đơn thành 1 TextElement tại x=0, y=0', () => {
    const elements = engine.resolve(textNode('t1', 'Hello', 20), receiptConfig, typography, fontMetrics);

    expect(elements).toHaveLength(1);
    // 20 dots → hệ số phóng đại round(20/12) = 2.
    expect(elements[0]).toMatchObject({ type: 'text', content: 'Hello', options: { x: 0, y: 0, size: 2 } });
  });

  it('xếp con theo cột có gap', () => {
    const root: ResolvedNode = {
      type: 'container',
      id: 'root',
      style: { direction: 'column', gap: px(10) },
      children: [textNode('t1', 'A'), textNode('t2', 'B')],
    };
    const [first, second] = engine.resolve(root, receiptConfig, typography, fontMetrics);
    if (first.type !== 'text' || second.type !== 'text') throw new Error('expected text elements');

    expect(first.options?.y).toBe(0);
    expect(second.options?.y).toBe(fontMetrics.measure('A', { fontSize: 10 }).heightDots + 10);
  });

  it('xếp con theo hàng có gap', () => {
    const root: ResolvedNode = {
      type: 'container',
      id: 'root',
      style: { direction: 'row', gap: px(20) },
      children: [textNode('t1', 'A'), textNode('t2', 'B')],
    };
    const [first, second] = engine.resolve(root, receiptConfig, typography, fontMetrics);
    if (first.type !== 'text' || second.type !== 'text') throw new Error('expected text elements');

    expect(first.options?.x).toBe(0);
    expect(second.options?.x).toBe(fontMetrics.measure('A', { fontSize: 10 }).widthDots + 20);
  });

  it('padding dịch vị trí node con', () => {
    const root: ResolvedNode = {
      type: 'container',
      id: 'root',
      style: { padding: { top: px(8), right: px(8), bottom: px(8), left: px(8) } },
      children: [textNode('t1', 'A')],
    };
    const [element] = engine.resolve(root, receiptConfig, typography, fontMetrics);

    expect(element).toMatchObject({ type: 'text', options: { x: 8, y: 8 } });
  });

  it('padding của container tính vào chiều cao, node kế tiếp không đè lên', () => {
    const root: ResolvedNode = {
      type: 'container',
      id: 'root',
      style: { direction: 'column' },
      children: [
        {
          type: 'container',
          id: 'inner',
          style: { direction: 'column', padding: { top: px(8), right: px(0), bottom: px(8), left: px(0) } },
          children: [textNode('t1', 'A')],
        },
        textNode('t2', 'B'),
      ],
    };
    const [, sibling] = engine.resolve(root, receiptConfig, typography, fontMetrics);
    if (sibling.type !== 'text') throw new Error('expected text element');

    expect(sibling.options?.y).toBe(fontMetrics.measure('A', { fontSize: 10 }).heightDots + 8 + 8);
  });

  it('barcode/QR/image/line thành đúng loại PrintElement', () => {
    const root: ResolvedNode = {
      type: 'container',
      id: 'root',
      style: { direction: 'column' },
      children: [
        { type: 'barcode', id: 'b1', value: 'ABC', symbology: 'code128', readable: true },
        { type: 'qrcode', id: 'q1', value: 'XYZ' },
        { type: 'image', id: 'i1', bitmap: { width: 1, height: 1, bytesPerRow: 1, data: new Uint8Array([0]) } },
        { type: 'line', id: 'l1', thickness: px(2), pattern: 'solid' },
      ],
    };
    const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);

    expect(elements.map((element) => element.type)).toEqual(['barcode', 'qrcode', 'image', 'line']);
  });

  it('container rỗng không sinh element', () => {
    const root: ResolvedNode = { type: 'container', id: 'root', children: [] };

    expect(engine.resolve(root, receiptConfig, typography, fontMetrics)).toEqual([]);
  });

  it('text dài hơn chiều rộng được ngắt thành nhiều dòng, y tăng dần', () => {
    const longText = 'This is a very long line of receipt text that should not fit on a single narrow line';
    const narrowConfig: LayoutConfig = { ...receiptConfig, paper: { widthMm: millimetersForDots(100) } };
    const elements = engine.resolve(textNode('t1', longText), narrowConfig, typography, fontMetrics);

    expect(elements.length).toBeGreaterThan(1);
    const ys = elements.map((element) => (element.type === 'text' ? (element.options?.y ?? 0) : -1));
    expect([...ys].sort((left, right) => left - right)).toEqual(ys);
    expect(new Set(ys).size).toBe(ys.length);
  });

  it('line, barcode, QR, text xếp cột không đè nhau', () => {
    const root: ResolvedNode = {
      type: 'container',
      id: 'root',
      style: { direction: 'column' },
      children: [
        { type: 'line', id: 'l1', thickness: px(2), pattern: 'solid' },
        { type: 'barcode', id: 'b1', value: 'ABC', symbology: 'code128', readable: true },
        { type: 'qrcode', id: 'q1', value: 'XYZ' },
        textNode('t1', 'Hello'),
      ],
    };
    const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
    const ys = elements.map((element) => {
      if (element.type === 'line') return element.options.y1;
      if (element.type === 'barcode' || element.type === 'qrcode') return element.options.y ?? 0;
      return element.type === 'text' ? (element.options?.y ?? 0) : -1;
    });

    expect(ys).toEqual([0, 2, 82, 202]);
  });

  describe('cỡ chữ (dots) → hệ số phóng đại 1-8', () => {
    it('không đặt fontSize thì dùng DEFAULT_FONT_SIZE (12px)', () => {
      const withoutSize: ResolvedNode = { type: 'text', id: 't1', value: 'Hi' };
      const withDefault: ResolvedNode = { type: 'text', id: 't1', value: 'Hi', style: { fontSize: px(12) } };
      const config: LayoutConfig = { ...receiptConfig, dpi: 203 };

      expect(engine.resolve(withoutSize, config, typography, fontMetrics)).toEqual(
        engine.resolve(withDefault, config, typography, fontMetrics),
      );
    });

    it('cỡ rất nhỏ kẹp về 1, cỡ rất lớn kẹp về 8', () => {
      const [small] = engine.resolve(textNode('t1', 'Hi', 1), receiptConfig, typography, fontMetrics);
      const [large] = engine.resolve(textNode('t1', 'Hi', 200), receiptConfig, typography, fontMetrics);

      expect(small).toMatchObject({ options: { size: 1 } });
      expect(large).toMatchObject({ options: { size: 8 } });
    });
  });

  describe('hàng space-between (idiom "tên ...... giá")', () => {
    type Justify = 'start' | 'space-between' | undefined;

    function row(justifyContent: Justify, children: readonly ResolvedNode[]): ResolvedNode {
      return { type: 'container', id: 'root', style: { direction: 'row', justifyContent }, children };
    }

    function typesOf(root: ResolvedNode): readonly string[] {
      return engine.resolve(root, receiptConfig, typography, fontMetrics).map((element) => element.type);
    }

    it('đúng 2 text với space-between thành 1 TableElement 2 cột', () => {
      const root = row('space-between', [
        { type: 'text', id: 'name', value: 'Milk Tea' },
        { type: 'text', id: 'price', value: '45,000' },
      ]);
      const [element] = engine.resolve(root, receiptConfig, typography, fontMetrics);
      if (element.type !== 'table') throw new Error('expected table element');

      const rightWidthDots = fontMetrics.measure('45,000', { fontSize: 12 }).widthDots;
      expect(element.options.columns).toEqual([
        { width: 576 - rightWidthDots, align: 'left' },
        { width: rightWidthDots, align: 'right' },
      ]);
      expect(element.options.rows).toEqual([['Milk Tea', '45,000']]);
    });

    it('không đúng dạng thì xếp từng element riêng', () => {
      const [a, b, c] = [textNode('a', 'A'), textNode('b', 'B'), textNode('c', 'C')];
      const barcodeNode: ResolvedNode = { type: 'barcode', id: 'code', value: 'ABC', symbology: 'code128' };

      expect(typesOf(row('start', [a, b]))).toEqual(['text', 'text']);
      expect(typesOf(row(undefined, [a, b]))).toEqual(['text', 'text']);
      expect(typesOf(row('space-between', [a, b, c]))).toEqual(['text', 'text', 'text']);
      expect(typesOf(row('space-between', [barcodeNode, a]))).toEqual(['barcode', 'text']);
    });
  });

  describe('đổi Length → dots theo DPI', () => {
    const paddedText: ResolvedNode = {
      type: 'container',
      id: 'root',
      style: { padding: { top: mm(2), right: mm(2), bottom: mm(2), left: mm(2) } },
      children: [{ type: 'text', id: 't1', value: 'A', style: { fontSize: pt(9) } }],
    };

    it.each([
      [203, 16],
      [300, 24],
    ])('%i dpi: padding 2mm = %i dots, kích thước vật lý giữ nguyên', (dpi, expectedDots) => {
      const config: LayoutConfig = { paper: { widthMm: 50, heightMm: 30 }, media: 'label', dpi };
      const [element] = engine.resolve(paddedText, config, typography, fontMetrics);
      if (element.type !== 'text') throw new Error('expected text element');

      expect(element.options?.x).toBe(expectedDots);
      expect(((element.options?.x ?? 0) / dpi) * 25.4).toBeCloseTo(2, 1);
    });

    it('độ dày nét nhỏ hơn 1 dot vẫn giữ tối thiểu 1 dot', () => {
      const root: ResolvedNode = { type: 'line', id: 'l1', thickness: pt(0.1), pattern: 'solid' };
      const [element] = engine.resolve(root, { ...receiptConfig, dpi: 203 }, typography, fontMetrics);

      expect(element).toMatchObject({ type: 'line', options: { thickness: 1 } });
    });

    it('chiều cao vạch barcode và cỡ module QR đổi sang dots', () => {
      const root: ResolvedNode = {
        type: 'container',
        id: 'root',
        children: [
          { type: 'barcode', id: 'b1', value: 'ABC', symbology: 'code128', barHeight: mm(10) },
          { type: 'qrcode', id: 'q1', value: 'XYZ', moduleSize: mm(0.5) },
        ],
      };
      const [barcode, qrcode] = engine.resolve(root, { ...receiptConfig, dpi: 203 }, typography, fontMetrics);

      expect(barcode).toMatchObject({ type: 'barcode', options: { height: 80 } });
      expect(qrcode).toMatchObject({ type: 'qrcode', options: { cellWidth: 4, y: 80 } });
    });
  });

  describe('nét đứt', () => {
    it('tách thành các đoạn 1mm cách nhau 1mm, không vượt quá độ dài nét', () => {
      const root: ResolvedNode = {
        type: 'line',
        id: 'l1',
        pattern: 'dashed',
        style: { width: { type: 'fixed', value: mm(10) } },
      };
      const elements = engine.resolve(root, { ...receiptConfig, dpi: 203 }, typography, fontMetrics);
      const segments = elements.map((element) =>
        element.type === 'line' ? [element.options.x1, element.options.x2] : [],
      );

      // 10mm = 80 dots, 1mm = 8 dots → đoạn bắt đầu ở 0, 16, 32, 48, 64.
      expect(segments).toEqual([
        [0, 8],
        [16, 24],
        [32, 40],
        [48, 56],
        [64, 72],
      ]);
    });

    it('nét liền vẫn là 1 LineElement', () => {
      const root: ResolvedNode = { type: 'line', id: 'l1', pattern: 'solid' };

      expect(engine.resolve(root, receiptConfig, typography, fontMetrics)).toEqual([
        { type: 'line', options: { x1: 0, y1: 0, x2: 576, y2: 0, thickness: undefined } },
      ]);
    });
  });
});
```

`packages/printer-core/src/layout/__tests__/LayoutEngine.sizing.test.ts`:

```ts
import { ApproximateFontMetrics, createLayoutEngine, type LayoutConfig, type TypographyProfile } from '..';
import type { ResolvedNode } from '../../resolution';
import { px } from '../../template';

/** Ở 96 dpi, 1px = đúng 1 dot. */
const DOTS_EQUAL_PIXELS_DPI = 96;

const engine = createLayoutEngine();
const fontMetrics = new ApproximateFontMetrics();

function millimetersForDots(dots: number): number {
  return (dots * 25.4) / DOTS_EQUAL_PIXELS_DPI;
}

function labelConfig(widthDots: number, heightDots: number): LayoutConfig {
  return {
    paper: { widthMm: millimetersForDots(widthDots), heightMm: millimetersForDots(heightDots) },
    media: 'label',
    dpi: DOTS_EQUAL_PIXELS_DPI,
  };
}

function tallColumn(lineCount: number, fontSizePixels: number): ResolvedNode {
  return {
    type: 'container',
    id: 'root',
    style: { direction: 'column' },
    children: Array.from({ length: lineCount }, (_, index) => ({
      type: 'text' as const,
      id: `t${index}`,
      value: `Line ${index}`,
      style: { fontSize: px(fontSizePixels) },
    })),
  };
}

function firstTextSize(
  root: ResolvedNode,
  config: LayoutConfig,
  typography: TypographyProfile,
): number | undefined {
  const [first] = engine.resolve(root, config, typography, fontMetrics);
  if (first.type !== 'text') throw new Error('expected text element');
  return first.options?.size;
}

describe('LayoutEngine — tự thu nhỏ chữ', () => {
  it('receipt luôn dùng mức đầu tiên, không thu nhỏ', () => {
    const receipt: LayoutConfig = {
      paper: { widthMm: millimetersForDots(576) },
      media: 'receipt',
      dpi: DOTS_EQUAL_PIXELS_DPI,
    };
    const typography: TypographyProfile = {
      fontScaleLevels: [
        { id: 'large', fontScale: 1, lineHeightScale: 1 },
        { id: 'small', fontScale: 0.5, lineHeightScale: 0.5 },
      ],
    };

    // 40 dots ở mức 1 → hệ số round(40/12) = 3.
    expect(firstTextSize(tallColumn(50, 40), receipt, typography)).toBe(3);
  });

  it('label chọn mức lớn nhất còn vừa chiều cao tem', () => {
    const typography: TypographyProfile = {
      fontScaleLevels: [
        { id: 'large', fontScale: 1, lineHeightScale: 1 },
        { id: 'medium', fontScale: 0.5, lineHeightScale: 0.5 },
        { id: 'small', fontScale: 0.25, lineHeightScale: 0.25 },
      ],
    };

    // 10 dòng cỡ 20 tràn 100 dots; chỉ mức 0.25 vừa → 5 dots → hệ số 1.
    expect(firstTextSize(tallColumn(10, 20), labelConfig(400, 100), typography)).toBe(1);
  });

  it('label không vừa ở mức nào thì dùng mức nhỏ nhất, không throw', () => {
    const typography: TypographyProfile = {
      fontScaleLevels: [
        { id: 'large', fontScale: 1, lineHeightScale: 1 },
        { id: 'small', fontScale: 0.1, lineHeightScale: 0.1 },
      ],
    };

    expect(firstTextSize(tallColumn(100, 40), labelConfig(400, 10), typography)).toBe(1);
  });

  it('thu nhỏ đồng đều cả cây, không chỉ phần bị tràn', () => {
    const typography: TypographyProfile = {
      fontScaleLevels: [
        { id: 'large', fontScale: 1, lineHeightScale: 1 },
        { id: 'small', fontScale: 0.5, lineHeightScale: 0.5 },
      ],
    };
    const root: ResolvedNode = {
      type: 'container',
      id: 'root',
      style: { direction: 'column' },
      children: [
        { type: 'text', id: 'header', value: 'HEADER', style: { fontSize: px(20) } },
        ...Array.from({ length: 10 }, (_, index) => ({
          type: 'text' as const,
          id: `item${index}`,
          value: `Item ${index}`,
          style: { fontSize: px(20) },
        })),
      ],
    };
    const [header, item] = engine.resolve(root, labelConfig(400, 50), typography, fontMetrics);
    if (header.type !== 'text' || item.type !== 'text') throw new Error('expected text elements');

    expect(header.options?.size).toBe(item.options?.size);
    // 20 × 0.5 = 10 dots → hệ số 1 (chưa thu nhỏ là 2).
    expect(header.options?.size).toBe(1);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx jest packages/printer-core/src/layout`
Expected: FAIL — `lengthToDots is not a function`, `paperSizeToDots is not a function`.

- [ ] **Step 3: Viết đổi đơn vị + LayoutNode**

`packages/printer-core/src/layout/LayoutConfig.ts`:

```ts
import type { PaperSize, TemplateMedia } from '../template';

/** Thông số máy in đích để layout: khổ giấy của template + DPI của máy. */
export interface LayoutConfig {
  /** Khổ giấy, mm — lấy từ `TemplateDocument.paper`. */
  readonly paper: PaperSize;

  /** Label thì tự thu nhỏ chữ cho vừa chiều cao tem; receipt thì không. */
  readonly media: TemplateMedia;

  /** Mật độ điểm của máy in, VD 203 hoặc 300. */
  readonly dpi: number;
}
```

`packages/printer-core/src/layout/lengthToDots.ts`:

```ts
import type { Length, LengthUnit, PaperSize } from '../template';

/** Số đơn vị trong 1 inch của từng đơn vị độ dài. */
const UNITS_PER_INCH: Readonly<Record<LengthUnit, number>> = { mm: 25.4, pt: 72, px: 96 };

/** Nét kẻ, module QR... tối thiểu 1 dot để không biến mất trên máy DPI thấp. */
const MIN_STROKE_DOTS = 1;

/** Khổ giấy đã đổi sang dots. */
export interface PaperDots {
  /** Chiều rộng vùng in, dots. */
  readonly widthDots: number;

  /** Chiều cao 1 tem, dots; chỉ có ở label. */
  readonly heightDots?: number;
}

/** Đổi độ dài sang dots theo DPI của máy in: `round(value × dpi ÷ số đơn vị trên 1 inch)`. */
export function lengthToDots(length: Length, dpi: number): number {
  return Math.round((length.value * dpi) / UNITS_PER_INCH[length.unit]);
}

/** Như `lengthToDots` nhưng tối thiểu 1 dot — dùng cho độ dày nét và cỡ module. */
export function strokeLengthToDots(length: Length, dpi: number): number {
  return Math.max(MIN_STROKE_DOTS, lengthToDots(length, dpi));
}

/** Đổi `Length` tuỳ chọn sang dots; `undefined` giữ nguyên. */
export function optionalLengthToDots(length: Length | undefined, dpi: number): number | undefined {
  return length === undefined ? undefined : lengthToDots(length, dpi);
}

/** Đổi khổ giấy (mm) sang dots. */
export function paperSizeToDots(paper: PaperSize, dpi: number): PaperDots {
  const widthDots = lengthToDots({ value: paper.widthMm, unit: 'mm' }, dpi);
  if (paper.heightMm === undefined) return { widthDots };
  return { widthDots, heightDots: lengthToDots({ value: paper.heightMm, unit: 'mm' }, dpi) };
}
```

`packages/printer-core/src/layout/LayoutNode.ts`:

```ts
import type { BarcodeSymbology, QrErrorCorrectionLevel } from '../symbology';
import type { Bitmap } from '../types';

/** Khoảng cách 4 cạnh, dots. */
export interface LayoutInsets {
  readonly top: number;

  readonly right: number;

  readonly bottom: number;

  readonly left: number;
}

/** Kích thước đã đổi sang dots; `fixed.value` tính bằng dots. */
export type LayoutDimension =
  | { readonly type: 'fixed'; readonly value: number }
  | { readonly type: 'fill' }
  | { readonly type: 'auto' };

/** Style hộp, mọi độ dài tính bằng dots. */
export interface LayoutBoxStyle {
  readonly width?: LayoutDimension;

  readonly height?: LayoutDimension;

  readonly margin?: LayoutInsets;

  readonly padding?: LayoutInsets;
}

/** Style container, mọi độ dài tính bằng dots. */
export interface LayoutContainerStyle extends LayoutBoxStyle {
  readonly direction?: 'row' | 'column';

  /** Khoảng cách giữa 2 node con, dots. */
  readonly gap?: number;

  readonly justifyContent?: 'start' | 'center' | 'end' | 'space-between';

  readonly alignItems?: 'start' | 'center' | 'end';
}

/** Style chữ đã đổi sang dots — đầu vào của `FontMetrics`. */
export interface LayoutTextStyle extends LayoutBoxStyle {
  /** Cỡ chữ, dots. */
  readonly fontSize?: number;

  readonly fontWeight?: 'normal' | 'bold';

  /** Chiều cao cả dòng, dots (đã nhân hệ số `lineHeight` của template với cỡ chữ). */
  readonly lineHeight?: number;

  readonly textAlign?: 'left' | 'center' | 'right';
}

/** Cấu hình nét đứt, dots. */
export interface LayoutDash {
  /** Độ dài 1 đoạn nét, dots. */
  readonly dashDots: number;

  /** Khoảng trống giữa 2 đoạn, dots. */
  readonly gapDots: number;
}

/** Node đã đổi mọi độ dài sang dots theo DPI máy in đích — đầu vào của thuật toán layout. */
export type LayoutNode = LayoutContainer | LayoutText | LayoutLine | LayoutBarcode | LayoutQrCode | LayoutImage;

export interface LayoutContainer {
  readonly type: 'container';

  readonly id: string;

  readonly style?: LayoutContainerStyle;

  readonly children: readonly LayoutNode[];
}

export interface LayoutText {
  readonly type: 'text';

  readonly id: string;

  /** Chuỗi cần in. */
  readonly value: string;

  readonly style: LayoutTextStyle;
}

export interface LayoutLine {
  readonly type: 'line';

  readonly id: string;

  /** Độ dày nét, dots; bỏ trống là mặc định của máy in. */
  readonly thickness?: number;

  /** Có giá trị khi là nét đứt. */
  readonly dash?: LayoutDash;

  readonly style?: LayoutBoxStyle;
}

export interface LayoutBarcode {
  readonly type: 'barcode';

  readonly id: string;

  /** Dữ liệu mã hoá. */
  readonly value: string;

  readonly symbology: BarcodeSymbology;

  readonly readable?: boolean;

  /** Chiều cao vạch, dots. */
  readonly barHeight?: number;

  readonly style?: LayoutBoxStyle;
}

export interface LayoutQrCode {
  readonly type: 'qrcode';

  readonly id: string;

  /** Dữ liệu mã hoá. */
  readonly value: string;

  readonly errorCorrection?: QrErrorCorrectionLevel;

  /** Cạnh 1 module, dots. */
  readonly moduleSize?: number;

  readonly style?: LayoutBoxStyle;
}

export interface LayoutImage {
  readonly type: 'image';

  readonly id: string;

  /** Bitmap; mỗi pixel là 1 dot. */
  readonly bitmap: Bitmap;

  readonly style?: LayoutBoxStyle;
}
```

`packages/printer-core/src/layout/toLayoutNode.ts`:

```ts
import type { ResolvedLine, ResolvedNode } from '../resolution';
import {
  DEFAULT_FONT_SIZE,
  type BoxStyle,
  type Dimension,
  type Insets,
  type LayoutStyle,
  type Length,
  type TextStyle,
} from '../template';
import { lengthToDots, optionalLengthToDots, strokeLengthToDots } from './lengthToDots';
import type {
  LayoutBoxStyle,
  LayoutContainerStyle,
  LayoutDash,
  LayoutDimension,
  LayoutInsets,
  LayoutLine,
  LayoutNode,
  LayoutTextStyle,
} from './LayoutNode';

/** Độ dài 1 đoạn của nét đứt. */
const DASHED_LINE_DASH_LENGTH: Length = { value: 1, unit: 'mm' };

/** Khoảng trống giữa 2 đoạn của nét đứt. */
const DASHED_LINE_GAP_LENGTH: Length = { value: 1, unit: 'mm' };

/** Đổi mọi `Length` trong cây sang dots theo DPI — chỗ duy nhất trong pipeline đổi đơn vị template sang dots. */
export function toLayoutNode(node: ResolvedNode, dpi: number): LayoutNode {
  switch (node.type) {
    case 'container':
      return {
        type: 'container',
        id: node.id,
        style: toContainerStyle(node.style, dpi),
        children: node.children.map((child) => toLayoutNode(child, dpi)),
      };
    case 'text':
      return { type: 'text', id: node.id, value: node.value, style: toTextStyle(node.style, dpi) };
    case 'line':
      return toLayoutLine(node, dpi);
    case 'barcode':
      return { ...node, barHeight: optionalLengthToDots(node.barHeight, dpi), style: toBoxStyle(node.style, dpi) };
    case 'qrcode':
      return {
        ...node,
        moduleSize: node.moduleSize && strokeLengthToDots(node.moduleSize, dpi),
        style: toBoxStyle(node.style, dpi),
      };
    case 'image':
      return { ...node, style: toBoxStyle(node.style, dpi) };
  }
}

function toLayoutLine(node: ResolvedLine, dpi: number): LayoutLine {
  return {
    type: 'line',
    id: node.id,
    thickness: node.thickness && strokeLengthToDots(node.thickness, dpi),
    dash: node.pattern === 'dashed' ? dashFor(dpi) : undefined,
    style: toBoxStyle(node.style, dpi),
  };
}

function dashFor(dpi: number): LayoutDash {
  return {
    dashDots: strokeLengthToDots(DASHED_LINE_DASH_LENGTH, dpi),
    gapDots: strokeLengthToDots(DASHED_LINE_GAP_LENGTH, dpi),
  };
}

function toTextStyle(style: (BoxStyle & TextStyle) | undefined, dpi: number): LayoutTextStyle {
  const fontSize = lengthToDots(style?.fontSize ?? DEFAULT_FONT_SIZE, dpi);
  return {
    ...toBoxStyle(style, dpi),
    fontSize,
    fontWeight: style?.fontWeight,
    lineHeight: style?.lineHeight === undefined ? undefined : fontSize * style.lineHeight,
    textAlign: style?.textAlign,
  };
}

function toContainerStyle(style: LayoutStyle | undefined, dpi: number): LayoutContainerStyle | undefined {
  if (style === undefined) return undefined;
  return {
    ...toBoxStyle(style, dpi),
    direction: style.direction,
    gap: optionalLengthToDots(style.gap, dpi),
    justifyContent: style.justifyContent,
    alignItems: style.alignItems,
  };
}

function toBoxStyle(style: BoxStyle | undefined, dpi: number): LayoutBoxStyle | undefined {
  if (style === undefined) return undefined;
  return {
    width: toLayoutDimension(style.width, dpi),
    height: toLayoutDimension(style.height, dpi),
    margin: toLayoutInsets(style.margin, dpi),
    padding: toLayoutInsets(style.padding, dpi),
  };
}

function toLayoutDimension(dimension: Dimension | undefined, dpi: number): LayoutDimension | undefined {
  if (dimension?.type !== 'fixed') return dimension;
  return { type: 'fixed', value: lengthToDots(dimension.value, dpi) };
}

function toLayoutInsets(insets: Insets | undefined, dpi: number): LayoutInsets | undefined {
  if (insets === undefined) return undefined;
  return {
    top: lengthToDots(insets.top, dpi),
    right: lengthToDots(insets.right, dpi),
    bottom: lengthToDots(insets.bottom, dpi),
    left: lengthToDots(insets.left, dpi),
  };
}
```

`packages/printer-core/src/layout/FontMetrics.ts`:

```ts
import type { LayoutTextStyle } from './LayoutNode';
import type { TextMeasurement } from './TextMeasurement';

/** Đo và ngắt dòng chữ; mọi kích thước tính bằng dots. */
export interface FontMetrics {
  /** Kích thước của `text` (có thể nhiều dòng theo `\n`). */
  measure(text: string, style: LayoutTextStyle): TextMeasurement;

  /** Ngắt `text` thành các dòng vừa `maxWidthDots`. */
  wrap(text: string, maxWidthDots: number, style: LayoutTextStyle): readonly string[];
}
```

Sửa `packages/printer-core/src/layout/ApproximateFontMetrics.ts` — chỉ đổi type style, không đổi logic:
- Thay dòng `import type { TextStyle } from '../template/style/TextStyle';` bằng `import type { LayoutTextStyle } from './LayoutNode';`
- Đổi cả 4 chỗ `style: TextStyle` thành `style: LayoutTextStyle` (trong `resolveFontSize`, `resolveLineHeight`, `measure`, `wrap`).

- [ ] **Step 4: Viết LayoutEngine**

`packages/printer-core/src/layout/LayoutEngine.ts`:

```ts
import type { PrintElement } from '../document';
import type { ResolvedNode } from '../resolution';
import type { FontMetrics } from './FontMetrics';
import type { LayoutConfig } from './LayoutConfig';
import type {
  LayoutBarcode,
  LayoutContainer,
  LayoutImage,
  LayoutInsets,
  LayoutLine,
  LayoutNode,
  LayoutQrCode,
  LayoutText,
} from './LayoutNode';
import { paperSizeToDots } from './lengthToDots';
import { toLayoutNode } from './toLayoutNode';
import type { FontScaleLevel, TypographyProfile } from './TypographyProfile';

/** Toạ độ, dots. */
interface Position {
  readonly x: number;

  readonly y: number;
}

/** Kích thước, dots. */
interface Size {
  readonly widthDots: number;

  readonly heightDots: number;
}

/** Nơi nhận kết quả arrange: công cụ đo chữ + danh sách element đầu ra. */
interface ArrangeTarget {
  readonly fontMetrics: FontMetrics;

  readonly elements: PrintElement[];
}

/** Hàng đúng 2 text với `space-between` — thành 1 `TableElement` 2 cột (idiom "tên ...... giá"). */
type SpaceBetweenTextRow = LayoutContainer & { readonly children: readonly [LayoutText, LayoutText] };

const ORIGIN: Position = { x: 0, y: 0 };

const NO_PADDING: LayoutInsets = { top: 0, right: 0, bottom: 0, left: 0 };

// Barcode/QR chỉ ước lượng kích thước: kích thước thật phụ thuộc symbology, độ rộng module và độ dài nội dung.
const BARCODE_APPROXIMATE_WIDTH_DOTS = 200;

const BARCODE_DEFAULT_HEIGHT_DOTS = 80;

const QR_APPROXIMATE_SIZE_DOTS = 120;

const DEFAULT_LINE_THICKNESS_DOTS = 1;

// `TextOptions.size` của compiler là hệ số phóng đại 1-8 của font máy in, không phải dots — ~12 dots cho 1 bậc.
const DOTS_PER_MAGNIFICATION_STEP = 12;

const MIN_MAGNIFICATION = 1;

const MAX_MAGNIFICATION = 8;

/** Xếp vị trí các node đã resolve thành `PrintElement[]` (dots) theo khổ giấy + DPI của máy in đích. */
export class LayoutEngine {
  /** Label tự chọn mức thu nhỏ chữ lớn nhất còn vừa chiều cao tem; receipt luôn dùng mức đầu tiên. */
  resolve(
    root: ResolvedNode,
    config: LayoutConfig,
    typography: TypographyProfile,
    fontMetrics: FontMetrics,
  ): PrintElement[] {
    const layoutRoot = toLayoutNode(root, config.dpi);
    const paper = paperSizeToDots(config.paper, config.dpi);
    const levels = typography.fontScaleLevels;

    const labelSize = config.media === 'label' && paper.heightDots !== undefined
      ? { widthDots: paper.widthDots, heightDots: paper.heightDots }
      : undefined;
    const level = labelSize ? chooseLabelScaleLevel(layoutRoot, labelSize, levels, fontMetrics) : levels[0];

    const target: ArrangeTarget = { fontMetrics, elements: [] };
    arrange(scaleTree(layoutRoot, level), ORIGIN, paper.widthDots, target);
    return target.elements;
  }
}

/** Tạo layout engine. */
export function createLayoutEngine(): LayoutEngine {
  return new LayoutEngine();
}

// Không vừa ở mức nào thì dùng mức nhỏ nhất (best-effort), không throw.
function chooseLabelScaleLevel(
  root: LayoutNode,
  paper: Size,
  levels: readonly FontScaleLevel[],
  fontMetrics: FontMetrics,
): FontScaleLevel {
  const fitting = levels.find(
    (level) => measure(scaleTree(root, level), fontMetrics, paper.widthDots).heightDots <= paper.heightDots,
  );
  return fitting ?? levels[levels.length - 1];
}

function scaleTree(node: LayoutNode, level: FontScaleLevel): LayoutNode {
  if (node.type === 'container') return { ...node, children: node.children.map((child) => scaleTree(child, level)) };
  if (node.type !== 'text') return node;

  const { fontSize, lineHeight } = node.style;
  return {
    ...node,
    style: {
      ...node.style,
      fontSize: fontSize === undefined ? undefined : fontSize * level.fontScale,
      lineHeight: lineHeight === undefined ? undefined : lineHeight * level.lineHeightScale,
    },
  };
}

function measure(
  node: LayoutNode,
  fontMetrics: FontMetrics,
  availableWidthDots: number,
): Size {
  switch (node.type) {
    case 'text':
      return measureText(node, fontMetrics, availableWidthDots);
    case 'line':
      return {
        widthDots: lineLengthDots(node, availableWidthDots),
        heightDots: node.thickness ?? DEFAULT_LINE_THICKNESS_DOTS,
      };
    case 'image':
      return { widthDots: node.bitmap.width, heightDots: node.bitmap.height };
    case 'barcode':
      return { widthDots: BARCODE_APPROXIMATE_WIDTH_DOTS, heightDots: node.barHeight ?? BARCODE_DEFAULT_HEIGHT_DOTS };
    case 'qrcode':
      return { widthDots: QR_APPROXIMATE_SIZE_DOTS, heightDots: QR_APPROXIMATE_SIZE_DOTS };
    case 'container':
      return measureContainer(node, fontMetrics, availableWidthDots);
  }
}

function measureText(
  node: LayoutText,
  fontMetrics: FontMetrics,
  availableWidthDots: number,
): Size {
  const measurements = fontMetrics
    .wrap(node.value, availableWidthDots, node.style)
    .map((line) => fontMetrics.measure(line, node.style));
  return {
    widthDots: Math.max(0, ...measurements.map((measurement) => measurement.widthDots)),
    heightDots: sum(measurements.map((measurement) => measurement.heightDots)),
  };
}

function measureContainer(
  node: LayoutContainer,
  fontMetrics: FontMetrics,
  availableWidthDots: number,
): Size {
  const padding = node.style?.padding ?? NO_PADDING;
  const contentWidthDots = availableWidthDots - padding.left - padding.right;
  const content = isSpaceBetweenTextRow(node)
    ? measureSpaceBetweenRow(node, fontMetrics, contentWidthDots)
    : measureStack(node, fontMetrics, contentWidthDots);
  return {
    widthDots: content.widthDots + padding.left + padding.right,
    heightDots: content.heightDots + padding.top + padding.bottom,
  };
}

function measureSpaceBetweenRow(
  node: SpaceBetweenTextRow,
  fontMetrics: FontMetrics,
  contentWidthDots: number,
): Size {
  const [left, right] = node.children;
  const leftHeight = measure(left, fontMetrics, contentWidthDots).heightDots;
  const rightHeight = measure(right, fontMetrics, contentWidthDots).heightDots;
  return { widthDots: contentWidthDots, heightDots: Math.max(leftHeight, rightHeight) };
}

function measureStack(
  node: LayoutContainer,
  fontMetrics: FontMetrics,
  contentWidthDots: number,
): Size {
  const sizes = node.children.map((child) => measure(child, fontMetrics, contentWidthDots));
  const totalGapDots = (node.style?.gap ?? 0) * Math.max(0, sizes.length - 1);
  const widths = sizes.map((size) => size.widthDots);
  const heights = sizes.map((size) => size.heightDots);

  if (node.style?.direction === 'row') {
    return { widthDots: sum(widths) + totalGapDots, heightDots: Math.max(0, ...heights) };
  }
  return { widthDots: Math.max(0, ...widths), heightDots: sum(heights) + totalGapDots };
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

// Chỉ xử lý riêng đúng 2 text + space-between; flexbox tổng quát (nhiều con, các giá trị khác) chưa hỗ trợ.
function isSpaceBetweenTextRow(node: LayoutContainer): node is SpaceBetweenTextRow {
  return (
    node.style?.direction === 'row' &&
    node.style.justifyContent === 'space-between' &&
    node.children.length === 2 &&
    node.children[0].type === 'text' &&
    node.children[1].type === 'text'
  );
}

// Line không có độ dài riêng: `width: fixed` quyết định độ dài, còn lại kéo hết chiều rộng còn trống.
function lineLengthDots(node: LayoutLine, availableWidthDots: number): number {
  const width = node.style?.width;
  return width?.type === 'fixed' ? width.value : availableWidthDots;
}

function toMagnification(fontSizeDots: number | undefined): number | undefined {
  if (fontSizeDots === undefined) return undefined;
  const magnification = Math.round(fontSizeDots / DOTS_PER_MAGNIFICATION_STEP);
  return Math.min(MAX_MAGNIFICATION, Math.max(MIN_MAGNIFICATION, magnification));
}

function arrange(
  node: LayoutNode,
  origin: Position,
  availableWidthDots: number,
  target: ArrangeTarget,
): void {
  switch (node.type) {
    case 'text':
      arrangeText(node, origin, availableWidthDots, target);
      return;
    case 'line':
      arrangeLine(node, origin, availableWidthDots, target);
      return;
    case 'barcode':
      target.elements.push(toBarcodeElement(node, origin));
      return;
    case 'qrcode':
      target.elements.push(toQrCodeElement(node, origin));
      return;
    case 'image':
      target.elements.push(toImageElement(node, origin));
      return;
    case 'container':
      arrangeContainer(node, origin, availableWidthDots, target);
      return;
  }
}

function arrangeText(
  node: LayoutText,
  origin: Position,
  availableWidthDots: number,
  target: ArrangeTarget,
): void {
  let lineY = origin.y;
  for (const line of target.fontMetrics.wrap(node.value, availableWidthDots, node.style)) {
    target.elements.push({
      type: 'text',
      content: line,
      options: {
        x: origin.x,
        y: lineY,
        size: toMagnification(node.style.fontSize),
        align: node.style.textAlign,
        bold: node.style.fontWeight === 'bold',
      },
    });
    lineY += target.fontMetrics.measure(line, node.style).heightDots;
  }
}

// Nét đứt được tách thành nhiều LineElement ngắn, nên compiler không cần biết khái niệm nét đứt.
function arrangeLine(
  node: LayoutLine,
  origin: Position,
  availableWidthDots: number,
  target: ArrangeTarget,
): void {
  const lengthDots = lineLengthDots(node, availableWidthDots);
  if (!node.dash) {
    target.elements.push(toLineElement(node, origin, 0, lengthDots));
    return;
  }

  const stepDots = node.dash.dashDots + node.dash.gapDots;
  for (let startDots = 0; startDots < lengthDots; startDots += stepDots) {
    const endDots = Math.min(lengthDots, startDots + node.dash.dashDots);
    target.elements.push(toLineElement(node, origin, startDots, endDots));
  }
}

function toLineElement(
  node: LayoutLine,
  origin: Position,
  startDots: number,
  endDots: number,
): PrintElement {
  return {
    type: 'line',
    options: {
      x1: origin.x + startDots,
      y1: origin.y,
      x2: origin.x + endDots,
      y2: origin.y,
      thickness: node.thickness,
    },
  };
}

function toBarcodeElement(node: LayoutBarcode, origin: Position): PrintElement {
  return {
    type: 'barcode',
    options: {
      x: origin.x,
      y: origin.y,
      symbology: node.symbology,
      content: node.value,
      readable: node.readable,
      height: node.barHeight,
    },
  };
}

function toQrCodeElement(node: LayoutQrCode, origin: Position): PrintElement {
  return {
    type: 'qrcode',
    options: {
      x: origin.x,
      y: origin.y,
      content: node.value,
      errorCorrection: node.errorCorrection,
      cellWidth: node.moduleSize,
    },
  };
}

function toImageElement(node: LayoutImage, origin: Position): PrintElement {
  return { type: 'image', bitmap: node.bitmap, options: { x: origin.x, y: origin.y } };
}

function arrangeContainer(
  node: LayoutContainer,
  origin: Position,
  availableWidthDots: number,
  target: ArrangeTarget,
): void {
  const padding = node.style?.padding ?? NO_PADDING;
  const contentWidthDots = availableWidthDots - padding.left - padding.right;
  const contentOrigin: Position = { x: origin.x + padding.left, y: origin.y + padding.top };

  if (isSpaceBetweenTextRow(node)) {
    arrangeSpaceBetweenRow(node, contentOrigin, contentWidthDots, target);
    return;
  }
  arrangeStack(node, contentOrigin, contentWidthDots, target);
}

function arrangeSpaceBetweenRow(
  node: SpaceBetweenTextRow,
  origin: Position,
  contentWidthDots: number,
  target: ArrangeTarget,
): void {
  const [left, right] = node.children;
  const rightWidthDots = measure(right, target.fontMetrics, contentWidthDots).widthDots;
  const leftWidthDots = Math.max(0, contentWidthDots - rightWidthDots);
  target.elements.push({
    type: 'table',
    options: {
      x: origin.x,
      y: origin.y,
      columns: [
        { width: leftWidthDots, align: 'left' },
        { width: rightWidthDots, align: 'right' },
      ],
      rows: [[left.value, right.value]],
    },
  });
}

function arrangeStack(
  node: LayoutContainer,
  origin: Position,
  contentWidthDots: number,
  target: ArrangeTarget,
): void {
  const gapDots = node.style?.gap ?? 0;
  let cursor = origin;
  for (const child of node.children) {
    arrange(child, cursor, contentWidthDots, target);
    const size = measure(child, target.fontMetrics, contentWidthDots);
    cursor =
      node.style?.direction === 'row'
        ? { x: cursor.x + size.widthDots + gapDots, y: cursor.y }
        : { x: cursor.x, y: cursor.y + size.heightDots + gapDots };
  }
}
```

`packages/printer-core/src/layout/index.ts`:

```ts
export * from './LayoutConfig';
export * from './LayoutNode';
export * from './TextMeasurement';
export * from './FontMetrics';
export * from './ApproximateFontMetrics';
export * from './TypographyProfile';
export { lengthToDots, strokeLengthToDots, paperSizeToDots, type PaperDots } from './lengthToDots';
export { LayoutEngine, createLayoutEngine } from './LayoutEngine';
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `npx jest packages/printer-core/src/layout`
Expected: PASS — 4 suites (`ApproximateFontMetrics.test.ts` không đổi vẫn pass), 36 tests.

- [ ] **Step 6: Verify (scoped)**

```bash
npx tsc --noEmit -p packages/printer-core/tsconfig.json 2>&1 | grep -v "src/__tests__/layout-engine-integration.test.ts"
npx eslint packages/printer-core/src/layout
```

Expected: tsc không còn lỗi nào ngoài `layout-engine-integration.test.ts` (Task 8 thay file đó); eslint 0 error. Line-length với `packages/printer-core/src/layout`.

- [ ] **Step 7: Commit**

```bash
git add packages/printer-core/src/layout
git commit -m "refactor: convert template lengths to dots per printer DPI in layout, split dashed lines

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Integration test end-to-end — printer-core xanh toàn bộ

Kết thúc cửa sổ đỏ của `printer-core`.

**Files:**
- Delete: `packages/printer-core/src/__tests__/layout-engine-integration.test.ts`
- Test: `packages/printer-core/src/__tests__/template-pipeline-integration.test.ts`

**Interfaces:**
- Consumes: toàn bộ API Task 1-7; `EscPosCompiler` từ `../language`.
- Produces: không có API mới.

- [ ] **Step 1: Thay integration test**

```bash
git rm packages/printer-core/src/__tests__/layout-engine-integration.test.ts
```

`packages/printer-core/src/__tests__/template-pipeline-integration.test.ts`:

```ts
import { EscPosCompiler } from '../language';
import { ApproximateFontMetrics, createLayoutEngine, paperSizeToDots, type TypographyProfile } from '../layout';
import { collectAssetIds, createDocumentResolver, type AssetProvider } from '../resolution';
import { barcode, column, gt, image, line, mm, parseTemplate, px, receiptTemplate, row, text } from '../template';
import { TEST_ORDER_CATALOG, TEST_ORDER_SAMPLE } from '../testing';
import type { Bitmap } from '../types';

// Không có @types/node trong package RN; require() chỉ dùng để khẳng định module cũ đã bị xoá.
declare function require(id: string): unknown;

const LOGO: Bitmap = { data: new Uint8Array(8), width: 8, height: 8, bytesPerRow: 1 };
const TYPOGRAPHY: TypographyProfile = { fontScaleLevels: [{ id: 'default', fontScale: 1, lineHeightScale: 1 }] };
const PRINTER_DPI = 203;

function buildReceipt() {
  return receiptTemplate(TEST_ORDER_CATALOG)
    .id('receipt-default')
    .name('Hoá đơn mặc định')
    .paper({ widthMm: 72 })
    .root((scope) =>
      column()
        .gap(mm(1))
        .children(
          image(scope.var('storeLogo')),
          text([{ text: 'Bàn ' }, scope.var('tableName')]).fontSize(px(16)).bold(),
          line().dashed(),
          scope.repeat({ collection: 'items' }, (item) =>
            row().justifyContent('space-between').children(text([item.var('itemName')]), text([item.var('itemTotal')])),
          ),
          text([{ text: 'Giảm giá ' }, scope.var('discount')]).visibleWhen(gt('discount', 0)),
          barcode([scope.var('orderCode')], 'code128').barHeight(mm(8)),
        ),
    )
    .build();
}

describe('pipeline template → resolve → layout → compile', () => {
  it('DSL → JSON (round-trip) → resolve với catalog → layout 203 dpi → byte ESC/POS', () => {
    const parsed = parseTemplate(JSON.parse(JSON.stringify(buildReceipt())));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const template = parsed.template;

    expect(collectAssetIds(template, TEST_ORDER_CATALOG, TEST_ORDER_SAMPLE)).toEqual(['store-logo@v1']);
    const assets: AssetProvider = { get: (assetId) => (assetId === 'store-logo@v1' ? LOGO : undefined) };

    const resolveOptions = { catalog: TEST_ORDER_CATALOG, assets };
    const pages = createDocumentResolver().resolve(template, TEST_ORDER_SAMPLE, resolveOptions);
    expect(pages).toHaveLength(1);
    if (pages[0].status !== 'ok') throw new Error(pages[0].message);

    const config = { paper: template.paper, media: template.media, dpi: PRINTER_DPI };
    const elements = createLayoutEngine().resolve(pages[0].node, config, TYPOGRAPHY, new ApproximateFontMetrics());

    expect(elements.some((element) => element.type === 'text' && element.content === 'Bàn Bàn 5')).toBe(true);
    expect(elements.some((element) => element.type === 'text' && element.content === 'Giảm giá 5.000đ')).toBe(true);
    expect(elements).toContainEqual(
      expect.objectContaining({ type: 'table', options: expect.objectContaining({ rows: [['Trà sữa', '135.000đ']] }) }),
    );
    expect(elements.filter((element) => element.type === 'line').length).toBeGreaterThan(1);
    expect(elements).toContainEqual(
      expect.objectContaining({ type: 'barcode', options: expect.objectContaining({ height: 64 }) }),
    );

    const paper = paperSizeToDots(template.paper, PRINTER_DPI);
    const bytes = new EscPosCompiler().compile({
      widthDots: paper.widthDots,
      heightDots: paper.heightDots ?? 0,
      dpi: PRINTER_DPI,
      gapDots: 0,
      speed: 4,
      density: 8,
      direction: 'forward',
      copies: 1,
      elements,
    });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('templates/ và binding/ cũ không còn import được', () => {
    expect(() => require('../templates')).toThrow();
    expect(() => require('../binding')).toThrow();
  });
});
```

- [ ] **Step 2: Chạy test**

Run: `npx jest packages/printer-core/src/__tests__/template-pipeline-integration.test.ts`
Expected: PASS — 2 tests. Nếu FAIL: lỗi nằm ở tầng mà message chỉ ra (parse → resolve → layout → compile); sửa ở task tương ứng, không nới lỏng assertion.

- [ ] **Step 3: Verify toàn bộ printer-core**

```bash
npm run type-check -w printer-core
npx jest packages/printer-core
npx eslint packages/printer-core/src
```

Expected: type-check **sạch hoàn toàn**; toàn bộ test printer-core pass; eslint 0 error. Line-length với `packages/printer-core/src/catalog packages/printer-core/src/template packages/printer-core/src/resolution packages/printer-core/src/layout packages/printer-core/src/__tests__/template-pipeline-integration.test.ts packages/printer-core/src/testing/OrderTestCatalog.ts`.

- [ ] **Step 4: Commit**

```bash
git add packages/printer-core/src/__tests__
git commit -m "test: cover DSL to ESC/POS pipeline with catalog, JSON round-trip and assets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `printer-preview` theo model mới

**Files:**
- Replace: `packages/printer-preview/src/defaultSample.ts`, `evaluateTemplate.ts`, `pipeline.ts`
- Modify: `packages/printer-preview/src/App.tsx`
- Replace test: `packages/printer-preview/src/__tests__/evaluateTemplate.test.ts`, `pipeline.test.ts`
- Test: `packages/printer-preview/src/__tests__/defaultSample.test.ts`

**Interfaces:**
- Consumes: `parseTemplate`, `Catalog`, `TemplateDocument`, `defineCatalog`, `defineCollection`, `labelTemplate`, `receiptTemplate`, DSL helper, `createDocumentResolver`, `createLayoutEngine`, `paperSizeToDots`, `AssetProvider`, `previewFor` từ `printer-core`.
- Produces:
  - `EvaluateResult` ok = `{ status: 'ok'; template: TemplateDocument; catalog: Catalog<unknown> }`
  - `renderPreviews(template, catalog, data: unknown, language): readonly PagePreview[]` (layout ở 203 dpi)
  - `defaultLanguageFor(template)`: `receipt` → `escpos`, `label` → `tspl`

- [ ] **Step 1: Viết test**

`packages/printer-preview/src/__tests__/evaluateTemplate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { evaluateTemplate } from '../evaluateTemplate';

const CATALOG_CODE = `
  import { defineCatalog, defineCollection } from 'printer-core';

  const items = defineCollection({
    label: 'Món',
    get: (data: { readonly items: readonly { readonly name: string }[] }) => data.items,
    variables: { itemName: { label: 'Tên món', type: 'string', get: (item) => item.name } },
  });

  export const catalog = defineCatalog({
    id: 'demo',
    version: 1,
    sample: { title: 'Xin chào', items: [{ name: 'A' }] },
    variables: { title: { label: 'Tiêu đề', type: 'string', get: (data) => data.title } },
    collections: { items },
  });
`;

describe('evaluateTemplate', () => {
  it('trả template + catalog khi code export đúng', () => {
    const code = `${CATALOG_CODE}
      import { labelTemplate, text } from 'printer-core';
      export default labelTemplate(catalog)
        .id('label')
        .name('Tem')
        .paper({ widthMm: 50, heightMm: 30 })
        .root((scope) => text([scope.var('title')]))
        .build();
    `;
    const result = evaluateTemplate(code);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.template.media).toBe('label');
    expect(result.template.paper).toEqual({ widthMm: 50, heightMm: 30 });
    expect(result.catalog.id).toBe('demo');
  });

  it('báo lỗi transpile khi cú pháp TypeScript sai', () => {
    const result = evaluateTemplate('export default labelTemplate(');

    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.stage).toBe('transpile');
  });

  it('báo lỗi runtime khi thiếu export catalog', () => {
    const result = evaluateTemplate('export default { notATemplate: true };');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.stage).toBe('runtime');
      expect(result.message).toContain('export const catalog');
    }
  });

  it('báo lỗi runtime kèm vị trí khi default export không phải TemplateDocument', () => {
    const result = evaluateTemplate(`${CATALOG_CODE}\nexport default { notATemplate: true };`);

    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.message).toContain('schemaVersion');
  });

  it('báo lỗi build khi template dùng biến sai scope', () => {
    const code = `${CATALOG_CODE}
      import { labelTemplate, text } from 'printer-core';
      export default labelTemplate(catalog)
        .id('label')
        .name('Tem')
        .paper({ widthMm: 50, heightMm: 30 })
        .root(text([{ var: 'itemName' }]))
        .build();
    `;
    const result = evaluateTemplate(code);

    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.message).toContain('chỉ dùng được trong vòng lặp "Món"');
  });

  it('báo lỗi khi code throw', () => {
    const result = evaluateTemplate(`throw new Error('boom');`);

    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.message).toContain('boom');
  });

  it('chặn require() module khác "printer-core"', () => {
    const result = evaluateTemplate(`const fs = require('fs'); export default fs;`);

    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.message).toContain('Cannot require');
  });
});
```

`packages/printer-preview/src/__tests__/pipeline.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { column, defineCatalog, defineCollection, labelTemplate, receiptTemplate, text } from 'printer-core';
import { defaultLanguageFor, renderPreviews } from '../pipeline';

interface DemoData {
  readonly title: string;
  readonly items: readonly { readonly name?: string }[];
}

const items = defineCollection({
  label: 'Món',
  get: (data: DemoData) => data.items,
  variables: { itemName: { label: 'Tên món', type: 'string', get: (item) => item.name } },
});

const catalog = defineCatalog({
  id: 'demo',
  version: 1,
  sample: { title: 'Xin chào', items: [] } as DemoData,
  variables: { title: { label: 'Tiêu đề', type: 'string', get: (data) => data.title } },
  collections: { items },
});

function label() {
  return labelTemplate(catalog).id('label').name('Tem').paper({ widthMm: 50, heightMm: 30 });
}

describe('renderPreviews', () => {
  it('render 1 trang SVG cho label đơn giản', () => {
    const template = label()
      .root((scope) => column().children(text([scope.var('title')])))
      .build();
    const previews = renderPreviews(template, catalog, { title: 'Hello', items: [] }, 'tspl');

    expect(previews).toHaveLength(1);
    expect(previews[0].status).toBe('ok');
    if (previews[0].status === 'ok') expect(previews[0].svg).toContain('<svg');
  });

  it('lỗi 1 trang không ảnh hưởng trang khác', () => {
    const template = label()
      .root((scope) =>
        scope
          .repeat({ collection: 'items' }, (item) => column().children(text([item.var('itemName')])))
          .maxItemsPerPage(1),
      )
      .build();
    const data: DemoData = { title: 'x', items: [{ name: 'A' }, {}, { name: 'C' }] };
    const previews = renderPreviews(template, catalog, data, 'tspl');

    expect(previews.map((preview) => preview.status)).toEqual(['ok', 'error', 'ok']);
  });

  it('defaultLanguageFor: receipt → escpos, label → tspl', () => {
    const labelDocument = label().root(text('x')).build();
    const receipt = receiptTemplate(catalog)
      .id('receipt')
      .name('Hoá đơn')
      .paper({ widthMm: 72 })
      .root(text('x'))
      .build();

    expect(defaultLanguageFor(labelDocument)).toBe('tspl');
    expect(defaultLanguageFor(receipt)).toBe('escpos');
  });
});
```

`packages/printer-preview/src/__tests__/defaultSample.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { defaultCode, defaultData } from '../defaultSample';
import { evaluateTemplate } from '../evaluateTemplate';
import { renderPreviews } from '../pipeline';

describe('defaultSample', () => {
  it('code mẫu chạy được, data mẫu khớp catalog.sample và in ra mỗi ly 1 tem', () => {
    const evaluated = evaluateTemplate(defaultCode);
    if (evaluated.status !== 'ok') throw new Error(evaluated.message);

    expect(JSON.parse(defaultData)).toEqual(evaluated.catalog.sample);

    const previews = renderPreviews(evaluated.template, evaluated.catalog, JSON.parse(defaultData), 'tspl');
    expect(previews.map((preview) => preview.status)).toEqual(['ok', 'ok']);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npm run test -w printer-preview`
Expected: FAIL — `result.catalog` undefined, `renderPreviews` sai số tham số, code mẫu cũ dùng `.size(...)`.

- [ ] **Step 3: Viết implementation**

`packages/printer-preview/src/defaultSample.ts`:

```ts
export const defaultCode = `import {
  column,
  defineCatalog,
  defineCollection,
  insets,
  labelTemplate,
  mm,
  px,
  text,
} from 'printer-core';

interface Topping {
  readonly name: string;
}

interface Product {
  readonly name: string;
  readonly price: number;
  readonly quantity: number;
  readonly toppings: readonly Topping[];
}

interface LabelData {
  readonly orderCode: string;
  readonly products: readonly Product[];
}

const sample: LabelData = {
  orderCode: 'HD001',
  products: [
    { name: 'Trà sữa trân châu', price: 45000, quantity: 2, toppings: [{ name: 'Trân châu' }, { name: 'Thạch dừa' }] },
  ],
};

const toppings = defineCollection({
  label: 'Topping',
  get: (product: Product) => product.toppings,
  variables: {
    toppingName: { label: 'Tên topping', type: 'string', get: (topping) => topping.name },
  },
});

const products = defineCollection({
  label: 'Danh sách món',
  get: (data: LabelData) => data.products,
  variables: {
    productName: { label: 'Tên món', type: 'string', get: (product) => product.name },
    productPrice: { label: 'Giá món', type: 'money', get: (product) => product.price },
    quantity: { label: 'Số lượng', type: 'number', get: (product) => product.quantity },
  },
  collections: { toppings },
});

export const catalog = defineCatalog({
  id: 'product-label',
  version: 1,
  sample,
  variables: {
    orderCode: { label: 'Mã đơn', type: 'string', get: (data) => data.orderCode },
  },
  collections: { products },
});

export default labelTemplate(catalog)
  .id('product-label-default')
  .name('Tem món mặc định')
  .paper({ widthMm: 50, heightMm: 30 })
  .root((scope) =>
    scope
      .repeat({ collection: 'products', expand: 'quantity' }, (product) =>
        column()
          .padding(insets(mm(2)))
          .gap(mm(1))
          .children(
            text([product.var('productName')]).fontSize(px(16)).bold(),
            text([product.var('productPrice')]),
            product.repeat({ collection: 'toppings' }, (topping) => text([{ text: '+ ' }, topping.var('toppingName')])),
            text([
              product.var('orderCode'),
              { text: ' · ' },
              product.var('$unit'),
              { text: '/' },
              product.var('$unitCount'),
            ]),
          ),
      )
      .maxItemsPerPage(1),
  )
  .build();
`;

export const defaultData = JSON.stringify(
  {
    orderCode: 'HD001',
    products: [
      {
        name: 'Trà sữa trân châu',
        price: 45000,
        quantity: 2,
        toppings: [{ name: 'Trân châu' }, { name: 'Thạch dừa' }],
      },
    ],
  },
  null,
  2,
);
```

`packages/printer-preview/src/evaluateTemplate.ts`:

```ts
import * as ts from 'typescript';
import * as PrinterCore from 'printer-core';
import { parseTemplate, type Catalog, type TemplateDocument } from 'printer-core';

export type EvaluateResult =
  | { readonly status: 'ok'; readonly template: TemplateDocument; readonly catalog: Catalog<unknown> }
  | { readonly status: 'error'; readonly stage: 'transpile' | 'runtime'; readonly message: string };

/** Module mà code người dùng xuất ra: `export const catalog` + `export default` template. */
interface EvaluatedModule {
  default?: unknown;
  catalog?: unknown;
}

const EXPORT_HINT =
  'Code phải `export const catalog = defineCatalog(...)` và `export default labelTemplate(catalog)...build()` ' +
  '(hoặc receiptTemplate) — default export phải là 1 TemplateDocument.';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function transpile(code: string): { readonly js: string } | { readonly error: EvaluateResult } {
  try {
    const result = ts.transpileModule(code, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      reportDiagnostics: true,
    });
    if (result.diagnostics && result.diagnostics.length > 0) {
      const message = result.diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n');
      return { error: { status: 'error', stage: 'transpile', message } };
    }
    return { js: result.outputText };
  } catch (error) {
    return { error: { status: 'error', stage: 'transpile', message: errorMessage(error) } };
  }
}

function requireShim(name: string): unknown {
  if (name === 'printer-core') return PrinterCore;
  throw new Error(`Cannot require "${name}" — only "printer-core" is available here.`);
}

function isCatalog(value: unknown): value is Catalog<unknown> {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Partial<Record<keyof Catalog<unknown>, unknown>>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.describe === 'function' &&
    typeof candidate.readVariable === 'function' &&
    typeof candidate.readCollection === 'function'
  );
}

function toEvaluateResult(exported: EvaluatedModule): EvaluateResult {
  if (!isCatalog(exported.catalog)) return { status: 'error', stage: 'runtime', message: EXPORT_HINT };

  const parsed = parseTemplate(exported.default);
  if (!parsed.ok) {
    const issues = parsed.issues.map((issue) => `- ${issue.path}: ${issue.message}`).join('\n');
    return { status: 'error', stage: 'runtime', message: `${EXPORT_HINT}\n${issues}` };
  }
  return { status: 'ok', template: parsed.template, catalog: exported.catalog };
}

function executeAndValidate(js: string): EvaluateResult {
  try {
    const moduleObj: { exports: EvaluatedModule } = { exports: {} };
    // eslint-disable-next-line no-new-func -- công cụ dev, chủ đích chạy code template người dùng viết (không sandbox)
    const fn = new Function('module', 'exports', 'require', js);
    fn(moduleObj, moduleObj.exports, requireShim);
    return toEvaluateResult(moduleObj.exports);
  } catch (error) {
    return { status: 'error', stage: 'runtime', message: errorMessage(error) };
  }
}

export function evaluateTemplate(code: string): EvaluateResult {
  const transpiled = transpile(code);
  if ('error' in transpiled) return transpiled.error;
  return executeAndValidate(transpiled.js);
}
```

`packages/printer-preview/src/pipeline.ts`:

```ts
import {
  ApproximateFontMetrics,
  createDocumentResolver,
  createLayoutEngine,
  paperSizeToDots,
  previewFor,
  type AssetProvider,
  type Catalog,
  type PrinterLanguage,
  type ResolvedPage,
  type ResolvedPrintDocument,
  type TemplateDocument,
  type TypographyProfile,
} from 'printer-core';

const DEFAULT_TYPOGRAPHY: TypographyProfile = {
  fontScaleLevels: [
    { id: 'large', fontScale: 1, lineHeightScale: 1 },
    { id: 'medium', fontScale: 0.75, lineHeightScale: 0.85 },
    { id: 'small', fontScale: 0.5, lineHeightScale: 0.7 },
  ],
};

/** DPI giả lập máy in cho preview — phổ biến nhất ở máy in nhiệt/tem. */
const PREVIEW_DPI = 203;

/** Preview chưa hỗ trợ ảnh: mọi mã asset đều không tìm thấy (trang dùng ảnh sẽ báo lỗi). */
const NO_ASSETS: AssetProvider = { get: () => undefined };

const fontMetrics = new ApproximateFontMetrics();
const resolver = createDocumentResolver();
const layoutEngine = createLayoutEngine();

export type PagePreview =
  | { readonly status: 'ok'; readonly pageIndex: number; readonly svg: string }
  | { readonly status: 'error'; readonly pageIndex: number; readonly message: string };

function buildResolvedDocument(
  template: TemplateDocument,
  page: Extract<ResolvedPage, { status: 'ok' }>,
): ResolvedPrintDocument {
  const layoutConfig = { paper: template.paper, media: template.media, dpi: PREVIEW_DPI };
  const elements = layoutEngine.resolve(page.node, layoutConfig, DEFAULT_TYPOGRAPHY, fontMetrics);
  const paper = paperSizeToDots(template.paper, PREVIEW_DPI);
  return {
    widthDots: paper.widthDots,
    heightDots: paper.heightDots ?? 0,
    dpi: PREVIEW_DPI,
    gapDots: 0,
    speed: 4,
    density: 8,
    direction: 'forward',
    copies: 1,
    elements,
  };
}

function renderPage(
  template: TemplateDocument,
  page: ResolvedPage,
  language: PrinterLanguage,
): PagePreview {
  if (page.status === 'error') {
    return { status: 'error', pageIndex: page.pageIndex, message: `${page.nodeId}: ${page.message}` };
  }
  try {
    const document = buildResolvedDocument(template, page);
    return { status: 'ok', pageIndex: page.pageIndex, svg: previewFor(language, document) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'error', pageIndex: page.pageIndex, message };
  }
}

export function renderPreviews(
  template: TemplateDocument,
  catalog: Catalog<unknown>,
  data: unknown,
  language: PrinterLanguage,
): readonly PagePreview[] {
  const pages = resolver.resolve(template, data, { catalog, assets: NO_ASSETS });
  return pages.map((page) => renderPage(template, page, language));
}

export function defaultLanguageFor(template: TemplateDocument): PrinterLanguage {
  return template.media === 'receipt' ? 'escpos' : 'tspl';
}
```

Sửa `packages/printer-preview/src/App.tsx`:
- Trong `renderOutcome`, thay dòng
  `const previews = renderPreviews(evaluated.template, parsed.data as Record<string, unknown>, languageToUse);`
  bằng
  `const previews = renderPreviews(evaluated.template, evaluated.catalog, parsed.data, languageToUse);`
- Dòng `const LANGUAGES` đang dài 121 ký tự — ngắt thành mỗi phần tử 1 dòng:

```tsx
const LANGUAGES: readonly PrinterLanguage[] = [
  'tspl',
  'zpl',
  'epl',
  'cpcl',
  'dpl',
  'sbpl',
  'escpos',
  'starprnt',
  'ipl',
];
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npm run test -w printer-preview`
Expected: PASS — 3 files, 11 tests.

- [ ] **Step 5: Verify**

```bash
npm run type-check -w printer-preview
npx eslint packages/printer-preview/src
```

Expected: type-check sạch; eslint 0 error (các warning `react-native/no-inline-styles` có sẵn từ trước, không do task này). Line-length với `packages/printer-preview/src`.

- [ ] **Step 6: Kiểm tra tay trên trình duyệt**

Run: `npm run dev -w printer-preview`, mở URL Vite in ra. Expected: code mẫu hiện 2 tem (mỗi ly 1 tem, `HD001 · 1/2` và `HD001 · 2/2`), đổi `quantity` trong data thành 3 thì ra 3 tem; sửa code thành `text([{ var: 'productName' }])` ở ngoài `repeat` thì panel lỗi báo `chỉ dùng được trong vòng lặp "Danh sách món"`. Dừng dev server sau khi kiểm tra.

- [ ] **Step 7: Commit**

```bash
git add packages/printer-preview/src
git commit -m "refactor: migrate printer-preview to catalog-based TemplateDocument

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Cập nhật README printer-core + verify cuối

**Files:**
- Modify: `packages/printer-core/README.md`

**Interfaces:**
- Consumes: cấu trúc file sau Task 1-9.
- Produces: không có.

- [ ] **Step 1: Sửa mục "Cấu trúc" trong README**

Trong `packages/printer-core/README.md`, thay khối từ dòng `├── template/                  # KHÔNG đổi` tới hết khối `├── layout/ ... TypographyProfile.ts, index.ts` bằng:

```text
├── catalog/                   # Cầu nối template ↔ data: biến có tên theo loại nội dung
│   ├── VariableType.ts, VariableSpec.ts, CatalogCollection.ts, CatalogDescription.ts,
│   │   Catalog.ts, BuiltInVariable.ts, CatalogRegistry.ts, describeCatalog.ts,
│   │   defineCatalog.ts, CatalogIndex.ts, index.ts
│
├── template/                  # TemplateDocument JSON thuần, độc lập DPI
│   ├── TemplateDocument.ts, index.ts
│   ├── style/                  # Length.ts, Dimension.ts, Insets.ts, BoxStyle.ts,
│   │                           # LayoutStyle.ts, TextStyle.ts
│   ├── content/                # Segment.ts, ValueFormat.ts, Condition.ts
│   ├── nodes/                  # TemplateNode.ts, TemplateNodeBase.ts, ContainerNode.ts,
│   │                           # TextNode.ts, ImageNode.ts, BarcodeNode.ts,
│   │                           # QrCodeNode.ts, LineNode.ts, RepeatNode.ts
│   ├── format/                 # formatter vi-VN tự cài đặt (không dùng Intl)
│   ├── parse/                  # parseTemplate, migrateTemplate, validate cấu trúc,
│   │                           # validateTemplateAgainstCatalog
│   └── builder/                # DSL: labelTemplate/receiptTemplate(catalog), scope.var/repeat
│
├── resolution/                 # Ghép template + data qua catalog, stack scope tường minh
│   ├── DocumentResolver.ts, ResolveContext.ts, readVariable.ts, resolveContent.ts,
│   │   evaluateCondition.ts, readRepeatEntries.ts, resolveNode.ts, countPages.ts,
│   │   collectAssetIds.ts, AssetProvider.ts, ResolvedNode.ts, ResolvedPage.ts,
│   │   ResolveError.ts, index.ts
│
├── layout/                     # Đổi Length → dots theo DPI rồi xếp vị trí
│   ├── LayoutConfig.ts, lengthToDots.ts, LayoutNode.ts, toLayoutNode.ts,
│   │   LayoutEngine.ts, FontMetrics.ts, ApproximateFontMetrics.ts,
│   │   TextMeasurement.ts, TypographyProfile.ts, index.ts
```

Và trong khối `__tests__/` cuối mục, thay `layout-engine-integration.test.ts` bằng `template-pipeline-integration.test.ts`; thêm `OrderTestCatalog.ts` vào dòng liệt kê file của `testing/`.

- [ ] **Step 2: Verify cuối toàn bộ**

```bash
npm run type-check -w printer-core
npm run type-check -w printer-preview
npx jest packages/printer-core
npm run test -w printer-preview
npx eslint packages/printer-core/src packages/printer-preview/src
```

Expected: 2 type-check sạch; mọi test pass; eslint 0 error. Line-length với `packages/printer-core/src/catalog packages/printer-core/src/template packages/printer-core/src/resolution packages/printer-core/src/layout packages/printer-preview/src`.

- [ ] **Step 3: Commit**

```bash
git add packages/printer-core/README.md
git commit -m "docs: update printer-core structure for catalog-based template model

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
