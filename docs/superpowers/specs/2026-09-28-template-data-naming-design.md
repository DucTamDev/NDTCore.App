# printer-core: đổi "catalog" thành "template data" — Design Spec

## Mục tiêu

"Catalog" không nói lên nó là gì. Thực chất đây là **định nghĩa dữ liệu mà template được dùng**: tên biến, kiểu,
cách đọc giá trị từ data của app. Đổi toàn bộ tên theo đúng nghĩa đó, bỏ khái niệm "registry" (chỉ là bảng tra lúc
chạy) và thay bằng `TemplateDataReader` mô tả đúng trách nhiệm.

Không đổi hành vi: cùng template + cùng data → cùng kết quả resolve/layout/compile/preview. Chỉ đổi tên, 1 field JSON
và câu chữ thông báo lỗi.

## Ngoài phạm vi

- Tách các file đang chứa nhiều khái niệm (VD `CollectionDefinition.ts` vẫn giữ map + input + `defineCollection`) —
  để R5.
- Đổi `VariableType`, `BuiltInVariable*`, `IndexedVariable`, `IndexedCollection`, `VariableDescription`,
  `CollectionDescription`: giữ nguyên tên.
- Tăng `TEMPLATE_SCHEMA_VERSION`: chưa có template nào lưu ở BE, giữ bản 1.

## Thiết kế

### 1. Thư mục

`packages/printer-core/src/catalog/` → `packages/printer-core/src/template/data/` (dữ liệu template là 1 phần của
template, đặt cạnh `parse/`, `builder/`…). `template/index.ts` export `./data`; `src/index.ts` bỏ export `./catalog`.
Mọi import tới `catalog` đổi thành đường tương đối tới `template/data`.

### 2. Bảng đổi tên

| Hiện tại | Mới | File mới |
|---|---|---|
| `Catalog<TData, TVariables, TCollections>` | `TemplateDataDefinition<…>` | `TemplateDataDefinition.ts` (từ `Catalog.ts`) |
| `CatalogDefinition` (input của `defineCatalog`) | `TemplateDataDefinitionInput` | cùng file trên |
| `defineCatalog()` | `defineTemplateData()` | `defineTemplateData.ts` |
| `CatalogCollection` | `CollectionDefinition` | `CollectionDefinition.ts` (từ `CatalogCollection.ts`) |
| `CollectionDefinition` (input của `defineCollection`) | `CollectionDefinitionInput` | cùng file trên |
| `CatalogCollectionMap` | `CollectionDefinitionMap` | cùng file trên |
| `EmptyCollectionMap`, `defineCollection()` | giữ nguyên | cùng file trên |
| `VariableSpec`, `VariableSpecMap` | `VariableDefinition`, `VariableDefinitionMap` | `VariableDefinition.ts` (từ `VariableSpec.ts`) |
| `CatalogDescription` | `TemplateDataDescription` | `TemplateDataDescription.ts` (từ `CatalogDescription.ts`, giữ chung `VariableDescription`/`CollectionDescription`) |
| `describeCatalog.ts` (`describeVariables`, `describeCollections`) | `describeTemplateData.ts`, export `describeTemplateData()` | xem mục 4 |
| `CatalogIndex`, `createCatalogIndex` | `TemplateDataIndex`, `createTemplateDataIndex` | `TemplateDataIndex.ts` |
| `CatalogRegistry`, `createCatalogRegistry`, `readRegisteredVariable`, `readRegisteredCollection` | bỏ; thay bằng `TemplateDataReader`, `createTemplateDataReader` | `TemplateDataReader.ts` (xem mục 3) |
| `CatalogShape` (builder) | `TemplateDataShape` | `template/builder/TemplateDocumentBuilder.ts` |
| `CatalogReader` (resolver) | bỏ; resolver dùng `TemplateDataDefinition` | `resolution/ResolveContext.ts` |
| `readFromCatalog` | `readFromTemplateData` | `resolution/readVariable.ts` |
| `validateTemplateAgainstCatalog`, `CatalogValidationResult` | `validateTemplateAgainstData`, `TemplateDataValidationResult` | `template/parse/validateTemplateAgainstData.ts` |
| `testing/OrderTestCatalog.ts`, `TEST_ORDER_CATALOG` | `testing/OrderTestData.ts`, `TEST_ORDER_DATA` | — |
| biến/tham số/field code `catalog`, type param `TCatalog`, hàm nội bộ `isCatalog`, `CatalogCheck`, `catalogResult`… | `templateData`, `TTemplateData`, `isTemplateDataDefinition`, `TemplateDataCheck`, `templateDataResult`… | — |

Test file đổi tên theo file nguồn: `defineCatalog.test.ts` → `defineTemplateData.test.ts`, `CatalogIndex.test.ts` →
`TemplateDataIndex.test.ts`, `validateTemplateAgainstCatalog.test.ts` → `validateTemplateAgainstData.test.ts`.

### 3. `TemplateDataReader` thay registry

```ts
/** Đọc giá trị biến/collection theo tên lúc chạy — resolver chỉ biết tên, không biết kiểu data. */
export interface TemplateDataReader {
  readVariable(name: string, source: unknown): unknown;
  readCollection(name: string, source: unknown): unknown;
}

/** Dựng reader từ biến/collection đã khai báo; throw nếu tên trùng ở bất kỳ cấp nào hoặc dùng tiền tố `$`. */
export function createTemplateDataReader(
  variables: VariableDefinitionMap<unknown>,
  collections: CollectionDefinitionMap<unknown>,
): TemplateDataReader;
```

- Bảng tra tên → định nghĩa là chi tiết nội bộ của `TemplateDataReader.ts`, không export.
- `TemplateDataDefinition` extends `TemplateDataReader`; `defineTemplateData()` gắn `readVariable`/`readCollection`
  từ reader.
- Thông báo lỗi giữ nội dung, đổi chữ: `Catalog không có biến "x"` → `Dữ liệu template không có biến "x"`,
  tương tự cho collection và tên trùng.

### 4. `describeTemplateData`

`describeTemplateData(input): TemplateDataDescription` — nhận `id`, `version`, `variables`, `collections`, trả mô tả
JSON. `defineTemplateData()` gọi nó 1 lần. `describeVariables`/`describeCollections` thành hàm nội bộ của file.

### 5. Field JSON `TemplateDocument.catalog` → `dataId`

- `TemplateDocument.dataId: string` — mã `TemplateDataDefinition` mà template dùng, VD `'product-label'`.
- `validateTemplateStructure` kiểm field `dataId` (không rỗng) thay `catalog`.
- Builder ghi `dataId: templateData.id`; `DocumentResolver` so `template.dataId` với `options.templateData.id`.
- Option của `createDocumentResolver`: `catalog` → `templateData`.
- `TEMPLATE_SCHEMA_VERSION` giữ 1.

### 6. `printer-preview`

- Code người dùng: `export const templateData = defineTemplateData(...)` và
  `export default labelTemplate(templateData)...build()`.
- `evaluateTemplate` đọc export `templateData`; kết quả `ok` có field `templateData` thay `catalog`; `EXPORT_HINT` và
  mẫu mặc định (`defaultSample.ts`) viết theo tên mới.

### 7. Comment, README

- Comment/JSDoc tiếng Việt: "catalog" → "dữ liệu template" (hoặc tên kiểu mới khi nói về kiểu).
- README: cây thư mục `template/data/`, các mục nhắc catalog.

## Test

- Test giữ nguyên nội dung kiểm tra; chỉ đổi tên import/định danh/đường dẫn, field `catalog` → `dataId` trong JSON mẫu,
  và câu lỗi mong đợi theo chữ mới.
- Tổng số test `printer-core` và `printer-preview` không đổi.

## Tiêu chí hoàn thành

- `grep -rni "catalog" packages/printer-core packages/printer-preview/src` (trừ `node_modules`) không còn kết quả.
- tsc 0 lỗi, jest xanh cùng số test, eslint 0 lỗi, `printer-preview` type-check + Vitest xanh, dòng ≤ 120 ký tự.
