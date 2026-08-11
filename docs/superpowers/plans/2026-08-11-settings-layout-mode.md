# Settings Layout Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Settings screen the same phone/tablet responsive split the Sales screen already has, sourced from one shared, tested `LayoutMode` concept instead of a cross-feature import.

**Architecture:** Move the existing `useSalesLayoutMode` hook out of the `sales` feature into a new top-level `src/hooks/` dir as `useLayoutMode` (pure classification function + thin hook wrapper, unchanged logic). Update the two Sales call sites. Then build the Settings feature (`config/`, `store/`, `hooks/`, `components/`) on top of it: a pure `getSettingsView(layoutMode, activeMenuKey)` function drives which pane(s) render and the header title, mirroring the `getLayoutMode`/`useLayoutMode` split for testability.

**Tech Stack:** React Native (TypeScript strict), Redux Toolkit, React Native Paper, Jest.

## Global Constraints

- TypeScript strict, không dùng `any`.
- Toàn bộ text hiển thị cho người dùng: tiếng Việt.
- Component UI thuần trình bày (`components/*`) không có test file riêng — verify qua type-check + lint + manual. Chỉ file logic (hooks có nhánh rẽ, reducers, services...) mới có `.test.ts`.
- Test files colocate cùng thư mục với source file (`Foo.test.ts` cạnh `Foo.ts`) — theo convention hiện tại của 100% test file trong repo, không dùng `__tests__/`.
- Không cross-feature import: logic layout dùng chung phải nằm ở `src/hooks/`, không feature nào import thẳng từ hook nội bộ của feature khác.
- `tablet-portrait` và `tablet-landscape` xử lý layout Settings giống hệt nhau (`isTablet = layoutMode !== 'phone'`).
- Không thêm feature/abstraction/error-handling vượt quá yêu cầu.
- Chạy `npm run verify` (type-check + lint + test) trước khi coi 1 task là xong; chạy full suite 1 lần trước khi commit, không sau mỗi edit nhỏ.

---

### Task 1: Extract shared `useLayoutMode` hook

**Files:**
- Create (via `git mv` + edit): `src/hooks/useLayoutMode.ts`
- Create (via `git mv` + edit): `src/hooks/useLayoutMode.test.ts`
- Delete: `src/features/sales/hooks/useSalesLayoutMode.ts`
- Delete: `src/features/sales/hooks/useSalesLayoutMode.test.ts`
- Modify: `src/features/sales/components/ProductArea.tsx:17,20,22,30`
- Modify: `src/features/sales/screens/SalesScreen.tsx:13,17`

**Interfaces:**
- Produces: `LayoutMode = 'tablet-landscape' | 'tablet-portrait' | 'phone'`, `TABLET_MIN_DP: number`, `getLayoutMode(width: number, height: number): LayoutMode`, `useLayoutMode(): LayoutMode` — all from `src/hooks/useLayoutMode.ts`.

- [ ] **Step 1: Move the hook and its test with git mv (preserves history)**

```bash
mkdir -p src/hooks
git mv src/features/sales/hooks/useSalesLayoutMode.ts src/hooks/useLayoutMode.ts
git mv src/features/sales/hooks/useSalesLayoutMode.test.ts src/hooks/useLayoutMode.test.ts
```

- [ ] **Step 2: Rename the exports inside `src/hooks/useLayoutMode.ts`**

Replace the whole file with:

```ts
import { useWindowDimensions } from 'react-native';

export type LayoutMode =
  | 'tablet-landscape'
  | 'tablet-portrait'
  | 'phone';

/** Minimum shortest-side size in dp to classify the device as a tablet. */
export const TABLET_MIN_DP = 500;

/**
 * Determines the layout mode from the current window dimensions.
 * The shortest side is recalculated whenever the window size changes.
 */
export function getLayoutMode(
  width: number,
  height: number,
): LayoutMode {
  const shortestSide = Math.min(width, height);

  if (shortestSide < TABLET_MIN_DP) {
    return 'phone';
  }

  return width > height
    ? 'tablet-landscape'
    : 'tablet-portrait';
}

/**
 * Returns the current layout mode based on the window dimensions.
 * Recalculates when the window size changes.
 */
export function useLayoutMode(): LayoutMode {
  const { width, height } = useWindowDimensions();

  return getLayoutMode(width, height);
}
```

- [ ] **Step 3: Rename the references inside `src/hooks/useLayoutMode.test.ts`**

Replace the whole file with:

```ts
import {
  getLayoutMode,
  TABLET_MIN_DP,
} from './useLayoutMode';

describe('getLayoutMode', () => {
  describe('tablet layout', () => {
    it('returns tablet-landscape for a wide tablet viewport', () => {
      expect(getLayoutMode(1280, 800)).toBe('tablet-landscape');
    });

    it('returns tablet-portrait for a tall tablet viewport', () => {
      expect(getLayoutMode(800, 1280)).toBe('tablet-portrait');
    });

    it('returns tablet-portrait for a square tablet viewport', () => {
      expect(getLayoutMode(600, 600)).toBe('tablet-portrait');
    });

    it('returns tablet-landscape when the shortest side equals the tablet threshold', () => {
      expect(getLayoutMode(800, TABLET_MIN_DP)).toBe(
        'tablet-landscape',
      );
    });

    it('returns tablet-landscape when the shortest side is above the tablet threshold', () => {
      expect(getLayoutMode(960, TABLET_MIN_DP + 1)).toBe(
        'tablet-landscape',
      );
    });
  });

  describe('phone layout', () => {
    it('returns phone when the shortest side is below the tablet threshold', () => {
      expect(getLayoutMode(TABLET_MIN_DP - 1, 800)).toBe('phone');
    });

    it('returns phone for a portrait phone viewport', () => {
      expect(getLayoutMode(360, 800)).toBe('phone');
    });

    it('returns phone for a landscape phone viewport', () => {
      expect(getLayoutMode(800, 360)).toBe('phone');
    });
  });

  describe('tablet boundary', () => {
    it('treats the exact tablet threshold as a tablet', () => {
      expect(
        getLayoutMode(TABLET_MIN_DP, TABLET_MIN_DP),
      ).toBe('tablet-portrait');
    });

    it('treats one dp below the threshold as a phone', () => {
      expect(
        getLayoutMode(TABLET_MIN_DP - 1, TABLET_MIN_DP),
      ).toBe('phone');
    });
  });
});
```

- [ ] **Step 4: Run the moved test to confirm it still passes**

Run: `npx jest src/hooks/useLayoutMode.test.ts`
Expected: PASS, same case count as the old `useSalesLayoutMode.test.ts` had.

- [ ] **Step 5: Update `src/features/sales/components/ProductArea.tsx`**

Replace lines 17 and 20 (the two `useSalesLayoutMode` imports):

```ts
import { useSalesLayoutMode } from '../hooks/useSalesLayoutMode';
```
```ts
import type { SalesLayoutMode } from '../hooks/useSalesLayoutMode';
```

with a single combined import:

```ts
import { useLayoutMode, type LayoutMode } from '../../../hooks/useLayoutMode';
```

Then update the two usages:

```ts
const NUM_COLUMNS_BY_LAYOUT: Record<SalesLayoutMode, number> = {
```
becomes
```ts
const NUM_COLUMNS_BY_LAYOUT: Record<LayoutMode, number> = {
```

and

```ts
  const layoutMode = useSalesLayoutMode();
```
becomes
```ts
  const layoutMode = useLayoutMode();
```

- [ ] **Step 6: Update `src/features/sales/screens/SalesScreen.tsx`**

Replace:
```ts
import { useSalesLayoutMode } from '../hooks/useSalesLayoutMode';
```
with:
```ts
import { useLayoutMode } from '../../../hooks/useLayoutMode';
```

Replace:
```ts
  const layoutMode = useSalesLayoutMode();
```
with:
```ts
  const layoutMode = useLayoutMode();
```

- [ ] **Step 7: Confirm no stale references remain**

Run: `grep -rn "useSalesLayoutMode\|SalesLayoutMode" src/`
Expected: no output.

- [ ] **Step 8: Type-check and run the full test suite**

Run: `npm run type-check && npm test`
Expected: both pass, no new failures.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useLayoutMode.ts src/hooks/useLayoutMode.test.ts src/features/sales/components/ProductArea.tsx src/features/sales/screens/SalesScreen.tsx
git commit -m "refactor: extract useLayoutMode as a shared hook (was sales-only useSalesLayoutMode)"
```

---

### Task 2: Settings menu config + `settingsSlice` null support

**Files:**
- Create: `src/features/settings/config/settingsConfig.ts`
- Modify: `src/features/settings/store/settingsSlice.ts`
- Create: `src/features/settings/store/settingsSlice.test.ts`

**Interfaces:**
- Produces: `SettingsMenuItem { key: SettingsMenuKey; icon: string; label: string; group: 'device' | 'app'; disabled?: boolean }`, `settingsMenuItems: SettingsMenuItem[]`, `DEFAULT_TABLET_MENU_KEY: SettingsMenuKey` from `config/settingsConfig.ts`.
- Produces: `SettingsMenuKey = 'printer' | 'scanner' | 'account' | 'language' | 'sync' | 'info' | null`, `activeMenuKeyChanged(key: SettingsMenuKey)`, `selectActiveMenuKey(state): SettingsMenuKey` from `store/settingsSlice.ts` (unchanged names, `SettingsMenuKey` gains `null` and initial state becomes `null`).

- [ ] **Step 1: Write the failing test for `settingsSlice`**

Create `src/features/settings/store/settingsSlice.test.ts`:

```ts
import reducer, { activeMenuKeyChanged, selectActiveMenuKey } from './settingsSlice';

describe('settingsSlice', () => {
  const initialState = reducer(undefined, { type: '@@INIT' });

  it('starts with no active menu key selected', () => {
    expect(initialState.activeMenuKey).toBeNull();
  });

  it('activeMenuKeyChanged sets the active menu key', () => {
    const state = reducer(initialState, activeMenuKeyChanged('printer'));
    expect(state.activeMenuKey).toBe('printer');
  });

  it('activeMenuKeyChanged clears the active menu key back to null', () => {
    const state = reducer({ activeMenuKey: 'printer' }, activeMenuKeyChanged(null));
    expect(state.activeMenuKey).toBeNull();
  });

  it('selectActiveMenuKey reads the settings slice from RootState-shaped object', () => {
    const rootState = { settings: { activeMenuKey: 'printer' as const } };
    expect(selectActiveMenuKey(rootState)).toBe('printer');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx jest src/features/settings/store/settingsSlice.test.ts`
Expected: FAIL — `initialState.activeMenuKey` is currently `'printer'`, not `null`, and `activeMenuKeyChanged(null)` doesn't type-check against the current `SettingsMenuKey`.

- [ ] **Step 3: Update `src/features/settings/store/settingsSlice.ts`**

Replace the whole file with:

```ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type SettingsMenuKey =
  | 'printer'
  | 'scanner'
  | 'account'
  | 'language'
  | 'sync'
  | 'info'
  | null;

interface SettingsState {
  activeMenuKey: SettingsMenuKey;
}

const initialState: SettingsState = {
  activeMenuKey: null,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    activeMenuKeyChanged(state, action: PayloadAction<SettingsMenuKey>) {
      state.activeMenuKey = action.payload;
    },
  },
});

export const { activeMenuKeyChanged } = settingsSlice.actions;

interface StateWithSettings {
  settings: SettingsState;
}

export const selectActiveMenuKey = (state: StateWithSettings): SettingsMenuKey => state.settings.activeMenuKey;

export default settingsSlice.reducer;
```

- [ ] **Step 4: Run the test again to confirm it passes**

Run: `npx jest src/features/settings/store/settingsSlice.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Create `src/features/settings/config/settingsConfig.ts`**

```ts
import type { SettingsMenuKey } from '../store/settingsSlice';

export interface SettingsMenuItem {
  key: SettingsMenuKey;
  icon: string;
  label: string;
  group: 'device' | 'app';
  disabled?: boolean;
}

export const DEFAULT_TABLET_MENU_KEY: SettingsMenuKey = 'printer';

export const settingsMenuItems: SettingsMenuItem[] = [
  { key: 'printer', icon: 'printer', label: 'Quản lý máy in', group: 'device' },
  { key: 'scanner', icon: 'barcode-scan', label: 'Máy quét mã vạch', group: 'device', disabled: true },
  { key: 'account', icon: 'account', label: 'Tài khoản', group: 'app', disabled: true },
  { key: 'language', icon: 'translate', label: 'Ngôn ngữ', group: 'app', disabled: true },
  { key: 'sync', icon: 'cloud-outline', label: 'Đồng bộ dữ liệu', group: 'app', disabled: true },
  { key: 'info', icon: 'information-outline', label: 'Về ứng dụng', group: 'app', disabled: true },
];
```

- [ ] **Step 6: Type-check**

Run: `npm run type-check`
Expected: PASS. (No other file references `SettingsMenuKey`/`activeMenuKeyChanged`/`selectActiveMenuKey` yet outside `settingsSlice.ts` itself — confirmed via `grep -rn "activeMenuKeyChanged\|selectActiveMenuKey\|SettingsMenuKey" src/` before this task, only match was the slice file.)

- [ ] **Step 7: Commit**

```bash
git add src/features/settings/config/settingsConfig.ts src/features/settings/store/settingsSlice.ts src/features/settings/store/settingsSlice.test.ts
git commit -m "feat: add settings menu config and allow no active settings section"
```

---

### Task 3: `useSettings` hook with a testable `getSettingsView`

**Files:**
- Create: `src/features/settings/hooks/useSettings.ts`
- Create: `src/features/settings/hooks/useSettings.test.ts`

**Interfaces:**
- Consumes: `useLayoutMode(): LayoutMode`, `LayoutMode` from `../../../hooks/useLayoutMode` (Task 1). `selectActiveMenuKey`, `activeMenuKeyChanged`, `SettingsMenuKey` from `../store/settingsSlice` (Task 2). `settingsMenuItems`, `DEFAULT_TABLET_MENU_KEY` from `../config/settingsConfig` (Task 2). `AppDispatch` from `../../../store`.
- Produces: `SettingsView { isTablet: boolean; activeSection: SettingsMenuKey; headerTitle: string }`, `getSettingsView(layoutMode: LayoutMode, activeMenuKey: SettingsMenuKey): SettingsView`, `useSettings(): SettingsView & { selectSection: (section: SettingsMenuKey) => void; clearSection: () => void }` — both consumed by Task 6 (`SettingsScreen.tsx`).

- [ ] **Step 1: Write the failing test for `getSettingsView`**

Create `src/features/settings/hooks/useSettings.test.ts`:

```ts
import { getSettingsView } from './useSettings';

describe('getSettingsView', () => {
  describe('phone', () => {
    it('shows the sidebar (no active section) when nothing is selected yet', () => {
      const view = getSettingsView('phone', null);
      expect(view).toEqual({ isTablet: false, activeSection: null, headerTitle: 'Cài đặt' });
    });

    it('shows the selected section with its label as the header title', () => {
      const view = getSettingsView('phone', 'printer');
      expect(view).toEqual({ isTablet: false, activeSection: 'printer', headerTitle: 'Quản lý máy in' });
    });
  });

  describe('tablet', () => {
    it.each(['tablet-portrait', 'tablet-landscape'] as const)(
      'falls back to the default menu key on %s when nothing is selected yet',
      (layoutMode) => {
        const view = getSettingsView(layoutMode, null);
        expect(view).toEqual({ isTablet: true, activeSection: 'printer', headerTitle: 'Cài đặt' });
      },
    );

    it('keeps the selected section but always shows the generic header title', () => {
      const view = getSettingsView('tablet-landscape', 'account');
      expect(view).toEqual({ isTablet: true, activeSection: 'account', headerTitle: 'Cài đặt' });
    });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx jest src/features/settings/hooks/useSettings.test.ts`
Expected: FAIL — `./useSettings` doesn't exist yet (module not found).

- [ ] **Step 3: Create `src/features/settings/hooks/useSettings.ts`**

```ts
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../../../store';
import { useLayoutMode, type LayoutMode } from '../../../hooks/useLayoutMode';
import { selectActiveMenuKey, activeMenuKeyChanged, type SettingsMenuKey } from '../store/settingsSlice';
import { settingsMenuItems, DEFAULT_TABLET_MENU_KEY } from '../config/settingsConfig';

export interface SettingsView {
  isTablet: boolean;
  activeSection: SettingsMenuKey;
  headerTitle: string;
}

export function getSettingsView(
  layoutMode: LayoutMode,
  activeMenuKey: SettingsMenuKey,
): SettingsView {
  const isTablet = layoutMode !== 'phone';
  const activeSection = isTablet ? (activeMenuKey ?? DEFAULT_TABLET_MENU_KEY) : activeMenuKey;
  const activeItem = settingsMenuItems.find((item) => item.key === activeSection);
  const headerTitle = !isTablet && activeItem ? activeItem.label : 'Cài đặt';

  return { isTablet, activeSection, headerTitle };
}

export function useSettings() {
  const dispatch = useDispatch<AppDispatch>();
  const layoutMode = useLayoutMode();
  const activeMenuKey = useSelector(selectActiveMenuKey);
  const { isTablet, activeSection, headerTitle } = getSettingsView(layoutMode, activeMenuKey);

  const selectSection = (section: SettingsMenuKey): void => {
    dispatch(activeMenuKeyChanged(section));
  };

  const clearSection = (): void => {
    dispatch(activeMenuKeyChanged(null));
  };

  return {
    isTablet,
    activeSection,
    selectSection,
    clearSection,
    headerTitle,
  };
}
```

- [ ] **Step 4: Run the test again to confirm it passes**

Run: `npx jest src/features/settings/hooks/useSettings.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/hooks/useSettings.ts src/features/settings/hooks/useSettings.test.ts
git commit -m "feat: add useSettings hook driving Settings layout from LayoutMode"
```

---

### Task 4: `SettingsHeader` and `SettingsSidebarItem` components

**Files:**
- Create: `src/features/settings/components/SettingsHeader.tsx`
- Create: `src/features/settings/components/SettingsSidebarItem.tsx`

**Interfaces:**
- Consumes: `SettingsMenuItem` from `../config/settingsConfig` (Task 2). `StatusDot` from `../../../components/StatusDot` (existing).
- Produces: `SettingsHeader({ title: string; showBackButton: boolean; onBackPress: () => void })`, `SettingsSidebarItem({ item: SettingsMenuItem; isActive: boolean; isTablet: boolean; hasConnectedPrinter: boolean; onPress: () => void })` — both consumed by Task 5/6.

These are pure presentational components — no dedicated test file per project convention (verified via type-check + lint + manual check in Task 7).

- [ ] **Step 1: Create `src/features/settings/components/SettingsHeader.tsx`**

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton, useTheme } from 'react-native-paper';

interface SettingsHeaderProps {
  title: string;
  showBackButton: boolean;
  onBackPress: () => void;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({
  title,
  showBackButton,
  onBackPress,
}) => {
  const theme = useTheme();

  return (
    <View style={[styles.header, { borderBottomColor: theme.colors.outlineVariant }]}>
      {showBackButton && (
        <IconButton
          icon="arrow-left"
          size={20}
          onPress={onBackPress}
          style={styles.backButton}
        />
      )}
      <Text
        variant="titleMedium"
        style={[styles.headerTitle, { color: theme.colors.onSurface }]}
      >
        {title}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 56,
  },
  backButton: {
    margin: 0,
    marginRight: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontWeight: '600',
  },
});
```

- [ ] **Step 2: Create `src/features/settings/components/SettingsSidebarItem.tsx`**

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TouchableRipple, Icon, useTheme } from 'react-native-paper';
import { StatusDot } from '../../../components/StatusDot';
import { type SettingsMenuItem } from '../config/settingsConfig';

interface SettingsSidebarItemProps {
  item: SettingsMenuItem;
  isActive: boolean;
  isTablet: boolean;
  hasConnectedPrinter: boolean;
  onPress: () => void;
}

export const SettingsSidebarItem: React.FC<SettingsSidebarItemProps> = ({
  item,
  isActive,
  isTablet,
  hasConnectedPrinter,
  onPress,
}) => {
  const theme = useTheme();

  const color = item.disabled
    ? theme.colors.outline
    : isActive && isTablet
    ? theme.colors.primary
    : theme.colors.onSurface;

  const content = (
    <View style={styles.itemRow}>
      <Icon source={item.icon} size={16} color={color} />
      <Text
        style={[
          styles.itemLabel,
          isActive && isTablet && styles.itemLabelActive,
          { color },
        ]}
      >
        {item.label}
      </Text>
      {!item.disabled && item.key === 'printer' && hasConnectedPrinter && (
        <StatusDot status="connected" />
      )}
      {!item.disabled && !isTablet && (
        <Icon source="chevron-right" size={16} color={theme.colors.outline} />
      )}
    </View>
  );

  if (item.disabled) {
    return <View style={styles.item}>{content}</View>;
  }

  return (
    <TouchableRipple
      style={[
        styles.item,
        isActive && isTablet && { backgroundColor: theme.colors.primaryContainer },
      ]}
      onPress={onPress}
    >
      {content}
    </TouchableRipple>
  );
};

const styles = StyleSheet.create({
  item: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemLabel: { fontSize: 13, flex: 1 },
  itemLabelActive: { fontWeight: '500' },
});
```

- [ ] **Step 3: Type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: both pass. (`SettingsSidebarItem`/`SettingsHeader` aren't imported anywhere yet, so no unused-export lint errors are expected, but confirm.)

- [ ] **Step 4: Commit**

```bash
git add src/features/settings/components/SettingsHeader.tsx src/features/settings/components/SettingsSidebarItem.tsx
git commit -m "feat: add SettingsHeader and SettingsSidebarItem components"
```

---

### Task 5: Rewire `SettingsSidebar` and `SettingsContent`

**Files:**
- Modify: `src/features/settings/components/SettingsSidebar.tsx` (full rewrite)
- Modify: `src/features/settings/components/SettingsContent.tsx` (full rewrite)

**Interfaces:**
- Consumes: `settingsMenuItems`, `SettingsMenuItem` from `../config/settingsConfig` (Task 2). `SettingsMenuKey` from `../store/settingsSlice` (Task 2). `SettingsSidebarItem` from `./SettingsSidebarItem` (Task 4).
- Produces: `SettingsSidebar({ activeSection: SettingsMenuKey; onSelectSection: (s: SettingsMenuKey) => void; isTablet: boolean })`, `SettingsContent({ activeSection: SettingsMenuKey })` — both consumed by Task 6.

- [ ] **Step 1: Replace `src/features/settings/components/SettingsSidebar.tsx`**

```tsx
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TouchableRipple, Icon, useTheme } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { selectPrinters } from '../../printer/store/printerSlice';
import { PrinterService } from '../../printer/services/PrinterService';
import { useAuth } from '../../auth/hooks/useAuth';
import { StoreService } from '../../store/services/StoreService';
import { storeCleared } from '../../store/store/storeSlice';
import { settingsMenuItems, type SettingsMenuItem } from '../config/settingsConfig';
import type { SettingsMenuKey } from '../store/settingsSlice';
import { SettingsSidebarItem } from './SettingsSidebarItem';

interface SettingsSidebarProps {
  activeSection: SettingsMenuKey;
  onSelectSection: (section: SettingsMenuKey) => void;
  isTablet: boolean;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeSection,
  onSelectSection,
  isTablet,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const printers = useSelector((state: RootState) => selectPrinters(state));
  const hasConnectedPrinter = printers.some((p) => PrinterService.getStatus(p.id) === 'connected');
  const { logout } = useAuth();
  const [confirmLogoutVisible, setConfirmLogoutVisible] = useState(false);
  const [confirmChangeStoreVisible, setConfirmChangeStoreVisible] = useState(false);
  const theme = useTheme();

  const confirmLogout = (): void => {
    setConfirmLogoutVisible(false);
    logout();
  };

  const confirmChangeStore = (): void => {
    setConfirmChangeStoreVisible(false);
    StoreService.clearStoreId();
    dispatch(storeCleared());
  };

  const renderItem = (item: SettingsMenuItem) => (
    <SettingsSidebarItem
      key={item.label}
      item={item}
      isActive={activeSection === item.key}
      isTablet={isTablet}
      hasConnectedPrinter={hasConnectedPrinter}
      onPress={() => onSelectSection(item.key)}
    />
  );

  return (
    <View
      style={[
        styles.container,
        isTablet
          ? [styles.sidebarTablet, { borderRightColor: theme.colors.outlineVariant }]
          : styles.sidebarPhone,
      ]}
    >
      <Text style={[styles.groupLabel, { color: theme.colors.outline }]}>Thiết bị</Text>
      {settingsMenuItems.filter((item) => item.group === 'device').map(renderItem)}

      <Text style={[styles.groupLabel, { color: theme.colors.outline }]}>Ứng dụng</Text>
      {settingsMenuItems.filter((item) => item.group === 'app').map(renderItem)}

      <View style={styles.spacer} />
      <TouchableRipple style={styles.item} onPress={() => setConfirmChangeStoreVisible(true)}>
        <View style={styles.itemRow}>
          <Icon source="store-outline" size={16} color={theme.colors.onSurface} />
          <Text style={[styles.itemLabel, { color: theme.colors.onSurface }]}>Đổi cửa hàng</Text>
        </View>
      </TouchableRipple>
      <TouchableRipple style={styles.item} onPress={() => setConfirmLogoutVisible(true)}>
        <View style={styles.itemRow}>
          <Icon source="logout" size={16} color={theme.colors.onSurface} />
          <Text style={[styles.itemLabel, { color: theme.colors.onSurface }]}>Đăng xuất</Text>
        </View>
      </TouchableRipple>

      <ConfirmDialog
        visible={confirmChangeStoreVisible}
        title="Đổi cửa hàng"
        message="Quay lại màn chọn cửa hàng?"
        confirmLabel="Đổi cửa hàng"
        onConfirm={confirmChangeStore}
        onCancel={() => setConfirmChangeStoreVisible(false)}
      />
      <ConfirmDialog
        visible={confirmLogoutVisible}
        title="Đăng xuất"
        message="Bạn có chắc muốn đăng xuất không?"
        confirmLabel="Đăng xuất"
        onConfirm={confirmLogout}
        onCancel={() => setConfirmLogoutVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 8 },
  sidebarTablet: { width: 220, borderRightWidth: StyleSheet.hairlineWidth },
  sidebarPhone: { flex: 1 },
  groupLabel: { fontSize: 11, marginTop: 8, marginBottom: 4, marginLeft: 6 },
  item: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemLabel: { fontSize: 13, flex: 1 },
  spacer: { flex: 1 },
});
```

- [ ] **Step 2: Replace `src/features/settings/components/SettingsContent.tsx`**

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PrinterManagementPanel } from '../../printer/components/PrinterManagementPanel';
import type { SettingsMenuKey } from '../store/settingsSlice';

interface SettingsContentProps {
  activeSection: SettingsMenuKey;
}

export const SettingsContent: React.FC<SettingsContentProps> = ({ activeSection }) => (
  <View style={styles.container}>
    {activeSection === 'printer' && <PrinterManagementPanel />}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
});
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: FAIL at this point — `SettingsScreen.tsx` (Task 6) still renders `<SettingsSidebar />`/`<SettingsContent />` with no props. This is expected; Task 6 fixes it. Confirm the only errors are in `SettingsScreen.tsx` (missing required props), not in the two files just edited.

- [ ] **Step 4: Commit**

```bash
git add src/features/settings/components/SettingsSidebar.tsx src/features/settings/components/SettingsContent.tsx
git commit -m "feat: make SettingsSidebar and SettingsContent props-driven"
```

---

### Task 6: Wire `SettingsScreen` and update docs

**Files:**
- Modify: `src/features/settings/screens/SettingsScreen.tsx` (full rewrite)
- Modify: `CLAUDE.md` (repo root — Source Structure tree)

**Interfaces:**
- Consumes: `useSettings()` from `../hooks/useSettings` (Task 3). `SettingsHeader` (Task 4), `SettingsSidebar`, `SettingsContent` (Task 5).

- [ ] **Step 1: Replace `src/features/settings/screens/SettingsScreen.tsx`**

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';
import { SettingsSidebar } from '../components/SettingsSidebar';
import { SettingsContent } from '../components/SettingsContent';
import { SettingsHeader } from '../components/SettingsHeader';
import { useSettings } from '../hooks/useSettings';

export const SettingsScreen: React.FC = () => {
  const { isTablet, activeSection, selectSection, clearSection, headerTitle } = useSettings();
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <SettingsHeader
        title={headerTitle}
        showBackButton={!isTablet && activeSection !== null}
        onBackPress={clearSection}
      />
      <View style={styles.body}>
        {(isTablet || activeSection === null) && (
          <SettingsSidebar
            activeSection={activeSection}
            onSelectSection={selectSection}
            isTablet={isTablet}
          />
        )}
        {(isTablet || activeSection !== null) && (
          <SettingsContent activeSection={activeSection} />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  body: { flex: 1, flexDirection: 'row' },
});
```

- [ ] **Step 2: Type-check the whole project**

Run: `npm run type-check`
Expected: PASS, no errors anywhere.

- [ ] **Step 3: Update `NDTCore.App/CLAUDE.md` Source Structure tree**

Find the tree block under `### Source Structure` and insert a `hooks/` line between `features/` and `navigation/`:

```
├── features/
│   ├── printer/         # Xem "Printer Module" bên dưới
│   ├── sales/           # Sales screen shell — hooks/, components/, screens/. Static,
│   │                    # responsive, chưa có product/cart data — xem
│   │                    # docs/superpowers/specs/2026-08-06-sales-shell-navigation-design.md
│   └── settings/        # Settings shell — sidebar + content theo activeMenuKey (Redux)
├── navigation/           # RootNavigator (bottom-tabs), 2 tab: Sales (initial route), Settings
```

becomes:

```
├── features/
│   ├── printer/         # Xem "Printer Module" bên dưới
│   ├── sales/           # Sales screen shell — hooks/, components/, screens/. Static,
│   │                    # responsive, chưa có product/cart data — xem
│   │                    # docs/superpowers/specs/2026-08-06-sales-shell-navigation-design.md
│   └── settings/        # Settings shell — sidebar + content theo LayoutMode/activeMenuKey (Redux)
├── hooks/                # Hook dùng chung nhiều feature (vd: useLayoutMode — phone/tablet-portrait/tablet-landscape)
├── navigation/           # RootNavigator (bottom-tabs), 2 tab: Sales (initial route), Settings
```

- [ ] **Step 4: Run the full verify suite**

Run: `npm run verify`
Expected: type-check, lint, and all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/screens/SettingsScreen.tsx CLAUDE.md
git commit -m "feat: wire Settings screen to LayoutMode-driven master-detail navigation"
```

---

### Task 7: Manual verification

**Files:** none (verification only).

- [ ] **Step 1: Start the web build**

Run: `npm run web` (or the project's web dev command) and open it in a browser.

- [ ] **Step 2: Verify tablet-landscape layout**

Resize the browser window to at least 500×500 with width > height (e.g. 1280×800). Open the Settings tab.
Expected: sidebar (with "Quản lý máy in" + disabled items + "Đổi cửa hàng"/"Đăng xuất") and the printer panel render side by side. Header shows "Cài đặt" with no back button.

- [ ] **Step 3: Verify tablet-portrait layout**

Resize to width ≤ height with the shortest side ≥ 500 (e.g. 600×900).
Expected: same side-by-side sidebar+content layout as landscape (per Global Constraints, portrait and landscape tablet behave identically).

- [ ] **Step 4: Verify phone layout — sidebar-only state**

Resize to a phone-sized viewport (e.g. 375×812).
Expected: only the menu list renders (no printer panel), header shows "Cài đặt" with no back button.

- [ ] **Step 5: Verify phone layout — detail state**

Tap "Quản lý máy in" in the phone-sized sidebar.
Expected: sidebar disappears, printer panel renders alone, header shows "Quản lý máy in" with a back button. Tapping the back button returns to the sidebar-only state.

- [ ] **Step 6: Verify resizing preserves selection correctly**

While in the phone detail state from Step 5 (an item selected), resize the window to tablet size.
Expected: sidebar and content both appear, with "Quản lý máy in" still highlighted as active in the sidebar (no jump back to a default).

- [ ] **Step 7: Report results**

If any step doesn't match, note the exact viewport size and what rendered instead before fixing.

---
