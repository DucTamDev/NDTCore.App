# Sales Shell + Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng khung điều hướng tab (Bán hàng / Cài đặt) và layout tĩnh, responsive (tablet landscape/portrait, phone) cho màn hình Sales — không có data hay interaction thật, làm nền cho các sub-project sau.

**Architecture:** Module mới `src/features/sales/` theo pattern feature module đã có (`printer`, `settings`). Layout chọn theo `useSalesLayoutMode` (dựa trên `useWindowDimensions`). Điều hướng chuyển từ single native-stack sang `Tab.Navigator` 2 tab.

**Tech Stack:** React Native CLI + TypeScript strict, React Navigation (`@react-navigation/bottom-tabs` — thêm mới), React Native Paper (MD3), Redux Toolkit (không cần store mới ở bước này).

## Global Constraints

- TypeScript strict, không dùng `any`.
- Không có path alias — mọi import dùng relative path.
- Toàn bộ text hiển thị cho người dùng: tiếng Việt.
- Component UI thuần trình bày (không có logic/business rule) **không có test file riêng** — verify qua `npm run type-check` + `npm run lint`, không viết snapshot/unit test cho chúng. Chỉ file logic thuần (hook tính toán, service, reducer...) mới có `.test.ts`.
- Không thêm feature/abstraction/error-handling vượt quá yêu cầu của spec.
- Chạy `npm run verify` (type-check + lint + test) trước mỗi commit.
- Ngoài phạm vi plan này: dữ liệu sản phẩm/danh mục thật, state giỏ hàng thật, modifier, held orders, business rules.

---

### Task 1: `useSalesLayoutMode` hook

**Files:**
- Create: `src/features/sales/hooks/useSalesLayoutMode.ts`
- Test: `src/features/sales/hooks/useSalesLayoutMode.test.ts`

**Interfaces:**
- Produces: `export type SalesLayoutMode = 'tablet-landscape' | 'tablet-portrait' | 'phone'`
- Produces: `export function getSalesLayoutMode(width: number, height: number): SalesLayoutMode` — pure function, dùng để test không cần render hook (project chưa có `@testing-library/react-native` hay renderHook helper nào).
- Produces: `export function useSalesLayoutMode(): SalesLayoutMode` — wrap `useWindowDimensions` từ `react-native`, gọi `getSalesLayoutMode`.
- Produces: `export const TABLET_MIN_DP = 600` — ngưỡng dp xác định tablet (theo chuẩn Android `sw600dp`).

- [ ] **Step 1: Viết test cho `getSalesLayoutMode` (thất bại trước vì file chưa tồn tại)**

```ts
// src/features/sales/hooks/useSalesLayoutMode.test.ts
import { getSalesLayoutMode } from './useSalesLayoutMode';

describe('getSalesLayoutMode', () => {
  it('returns tablet-landscape for a wide tablet-sized viewport', () => {
    expect(getSalesLayoutMode(1280, 800)).toBe('tablet-landscape');
  });

  it('returns tablet-portrait for a tall tablet-sized viewport', () => {
    expect(getSalesLayoutMode(800, 1280)).toBe('tablet-portrait');
  });

  it('returns phone for a portrait viewport below the tablet threshold', () => {
    expect(getSalesLayoutMode(360, 800)).toBe('phone');
  });

  it('returns phone for a landscape viewport below the tablet threshold', () => {
    expect(getSalesLayoutMode(800, 360)).toBe('phone');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npm test -- useSalesLayoutMode`
Expected: FAIL — Cannot find module `./useSalesLayoutMode`.

- [ ] **Step 3: Viết implementation**

```ts
// src/features/sales/hooks/useSalesLayoutMode.ts
import { useWindowDimensions } from 'react-native';

export type SalesLayoutMode = 'tablet-landscape' | 'tablet-portrait' | 'phone';

export const TABLET_MIN_DP = 600;

export function getSalesLayoutMode(width: number, height: number): SalesLayoutMode {
  const isTablet = Math.min(width, height) >= TABLET_MIN_DP;
  if (!isTablet) {
    return 'phone';
  }
  return width > height ? 'tablet-landscape' : 'tablet-portrait';
}

export function useSalesLayoutMode(): SalesLayoutMode {
  const { width, height } = useWindowDimensions();
  return getSalesLayoutMode(width, height);
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npm test -- useSalesLayoutMode`
Expected: PASS — 4 test đều xanh.

- [ ] **Step 5: Commit**

```bash
git add src/features/sales/hooks/useSalesLayoutMode.ts src/features/sales/hooks/useSalesLayoutMode.test.ts
git commit -m "feat: add useSalesLayoutMode hook for Sales responsive layout"
```

---

### Task 2: `TopAppBar` component

**Files:**
- Create: `src/features/sales/components/TopAppBar.tsx`

**Interfaces:**
- Consumes: không phụ thuộc task trước.
- Produces: `export interface TopAppBarProps { onSettingsPress: () => void }` và `export const TopAppBar: React.FC<TopAppBarProps>` — Task 4 (`SalesScreen`) sẽ render component này và truyền `onSettingsPress`.

- [ ] **Step 1: Viết component**

```tsx
// src/features/sales/components/TopAppBar.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton } from 'react-native-paper';

export interface TopAppBarProps {
  onSettingsPress: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({ onSettingsPress }) => (
  <View style={styles.container}>
    <Text variant="titleMedium">Bán hàng</Text>
    <IconButton icon="cog" onPress={onSettingsPress} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
});
```

- [ ] **Step 2: Verify (component UI thuần trình bày — không viết test riêng theo Global Constraints)**

Run: `npm run type-check && npm run lint`
Expected: không lỗi.

- [ ] **Step 3: Commit**

```bash
git add src/features/sales/components/TopAppBar.tsx
git commit -m "feat: add Sales TopAppBar component"
```

---

### Task 3: Product Area & Cart Panel placeholders

**Files:**
- Create: `src/features/sales/components/ProductAreaPlaceholder.tsx`
- Create: `src/features/sales/components/CartPanelPlaceholder.tsx`

**Interfaces:**
- Consumes: `EmptyState` (`src/components/EmptyState.tsx`), `AppInput` (`src/components/AppInput.tsx`), `AppButton` (`src/components/AppButton.tsx`), `SegmentedButtons` (`react-native-paper`).
- Produces: `export const ProductAreaPlaceholder: React.FC` (không props), `export const CartPanelPlaceholder: React.FC` (không props) — Task 4 render cả hai, không truyền prop nào.

- [ ] **Step 1: Viết `ProductAreaPlaceholder`**

```tsx
// src/features/sales/components/ProductAreaPlaceholder.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { EmptyState } from '../../../components/EmptyState';

export const ProductAreaPlaceholder: React.FC = () => (
  <View style={styles.container}>
    <EmptyState message="Chưa có sản phẩm để hiển thị" />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
});
```

- [ ] **Step 2: Viết `CartPanelPlaceholder`**

```tsx
// src/features/sales/components/CartPanelPlaceholder.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { AppInput } from '../../../components/AppInput';
import { EmptyState } from '../../../components/EmptyState';
import { AppButton } from '../../../components/AppButton';

const ORDER_TYPE_BUTTONS = [
  { value: 'dine-in', label: 'Tại quầy', disabled: true },
  { value: 'takeaway', label: 'Mang đi', disabled: true },
  { value: 'delivery', label: 'Giao hàng', disabled: true },
];

export const CartPanelPlaceholder: React.FC = () => (
  <View style={styles.container}>
    <SegmentedButtons value="dine-in" onValueChange={() => {}} buttons={ORDER_TYPE_BUTTONS} />
    <AppInput
      label="Ghi chú đơn hàng"
      value=""
      onChangeText={() => {}}
      placeholder="Ghi chú đơn hàng"
      disabled
    />
    <View style={styles.cartItems}>
      <EmptyState message="Giỏ hàng trống" />
    </View>
    <AppButton label="Thanh toán" disabled onPress={() => {}} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, justifyContent: 'space-between' },
  cartItems: { flex: 1, justifyContent: 'center' },
});
```

- [ ] **Step 3: Verify (component UI thuần trình bày — không viết test riêng theo Global Constraints)**

Run: `npm run type-check && npm run lint`
Expected: không lỗi.

- [ ] **Step 4: Commit**

```bash
git add src/features/sales/components/ProductAreaPlaceholder.tsx src/features/sales/components/CartPanelPlaceholder.tsx
git commit -m "feat: add Sales Product Area and Cart Panel placeholders"
```

---

### Task 4: `SalesScreen`

**Files:**
- Create: `src/features/sales/screens/SalesScreen.tsx`

**Interfaces:**
- Consumes: `useSalesLayoutMode` + `SalesLayoutMode` (Task 1), `TopAppBar` (Task 2), `ProductAreaPlaceholder` + `CartPanelPlaceholder` (Task 3), `RootTabParamList` (sẽ được tạo ở Task 5 tại `../../../navigation/RootNavigator`).
- Produces: `export const SalesScreen: React.FC` — Task 5 render component này trong `Tab.Screen name="Sales"`.

**Lưu ý phụ thuộc ngược:** Task này import type `RootTabParamList` từ `src/navigation/RootNavigator.tsx`, nhưng Task 5 mới là task đổi `RootNavigator.tsx` sang export type đó. Vì `RootNavigator.tsx` hiện tại export `RootStackParamList` (không phải `RootTabParamList`), Task 4 sẽ tạm thời có lỗi type-check cho tới khi Task 5 hoàn thành — đây là thứ tự bắt buộc vì `SalesScreen` cần tồn tại trước để Task 5 import ngược lại vào `Tab.Screen`. Bỏ qua lỗi type-check của riêng `RootTabParamList` ở bước verify của Task 4 (do reference tới type chưa tồn tại); các lỗi khác vẫn phải sạch. Task 5 sẽ verify lại toàn bộ.

- [ ] **Step 1: Viết `SalesScreen`**

```tsx
// src/features/sales/screens/SalesScreen.tsx
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../../../navigation/RootNavigator';
import { TopAppBar } from '../components/TopAppBar';
import { ProductAreaPlaceholder } from '../components/ProductAreaPlaceholder';
import { CartPanelPlaceholder } from '../components/CartPanelPlaceholder';
import { useSalesLayoutMode } from '../hooks/useSalesLayoutMode';

type SalesScreenNavigationProp = BottomTabNavigationProp<RootTabParamList, 'Sales'>;

export const SalesScreen: React.FC = () => {
  const navigation = useNavigation<SalesScreenNavigationProp>();
  const layoutMode = useSalesLayoutMode();
  const [cartVisible, setCartVisible] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <TopAppBar onSettingsPress={() => navigation.navigate('Settings')} />
      {layoutMode === 'phone' ? (
        <View style={styles.phoneBody}>
          <ProductAreaPlaceholder />
          <TouchableOpacity style={styles.cartSummaryBar} onPress={() => setCartVisible(true)}>
            <Text variant="titleSmall" style={styles.cartSummaryText}>
              0 sản phẩm · 0đ
            </Text>
          </TouchableOpacity>
          <Portal>
            <Modal
              visible={cartVisible}
              onDismiss={() => setCartVisible(false)}
              contentContainerStyle={styles.phoneCartModal}
            >
              <CartPanelPlaceholder />
            </Modal>
          </Portal>
        </View>
      ) : (
        <View style={styles.splitBody}>
          <View style={layoutMode === 'tablet-portrait' ? styles.productAreaPortrait : styles.productArea}>
            <ProductAreaPlaceholder />
          </View>
          <View style={layoutMode === 'tablet-portrait' ? styles.cartPanelPortrait : styles.cartPanel}>
            <CartPanelPlaceholder />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'white' },
  splitBody: { flex: 1, flexDirection: 'row' },
  productArea: { flex: 0.68 },
  productAreaPortrait: { flex: 0.55 },
  cartPanel: { flex: 0.32, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#E5E7EB' },
  cartPanelPortrait: { flex: 0.45, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#E5E7EB' },
  phoneBody: { flex: 1 },
  cartSummaryBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  cartSummaryText: { color: 'white' },
  phoneCartModal: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    maxHeight: '80%',
  },
});
```

- [ ] **Step 2: Verify**

Run: `npm run lint`
Expected: không lỗi. (Type-check đầy đủ để sau Task 5, vì lý do đã nêu ở phần Interfaces.)

- [ ] **Step 3: Commit**

```bash
git add src/features/sales/screens/SalesScreen.tsx
git commit -m "feat: add SalesScreen with responsive tablet/phone layout"
```

---

### Task 5: Bottom tab navigation

**Files:**
- Modify: `package.json` (thêm dependency)
- Modify: `src/navigation/RootNavigator.tsx`

**Interfaces:**
- Consumes: `SalesScreen` (Task 4), `SettingsScreen` (`src/features/settings/screens/SettingsScreen.tsx`, đã có sẵn).
- Produces: `export type RootTabParamList = { Sales: undefined; Settings: undefined }` — thay thế `RootStackParamList` cũ (chỉ được dùng trong chính file này, an toàn để đổi tên).

- [ ] **Step 1: Cài đặt dependency**

Run: `npm install @react-navigation/bottom-tabs@^7`
Expected: `package.json` và `package-lock.json` cập nhật, thêm `@react-navigation/bottom-tabs` vào `dependencies` với version tương thích `@react-navigation/native@^7`.

- [ ] **Step 2: Viết lại `RootNavigator.tsx`**

```tsx
// src/navigation/RootNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon } from 'react-native-paper';
import { SettingsScreen } from '../features/settings/screens/SettingsScreen';
import { SalesScreen } from '../features/sales/screens/SalesScreen';

export type RootTabParamList = {
  Sales: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export const RootNavigator: React.FC = () => (
  <NavigationContainer>
    <Tab.Navigator initialRouteName="Sales" screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Sales"
        component={SalesScreen}
        options={{
          title: 'Bán hàng',
          tabBarIcon: ({ color, size }) => <Icon source="point-of-sale" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Cài đặt',
          tabBarIcon: ({ color, size }) => <Icon source="cog" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  </NavigationContainer>
);
```

- [ ] **Step 3: Verify toàn bộ**

Run: `npm run verify`
Expected: type-check, lint, và toàn bộ test (bao gồm `useSalesLayoutMode.test.ts` từ Task 1) đều PASS. Lỗi type-check treo từ Task 4 (thiếu `RootTabParamList`) giờ phải hết vì `RootNavigator.tsx` đã export đúng type.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/navigation/RootNavigator.tsx
git commit -m "feat: wire Sales/Settings bottom tab navigation"
```

---

### Task 6: Manual verification trên thiết bị/emulator

**Files:** không tạo/sửa file — bước xác nhận thủ công trước khi coi sub-project này hoàn tất.

- [ ] **Step 1: Build và chạy app**

Run: `npm run android` (hoặc `npm run ios` nếu test trên iOS)
Expected: app mở vào thẳng tab "Bán hàng", không crash.

- [ ] **Step 2: Kiểm tra layout Tablet Landscape**

Trên emulator/thiết bị tablet, xoay ngang (hoặc set kích thước cửa sổ ≥ 600dp, width > height).
Expected: Product Area bên trái (~68%) hiển thị "Chưa có sản phẩm để hiển thị", Cart Panel bên phải (~32%) hiển thị Order Type (3 nút disabled), ô ghi chú disabled, "Giỏ hàng trống", nút "Thanh toán" disabled.

- [ ] **Step 3: Kiểm tra layout Tablet Portrait**

Xoay dọc trên cùng thiết bị tablet.
Expected: vẫn 2 cột nhưng Cart Panel thu hẹp hơn (~45% thay vì 32%).

- [ ] **Step 4: Kiểm tra layout Phone**

Trên emulator/thiết bị < 600dp.
Expected: Product Area chiếm toàn màn hình, thanh tổng tiền cố định "0 sản phẩm · 0đ" ở đáy. Bấm vào thanh này mở Modal chứa Cart Panel placeholder; bấm ra ngoài modal đóng lại.

- [ ] **Step 5: Kiểm tra điều hướng**

Bấm icon "cog" trên Top App Bar.
Expected: chuyển sang tab "Cài đặt" (màn hình Settings hiện tại). Bấm lại tab "Bán hàng" ở thanh tab dưới cùng quay lại Sales.

- [ ] **Step 6: Xác nhận và báo cáo**

Nếu tất cả bước trên đạt, sub-project 1 (Sales shell + navigation) hoàn tất. Nếu phát hiện lỗi, sửa trực tiếp trong task tương ứng ở trên, không tạo task mới ngoài kế hoạch trừ khi lỗi vượt phạm vi 5 task đã có.
