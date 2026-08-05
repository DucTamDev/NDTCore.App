# Sales Shell + Navigation — Design

> Sub-project 1/6 của module Sales (xem `docs/design/wireframes/sales/README.md` cho phạm vi đầy đủ module).
>
> Các sub-project tiếp theo (không thuộc phạm vi spec này): Product browsing, Cart management, Modifier flow, Held Orders, States & polish.

## 1. Mục tiêu

Dựng khung điều hướng và layout tĩnh (không data, không interaction thật) cho màn hình Sales, làm nền cho các sub-project sau cắm dần logic vào mà không phải dựng lại cấu trúc.

Không thuộc phạm vi: dữ liệu sản phẩm/danh mục thật, state giỏ hàng thật, modifier, held orders, business rules nghiệp vụ (các file `docs/design/screens/sales.md`, `docs/design/flows/sales-flow.md`, `docs/design/foundation/07-business-rules.md` hiện đang rỗng — business rules sẽ được viết khi tới các sub-project cần chúng).

## 2. Navigation

Thêm dependency `@react-navigation/bottom-tabs` (chưa có trong `package.json`).

`RootNavigator` đổi từ single native-stack sang `Tab.Navigator` 2 tab:

```
RootNavigator (Tab.Navigator)
├── Tab "Bán hàng"  → SalesScreen   (initialRouteName)
└── Tab "Cài đặt"   → SettingsScreen
```

- `initialRouteName`: Sales — mở app vào thẳng bán hàng, đúng thực tế vận hành POS.
- Mỗi tab hiện chỉ có 1 screen nên chưa cần stack lồng bên trong tab (`Tab.Screen` trỏ thẳng component) — không tạo layer thừa.
- `RootStackParamList` đổi thành `RootTabParamList` với 2 key: `Sales`, `Settings`.

## 3. Component breakdown

Module mới `src/features/sales/`, tách theo đúng ranh giới mô tả trong wireframe:

```
src/features/sales/
├── screens/
│   └── SalesScreen.tsx            # chọn layout theo device mode, ghép các placeholder dưới
├── components/
│   ├── TopAppBar.tsx               # thanh trên cùng — tĩnh, tiêu đề + icon settings (điều hướng sang tab Cài đặt)
│   ├── ProductAreaPlaceholder.tsx  # gộp vùng Category Tabs + Search Bar + Product Grid, hiện EmptyState "Chưa có sản phẩm"
│   └── CartPanelPlaceholder.tsx    # Order Type + Order Note + Empty Cart + Checkout Button (disabled) — tĩnh
└── hooks/
    └── useSalesLayoutMode.ts       # useWindowDimensions → 'tablet-landscape' | 'tablet-portrait' | 'phone'
```

Category Tabs/Search Bar/Product Grid được gộp vào một placeholder duy nhất ở bước này vì chưa có logic hay data riêng để phân biệt — tách sớm sẽ tạo file rỗng vô nghĩa. Sub-project 2 (Product browsing) sẽ tách `ProductAreaPlaceholder` thành `CategoryTabs.tsx`, `SearchBar.tsx`, `ProductGrid.tsx` thật.

`CartPanelPlaceholder` dùng lại component chung sẵn có: `EmptyState` (Empty Cart), `AppButton` (Checkout, disabled).

## 4. Responsive behavior

`useSalesLayoutMode` quyết định cách `SalesScreen` ghép `ProductAreaPlaceholder` và `CartPanelPlaceholder`:

| Mode | Bố cục |
| --- | --- |
| **Tablet Landscape** (chuẩn hệ thống) | 2 cột cố định: Product Area ~65-70%, Cart Panel ~30-35%, cạnh nhau |
| **Tablet Portrait** | Vẫn 2 cột nhưng Cart Panel thu hẹp hơn — không dựng drawer/slide-over ở bước shell này |
| **Phone** | 1 cột, Product Area chiếm toàn màn hình. Cart Panel không cố định — thay bằng thanh tổng tiền cố định ở đáy ("0 sản phẩm · 0đ"), mở `CartPanelPlaceholder` qua `react-native-paper` `Modal` khi bấm vào |

**Quyết định có chủ đích:** chưa thêm thư viện bottom-sheet (`@gorhom/bottom-sheet` chưa có trong deps, cũng không có `react-native-gesture-handler`). Dùng `Modal` của Paper cho bản phone ở bước shell — đủ để thấy đúng cấu trúc, không cần gesture kéo-thả. Bottom sheet có drag thật để lại cho sub-project Cart management nếu cần — tránh thêm dependency khi chưa cần (YAGNI).

## 5. Testing

Theo quy ước codebase: component UI thuần trình bày (`TopAppBar`, `ProductAreaPlaceholder`, `CartPanelPlaceholder`) không có test file riêng — verify qua `type-check` + `lint` + chạy thử trên thiết bị/emulator. `useSalesLayoutMode` là hook logic (map dimensions → mode) nên có `.test.ts`.

## 6. Ngoài phạm vi (sub-project sau)

- Product browsing: Category Tabs, Search, Product Grid/Card, Product Detail thật
- Cart management: state giỏ hàng, Cart Item, Quantity Stepper thật
- Modifier flow: Modifier Group/Option
- Held Orders
- States & polish: Empty/Loading/Offline xuyên suốt, business rules
