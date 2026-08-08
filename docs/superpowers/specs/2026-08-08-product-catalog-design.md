# Product Catalog — Design

> Sub-project thứ ba trong chuỗi "kết nối API POS thật": Auth → Store selection → **Product catalog** → Cart & modifier → Order creation.
>
> Làm tiếp trên branch `feature/pos-auth-login`.

## 1. Mục tiêu

Thay thế `ProductAreaPlaceholder` tĩnh trong Sales Screen bằng catalog thật: tải danh mục + sản phẩm của cửa hàng hiện tại (`storeId` từ Redux, đã có từ Store selection), cho phép chuyển danh mục và tìm kiếm.

**Ngoài phạm vi** (dồn sang sub-project "Cart & modifier" kế tiếp):
- Thêm sản phẩm vào giỏ hàng — kể cả sản phẩm không có Modifier. Chạm vào Product Card trong sub-project này **không làm gì** (ripple/scale vẫn có vì là UI feedback thuần theo wireframe, không gắn logic nghiệp vụ).
- Modifier, Product Detail.
- Offline caching cho catalog (mất mạng xử lý như lỗi fetch thông thường, có nút "Thử lại").
- Barcode scanner input (backend không có field `Barcode` trong response).
- Held Orders, Search Result như màn hình riêng — dùng lại đúng vùng Product Grid.

## 2. Backend contract (nguồn: `NDTCore.BE`, đã xác nhận trực tiếp từ source, không dùng bản copy cũ/thiếu field của `NDTCore.FE`)

`GET /api/pos/store/{storeId}/catalog` — một object duy nhất, KHÔNG phân trang. Yêu cầu Bearer token + quyền truy cập `storeId` đó (403 nếu tài khoản không được gán store này — xử lý như lỗi fetch thông thường).

```csharp
PosCatalogResponse {
  List<PosCategoryResult> Categories;
  List<PosProductResult>  Products;
}

PosCategoryResult {
  int Id; int? ParentId; string Name;
  int ProductCount;
  List<PosCategoryResult> Children;
}

PosProductResult {
  int Id; int? CategoryId; string Sku; string Name; string? ShortDescription;
  decimal ResolvedPrice;      // giá đã áp dụng override theo store, fallback về giá gốc
  bool IsAvailable;
  int DisplayOrder; string? ImageUrl;
  List<PosTagResult> Tags;
  List<PosOptionGroupResult> OptionGroups;   // chưa dùng trong sub-project này, chỉ khai báo type cho tương lai
}

PosTagResult {
  int Id; string Name; string? ColorHex; string? TextColor; int DisplayOrder;
}
```

`OptionGroups`/`OptionResult` được khai báo đủ trong type layer (khớp backend) nhưng KHÔNG dùng ở ViewModel/UI trong sub-project này — chuẩn bị sẵn cho "Cart & modifier".

## 3. Data layer (`src/features/catalog/`)

```
src/features/catalog/
├── types/catalog.types.ts
│     PosCategoryDto, PosProductDto, PosTagDto, PosOptionGroupDto, PosOptionDto — PascalCase, đúng backend
│     CategoryViewModel {id, parentId, name, productCount, children}
│     ProductViewModel {id, categoryId, name, price, imageUrl, isAvailable, sku,
│                        badgeLabel, badgeColorHex, badgeTextColorHex}
│     — badge lấy từ Tag đầu tiên theo DisplayOrder (nếu có), card wireframe chỉ có 1 slot badge
├── api/catalogApi.ts
│     catalogApi.getCatalogAsync(storeId): Promise<ApiResponse<PosCatalogDto>>
├── services/CatalogService.ts
│     fetchCatalog(storeId): Promise<{categories: CategoryViewModel[], products: ProductViewModel[]}>
│       — map DTO→ViewModel, throw Error(response.Error.Message) khi IsSuccess=false (mirror StoreService)
│     filterByCategory(products, categories, categoryId | 'all'): ProductViewModel[]
│       — 'all' trả nguyên products; ngược lại đệ quy thu thập id của categoryId và mọi Children, lọc product.categoryId nằm trong tập đó
│     searchProducts(products, keyword): ProductViewModel[]
│       — so khớp Sku hoặc Name (có dấu, substring, không phân biệt hoa/thường) hoặc Name không dấu
│       — sắp xếp kết quả: khớp Sku trước, rồi khớp Name có dấu, rồi khớp Name không dấu (đúng thứ tự ưu tiên wireframe, bỏ Barcode vì backend không có field này)
├── store/catalogSlice.ts
│     state: {categories: CategoryViewModel[], products: ProductViewModel[], isLoading: boolean, error: string | null}
│     reducer thuần: catalogLoadStarted, catalogLoaded, catalogLoadFailed (mirror storeSlice's storesLoad*)
│     wire vào src/store/index.ts: catalog: catalogReducer
├── hooks/useCatalog.ts
│     fetch theo storeId (selectCurrentStoreId từ currentStore slice) trong useEffect lúc mount
│     trả {categories, products, isLoading, error, retry}
│     — không cần theo dõi storeId đổi giữa chừng: RootNavigator buộc rời AppTabs mỗi khi đổi cửa hàng (Task 6 Store selection), nên ProductArea luôn mount lại với storeId mới
└── components/
      CategoryTabs.tsx       — hàng ngang cuộn được, tab đầu "Tất cả" (mặc định active) + các danh mục gốc (ParentId == null)
      SearchBar.tsx          — controlled input, icon 🔍, nút xoá ✕ khi có nội dung, lọc real-time
      ProductGrid.tsx        — FlatList, numColumns theo layoutMode (3 tablet-landscape / 2 tablet-portrait / 2 phone), skeleton khi loading, EmptyState khi rỗng
      ProductCard.tsx        — ảnh hoặc 🧋 placeholder, tên tối đa 2 dòng, giá (formatCurrency), badge, disabled + nhãn "HẾT HÀNG" khi !isAvailable, KHÔNG gắn onPress nghiệp vụ
      ProductCardSkeleton.tsx — khối xám tĩnh, không animation
```

`src/utils/formatCurrency.ts` (mới) — format số thành chuỗi kiểu `45.000đ`, dùng lại được cho Cart/Checkout sau này.

## 4. Tích hợp vào Sales Screen

`src/features/sales/components/ProductArea.tsx` (mới, thay thế `ProductAreaPlaceholder`):
- State cục bộ (không Redux, vì không nơi nào khác cần đọc): `selectedCategoryId: number | 'all'`, `searchKeyword: string`.
- Gọi `useCatalog()`.
- `filteredProducts = useMemo(...)`: bắt đầu từ `products` → `filterByCategory` theo `selectedCategoryId` → `searchProducts` theo `searchKeyword` nếu có.
- Ghép `CategoryTabs` + `SearchBar` + `ProductGrid`.
- Khi lỗi fetch: tái dùng đúng pattern nút "Thử lại" đã xây cho `StoreSelectScreen` (gọi `useCatalog().retry`).

`src/features/sales/screens/SalesScreen.tsx`: đổi `<ProductAreaPlaceholder />` → `<ProductArea />` (giữ nguyên layout/flex hiện có theo `layoutMode`, không đổi cấu trúc).

## 5. Trạng thái

| Trạng thái | Hiển thị |
|---|---|
| Đang tải catalog (chỉ 1 lần lúc mount — đổi danh mục không gọi API lại) | Skeleton grid |
| Lỗi fetch (mạng, 403, ...) | EmptyState + nút "Thử lại" |
| Danh mục không có sản phẩm | EmptyState "Không có sản phẩm" |
| Tìm kiếm không có kết quả | EmptyState "Không tìm thấy sản phẩm" (kèm từ khoá) |

Đổi danh mục giữ nguyên từ khoá tìm kiếm, lọc lại trong danh mục mới (đúng hành vi wireframe `search-bar.md`).

## 6. Testing

`CatalogService` (mapping, `filterByCategory` đệ quy, `searchProducts` ưu tiên/không dấu) và `catalogSlice` (reducer thuần) có test riêng — đây là phần logic có rủi ro sai thật sự.

`catalogApi.ts` (khai báo thuần, giống `storeApi.ts`) và `useCatalog`/`ProductArea`/`CategoryTabs`/`SearchBar`/`ProductGrid`/`ProductCard`/`ProductCardSkeleton` (hook orchestration + UI trình bày thuần) không có test riêng — verify qua type-check + lint + chạy thử thật trên thiết bị/web, đúng quy ước đã dùng xuyên suốt project.
