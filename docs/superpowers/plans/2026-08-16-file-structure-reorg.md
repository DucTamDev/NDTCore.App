# File Structure Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all 17 non-printer `.test.ts` files into `__tests__/` subfolders, extract `StoreCard` out of `StoreSelectScreen.tsx` into `store/components/`, and document both the resulting test-file convention and the data-owning-vs-shell feature distinction in `CLAUDE.md`.

**Architecture:** Each test file is `git mv`'d into a `__tests__/` subfolder in its current directory, then its relative import/`jest.mock` paths are adjusted by exactly one `../` level (bare-specifier mocks of installed packages are untouched). No source file being tested is ever modified. `StoreCard` extraction is a standard component-extraction with zero behavior change. All work is zero-risk to production behavior — verified by running the affected test(s) after every move and a full suite pass at the end.

**Tech Stack:** React Native CLI + TypeScript strict, Jest (`preset: 'react-native'`, default `testMatch` — auto-discovers `__tests__/` folders, confirmed no `jest.config.js` change needed).

**Spec:** `docs/superpowers/specs/2026-08-16-file-structure-reorg-design.md`

## Global Constraints

- Zero behavior change — no test assertion changes, no component rendered-output changes anywhere in this plan.
- Only **relative** (`./` or `../`) import/`jest.mock` paths get adjusted when a file moves. Bare-specifier `jest.mock('package-name')` calls (installed packages) are untouched.
- `src/features/printer/`'s 22 test files are explicitly out of scope — do not touch anything under `src/features/printer/`.
- No `jest.config.js` changes.
- Toàn bộ text hiển thị cho người dùng: tiếng Việt (unaffected by this plan — no UI text changes).
- TypeScript strict, no `any`.

---

### Task 1: Move `auth` test files into `__tests__/`

**Files:**
- Move: `src/features/auth/services/AuthService.test.ts` → `src/features/auth/services/__tests__/AuthService.test.ts`
- Move: `src/features/auth/store/authSlice.test.ts` → `src/features/auth/store/__tests__/authSlice.test.ts`

**Interfaces:** None — pure file relocation, no exported symbol changes.

- [ ] **Step 1: Move `AuthService.test.ts`**

```bash
git mv src/features/auth/services/AuthService.test.ts src/features/auth/services/__tests__/AuthService.test.ts
```

- [ ] **Step 2: Fix its relative import paths**

In `src/features/auth/services/__tests__/AuthService.test.ts`, replace:

```ts
import { AuthService } from './AuthService';
import { authApi } from '../api/authApi';
import { clearTokens } from '../../../services/http/authTokenStorage';
```

with:

```ts
import { AuthService } from '../AuthService';
import { authApi } from '../../api/authApi';
import { clearTokens } from '../../../../services/http/authTokenStorage';
```

And replace:

```ts
jest.mock('../api/authApi', () => ({
```

with:

```ts
jest.mock('../../api/authApi', () => ({
```

- [ ] **Step 3: Move `authSlice.test.ts`**

```bash
git mv src/features/auth/store/authSlice.test.ts src/features/auth/store/__tests__/authSlice.test.ts
```

- [ ] **Step 4: Fix its relative import path**

In `src/features/auth/store/__tests__/authSlice.test.ts`, replace:

```ts
} from './authSlice';
```

with:

```ts
} from '../authSlice';
```

- [ ] **Step 5: Verify**

Run: `npx jest src/features/auth/services/__tests__/AuthService.test.ts src/features/auth/store/__tests__/authSlice.test.ts`
Expected: both suites PASS with the same test names/counts as before the move.

- [ ] **Step 6: Commit**

```bash
git add src/features/auth/services/AuthService.test.ts src/features/auth/services/__tests__/AuthService.test.ts src/features/auth/store/authSlice.test.ts src/features/auth/store/__tests__/authSlice.test.ts
git commit -m "chore: move auth test files into __tests__/ subfolders"
```

---

### Task 2: Move `cart` test files into `__tests__/`

**Files:**
- Move: `src/features/cart/services/CartService.test.ts` → `src/features/cart/services/__tests__/CartService.test.ts`
- Move: `src/features/cart/services/OrderPrintTrigger.test.ts` → `src/features/cart/services/__tests__/OrderPrintTrigger.test.ts`
- Move: `src/features/cart/store/cartSlice.test.ts` → `src/features/cart/store/__tests__/cartSlice.test.ts`

**Interfaces:** None — pure file relocation.

- [ ] **Step 1: Move `CartService.test.ts`**

```bash
git mv src/features/cart/services/CartService.test.ts src/features/cart/services/__tests__/CartService.test.ts
```

- [ ] **Step 2: Fix its relative import paths**

In `src/features/cart/services/__tests__/CartService.test.ts`, replace:

```ts
import { CartService } from './CartService';
import type { CartItem } from '../types/cart.types';
import type { OptionGroupViewModel, ProductViewModel } from '../../catalog/types/catalog.types';
```

with:

```ts
import { CartService } from '../CartService';
import type { CartItem } from '../../types/cart.types';
import type { OptionGroupViewModel, ProductViewModel } from '../../../catalog/types/catalog.types';
```

- [ ] **Step 3: Move `OrderPrintTrigger.test.ts`**

```bash
git mv src/features/cart/services/OrderPrintTrigger.test.ts src/features/cart/services/__tests__/OrderPrintTrigger.test.ts
```

- [ ] **Step 4: Fix its relative import and mock paths**

In `src/features/cart/services/__tests__/OrderPrintTrigger.test.ts`, replace:

```ts
import { buildReceiptDocument, printReceipt } from './OrderPrintTrigger';
import { PrintService } from '../../printer/services/PrintService';
import { LoggerService } from '../../../services/LoggerService';
import type { CartItem, CreateOrderResponse } from '../types/cart.types';
```

with:

```ts
import { buildReceiptDocument, printReceipt } from '../OrderPrintTrigger';
import { PrintService } from '../../../printer/services/PrintService';
import { LoggerService } from '../../../../services/LoggerService';
import type { CartItem, CreateOrderResponse } from '../../types/cart.types';
```

And replace:

```ts
jest.mock('../../printer/services/PrintService');
jest.mock('../../../services/LoggerService');
```

with:

```ts
jest.mock('../../../printer/services/PrintService');
jest.mock('../../../../services/LoggerService');
```

- [ ] **Step 5: Move `cartSlice.test.ts`**

```bash
git mv src/features/cart/store/cartSlice.test.ts src/features/cart/store/__tests__/cartSlice.test.ts
```

- [ ] **Step 6: Fix its relative import paths**

In `src/features/cart/store/__tests__/cartSlice.test.ts`, replace:

```ts
} from './cartSlice';
import { loggedOut } from '../../auth/store/authSlice';
import { storeCleared } from '../../store/store/storeSlice';
import type { CartItem } from '../types/cart.types';
```

with:

```ts
} from '../cartSlice';
import { loggedOut } from '../../../auth/store/authSlice';
import { storeCleared } from '../../../store/store/storeSlice';
import type { CartItem } from '../../types/cart.types';
```

- [ ] **Step 7: Verify**

Run: `npx jest src/features/cart/services/__tests__/CartService.test.ts src/features/cart/services/__tests__/OrderPrintTrigger.test.ts src/features/cart/store/__tests__/cartSlice.test.ts`
Expected: all 3 suites PASS with the same test names/counts as before the move.

- [ ] **Step 8: Commit**

```bash
git add src/features/cart/services/CartService.test.ts src/features/cart/services/__tests__/CartService.test.ts src/features/cart/services/OrderPrintTrigger.test.ts src/features/cart/services/__tests__/OrderPrintTrigger.test.ts src/features/cart/store/cartSlice.test.ts src/features/cart/store/__tests__/cartSlice.test.ts
git commit -m "chore: move cart test files into __tests__/ subfolders"
```

---

### Task 3: Move `catalog` test files into `__tests__/`

**Files:**
- Move: `src/features/catalog/services/CatalogService.test.ts` → `src/features/catalog/services/__tests__/CatalogService.test.ts`
- Move: `src/features/catalog/store/catalogSlice.test.ts` → `src/features/catalog/store/__tests__/catalogSlice.test.ts`

**Interfaces:** None — pure file relocation.

- [ ] **Step 1: Move `CatalogService.test.ts`**

```bash
git mv src/features/catalog/services/CatalogService.test.ts src/features/catalog/services/__tests__/CatalogService.test.ts
```

- [ ] **Step 2: Fix its relative import and mock paths**

In `src/features/catalog/services/__tests__/CatalogService.test.ts`, replace:

```ts
import { CatalogService } from './CatalogService';
import { catalogApi } from '../api/catalogApi';
import { ALL_CATEGORY_ID } from '../types/catalog.types';
import type { CategoryViewModel, ProductViewModel } from '../types/catalog.types';
```

with:

```ts
import { CatalogService } from '../CatalogService';
import { catalogApi } from '../../api/catalogApi';
import { ALL_CATEGORY_ID } from '../../types/catalog.types';
import type { CategoryViewModel, ProductViewModel } from '../../types/catalog.types';
```

And replace:

```ts
jest.mock('../api/catalogApi', () => ({
```

with:

```ts
jest.mock('../../api/catalogApi', () => ({
```

- [ ] **Step 3: Move `catalogSlice.test.ts`**

```bash
git mv src/features/catalog/store/catalogSlice.test.ts src/features/catalog/store/__tests__/catalogSlice.test.ts
```

- [ ] **Step 4: Fix its relative import paths**

In `src/features/catalog/store/__tests__/catalogSlice.test.ts`, replace:

```ts
} from './catalogSlice';
import { loggedOut } from '../../auth/store/authSlice';
import { storeCleared } from '../../store/store/storeSlice';
import type { CategoryViewModel, ProductViewModel } from '../types/catalog.types';
```

with:

```ts
} from '../catalogSlice';
import { loggedOut } from '../../../auth/store/authSlice';
import { storeCleared } from '../../../store/store/storeSlice';
import type { CategoryViewModel, ProductViewModel } from '../../types/catalog.types';
```

- [ ] **Step 5: Verify**

Run: `npx jest src/features/catalog/services/__tests__/CatalogService.test.ts src/features/catalog/store/__tests__/catalogSlice.test.ts`
Expected: both suites PASS with the same test names/counts as before the move.

- [ ] **Step 6: Commit**

```bash
git add src/features/catalog/services/CatalogService.test.ts src/features/catalog/services/__tests__/CatalogService.test.ts src/features/catalog/store/catalogSlice.test.ts src/features/catalog/store/__tests__/catalogSlice.test.ts
git commit -m "chore: move catalog test files into __tests__/ subfolders"
```

---

### Task 4: Move `settings` test files into `__tests__/`

**Files:**
- Move: `src/features/settings/hooks/useSettings.test.ts` → `src/features/settings/hooks/__tests__/useSettings.test.ts`
- Move: `src/features/settings/store/settingsSlice.test.ts` → `src/features/settings/store/__tests__/settingsSlice.test.ts`

**Interfaces:** None — pure file relocation.

- [ ] **Step 1: Move `useSettings.test.ts`**

```bash
git mv src/features/settings/hooks/useSettings.test.ts src/features/settings/hooks/__tests__/useSettings.test.ts
```

- [ ] **Step 2: Fix its relative import path**

In `src/features/settings/hooks/__tests__/useSettings.test.ts`, replace:

```ts
import { getSettingsView } from './useSettings';
```

with:

```ts
import { getSettingsView } from '../useSettings';
```

- [ ] **Step 3: Move `settingsSlice.test.ts`**

```bash
git mv src/features/settings/store/settingsSlice.test.ts src/features/settings/store/__tests__/settingsSlice.test.ts
```

- [ ] **Step 4: Fix its relative import path**

In `src/features/settings/store/__tests__/settingsSlice.test.ts`, replace:

```ts
import reducer, { activeMenuKeyChanged, selectActiveMenuKey } from './settingsSlice';
```

with:

```ts
import reducer, { activeMenuKeyChanged, selectActiveMenuKey } from '../settingsSlice';
```

- [ ] **Step 5: Verify**

Run: `npx jest src/features/settings/hooks/__tests__/useSettings.test.ts src/features/settings/store/__tests__/settingsSlice.test.ts`
Expected: both suites PASS with the same test names/counts as before the move.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/hooks/useSettings.test.ts src/features/settings/hooks/__tests__/useSettings.test.ts src/features/settings/store/settingsSlice.test.ts src/features/settings/store/__tests__/settingsSlice.test.ts
git commit -m "chore: move settings test files into __tests__/ subfolders"
```

---

### Task 5: Move `store` (feature) test files into `__tests__/`

**Files:**
- Move: `src/features/store/services/StoreService.test.ts` → `src/features/store/services/__tests__/StoreService.test.ts`
- Move: `src/features/store/store/storeSlice.test.ts` → `src/features/store/store/__tests__/storeSlice.test.ts`

**Interfaces:** None — pure file relocation.

- [ ] **Step 1: Move `StoreService.test.ts`**

```bash
git mv src/features/store/services/StoreService.test.ts src/features/store/services/__tests__/StoreService.test.ts
```

- [ ] **Step 2: Fix its relative import and mock paths**

In `src/features/store/services/__tests__/StoreService.test.ts`, replace:

```ts
import { StoreService } from './StoreService';
import { storeApi } from '../api/storeApi';
import { StorageService } from '../../../services/StorageService';
```

with:

```ts
import { StoreService } from '../StoreService';
import { storeApi } from '../../api/storeApi';
import { StorageService } from '../../../../services/StorageService';
```

And replace:

```ts
jest.mock('../api/storeApi', () => ({
```

with:

```ts
jest.mock('../../api/storeApi', () => ({
```

- [ ] **Step 3: Move `storeSlice.test.ts`**

```bash
git mv src/features/store/store/storeSlice.test.ts src/features/store/store/__tests__/storeSlice.test.ts
```

- [ ] **Step 4: Fix its relative import paths**

In `src/features/store/store/__tests__/storeSlice.test.ts`, replace:

```ts
} from './storeSlice';
import { loggedOut } from '../../auth/store/authSlice';
import type { StoreViewModel } from '../types/store.types';
```

with:

```ts
} from '../storeSlice';
import { loggedOut } from '../../../auth/store/authSlice';
import type { StoreViewModel } from '../../types/store.types';
```

- [ ] **Step 5: Verify**

Run: `npx jest src/features/store/services/__tests__/StoreService.test.ts src/features/store/store/__tests__/storeSlice.test.ts`
Expected: both suites PASS with the same test names/counts as before the move.

- [ ] **Step 6: Commit**

```bash
git add src/features/store/services/StoreService.test.ts src/features/store/services/__tests__/StoreService.test.ts src/features/store/store/storeSlice.test.ts src/features/store/store/__tests__/storeSlice.test.ts
git commit -m "chore: move store test files into __tests__/ subfolders"
```

---

### Task 6: Extract `StoreCard` into `store/components/`

**Files:**
- Create: `src/features/store/components/StoreCard.tsx`
- Modify: `src/features/store/screens/StoreSelectScreen.tsx`

**Interfaces:**
- Produces: `StoreCard: React.FC<{ store: StoreViewModel; onPress: () => void }>` — exported from `../components/StoreCard`, imported by `StoreSelectScreen.tsx`.

No new test — `StoreCard` is a presentational component, matching this repo's established convention (only logic files get `.test.ts`).

- [ ] **Step 1: Create `StoreCard.tsx`**

Create `src/features/store/components/StoreCard.tsx`:

```tsx
// src/features/store/components/StoreCard.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TouchableRipple, Chip } from 'react-native-paper';
import type { StoreViewModel } from '../types/store.types';

interface StoreCardProps {
  store: StoreViewModel;
  onPress: () => void;
}

export const StoreCard: React.FC<StoreCardProps> = ({ store, onPress }) => {
  const addressLine = [store.address, store.district, store.province].filter(Boolean).join(', ');

  return (
    <TouchableRipple style={styles.card} onPress={onPress} disabled={!store.isActive}>
      <View>
        <Text variant="titleMedium">{store.name}</Text>
        <Text variant="bodySmall" style={styles.code}>
          {store.code}
        </Text>
        {addressLine ? (
          <Text variant="bodySmall" style={styles.address}>
            {addressLine}
          </Text>
        ) : null}
        {store.isAcceptingOrders ? (
          <Chip compact style={styles.chip}>
            Đang nhận đơn
          </Chip>
        ) : null}
      </View>
    </TouchableRipple>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 260,
    padding: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  code: { color: '#6B7280', marginTop: 2 },
  address: { color: '#6B7280', marginTop: 8 },
  chip: { marginTop: 8, alignSelf: 'flex-start' },
});
```

- [ ] **Step 2: Replace `StoreSelectScreen.tsx` in full**

Replace all of `src/features/store/screens/StoreSelectScreen.tsx` with:

```tsx
// src/features/store/screens/StoreSelectScreen.tsx
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
import { useStoreSelection } from '../hooks/useStoreSelection';
import { useAuth } from '../../auth/hooks/useAuth';
import { StoreCard } from '../components/StoreCard';

export const StoreSelectScreen: React.FC = () => {
  const { stores, isLoading, error, selectStore, retry } = useStoreSelection();
  const { logout } = useAuth();

  const showEmptyOrError = !isLoading && (error !== null || stores.length === 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Text variant="headlineSmall" style={styles.title}>
        Chọn cửa hàng
      </Text>
      {isLoading ? <LoadingOverlay /> : null}
      {showEmptyOrError ? (
        <View style={styles.emptyWrap}>
          <EmptyState message={error ?? 'Tài khoản chưa được gán cửa hàng nào — liên hệ quản trị viên'} />
          <View style={styles.actionsRow}>
            <Button mode="outlined" onPress={retry}>
              Thử lại
            </Button>
            <Button mode="text" onPress={logout}>
              Đăng xuất
            </Button>
          </View>
        </View>
      ) : null}
      {!isLoading && !error && stores.length > 0 ? (
        <ScrollView contentContainerStyle={styles.grid}>
          {stores.map((store) => (
            <StoreCard key={store.id} store={store} onPress={() => selectStore(store.id)} />
          ))}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'white' },
  title: { padding: 24, paddingBottom: 12 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  actionsRow: { flexDirection: 'row', gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 24, paddingTop: 12 },
});
```

(Note: `TouchableRipple` and `Chip` imports are removed from `StoreSelectScreen.tsx` — they moved to `StoreCard.tsx` and are no longer used here.)

- [ ] **Step 3: Verify**

Run: `npm run type-check`
Expected: 0 errors — confirms `StoreCard`'s props match `StoreViewModel` and nothing in `StoreSelectScreen.tsx` still references the removed inline component/styles.

Run: `npm test`
Expected: all suites pass (no test covers this screen directly, but the full suite catches any accidental breakage elsewhere).

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/store/components/StoreCard.tsx src/features/store/screens/StoreSelectScreen.tsx
git commit -m "refactor: extract StoreCard into store/components/"
```

---

### Task 7: Move `hooks/` and `services/` test files into `__tests__/`

**Files:**
- Move: `src/hooks/useLayoutMode.test.ts` → `src/hooks/__tests__/useLayoutMode.test.ts`
- Move: `src/services/StorageService.test.ts` → `src/services/__tests__/StorageService.test.ts`
- Move: `src/services/StorageService.web.test.ts` → `src/services/__tests__/StorageService.web.test.ts`
- Move: `src/services/http/HttpClient.test.ts` → `src/services/http/__tests__/HttpClient.test.ts`
- Move: `src/services/http/authTokenStorage.test.ts` → `src/services/http/__tests__/authTokenStorage.test.ts`
- Move: `src/services/http/sessionEvents.test.ts` → `src/services/http/__tests__/sessionEvents.test.ts`

**Interfaces:** None — pure file relocation.

- [ ] **Step 1: Move `useLayoutMode.test.ts`**

```bash
git mv src/hooks/useLayoutMode.test.ts src/hooks/__tests__/useLayoutMode.test.ts
```

- [ ] **Step 2: Fix its relative import path**

In `src/hooks/__tests__/useLayoutMode.test.ts`, replace:

```ts
} from './useLayoutMode';
```

with:

```ts
} from '../useLayoutMode';
```

- [ ] **Step 3: Move `StorageService.test.ts` and `StorageService.web.test.ts`**

```bash
git mv src/services/StorageService.test.ts src/services/__tests__/StorageService.test.ts
git mv src/services/StorageService.web.test.ts src/services/__tests__/StorageService.web.test.ts
```

- [ ] **Step 4: Fix their relative import paths**

In `src/services/__tests__/StorageService.test.ts`, replace:

```ts
import { StorageService } from './StorageService';
```

with:

```ts
import { StorageService } from '../StorageService';
```

In `src/services/__tests__/StorageService.web.test.ts`, replace:

```ts
import { StorageService } from './StorageService.web';
```

with:

```ts
import { StorageService } from '../StorageService.web';
```

- [ ] **Step 5: Move the 3 `http/` test files**

```bash
git mv src/services/http/HttpClient.test.ts src/services/http/__tests__/HttpClient.test.ts
git mv src/services/http/authTokenStorage.test.ts src/services/http/__tests__/authTokenStorage.test.ts
git mv src/services/http/sessionEvents.test.ts src/services/http/__tests__/sessionEvents.test.ts
```

- [ ] **Step 6: Fix `HttpClient.test.ts`'s relative import and mock paths**

In `src/services/http/__tests__/HttpClient.test.ts`, replace:

```ts
import { createHttpClient } from './HttpClient';
import { getStoredTokens, saveTokens, clearTokens } from './authTokenStorage';
import { onSessionExpired } from './sessionEvents';
```

with:

```ts
import { createHttpClient } from '../HttpClient';
import { getStoredTokens, saveTokens, clearTokens } from '../authTokenStorage';
import { onSessionExpired } from '../sessionEvents';
```

And replace:

```ts
jest.mock('./refreshTokenRequest', () => ({
```

with:

```ts
jest.mock('../refreshTokenRequest', () => ({
```

And replace:

```ts
import { refreshTokenRequest } from './refreshTokenRequest';
```

with:

```ts
import { refreshTokenRequest } from '../refreshTokenRequest';
```

(`axios` and `axios-mock-adapter` imports are bare package specifiers — leave them unchanged.)

- [ ] **Step 7: Fix `authTokenStorage.test.ts`'s relative import path**

In `src/services/http/__tests__/authTokenStorage.test.ts`, replace:

```ts
import { getStoredTokens, saveTokens, clearTokens } from './authTokenStorage';
```

with:

```ts
import { getStoredTokens, saveTokens, clearTokens } from '../authTokenStorage';
```

- [ ] **Step 8: Fix `sessionEvents.test.ts`'s relative import path**

In `src/services/http/__tests__/sessionEvents.test.ts`, replace:

```ts
import { onSessionExpired, emitSessionExpired } from './sessionEvents';
```

with:

```ts
import { onSessionExpired, emitSessionExpired } from '../sessionEvents';
```

- [ ] **Step 9: Verify**

Run: `npx jest src/hooks/__tests__/useLayoutMode.test.ts src/services/__tests__/StorageService.test.ts src/services/__tests__/StorageService.web.test.ts src/services/http/__tests__/HttpClient.test.ts src/services/http/__tests__/authTokenStorage.test.ts src/services/http/__tests__/sessionEvents.test.ts`
Expected: all 6 suites PASS with the same test names/counts as before the move.

- [ ] **Step 10: Commit**

```bash
git add src/hooks/useLayoutMode.test.ts src/hooks/__tests__/useLayoutMode.test.ts src/services/StorageService.test.ts src/services/__tests__/StorageService.test.ts src/services/StorageService.web.test.ts src/services/__tests__/StorageService.web.test.ts src/services/http/HttpClient.test.ts src/services/http/__tests__/HttpClient.test.ts src/services/http/authTokenStorage.test.ts src/services/http/__tests__/authTokenStorage.test.ts src/services/http/sessionEvents.test.ts src/services/http/__tests__/sessionEvents.test.ts
git commit -m "chore: move hooks and services test files into __tests__/ subfolders"
```

---

### Task 8: Document the new conventions in `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** None — documentation only.

This task documents two things: the data-owning-vs-shell feature distinction (per spec §3), and the new `__tests__/` test-file location convention this whole plan establishes (a natural extension of the spec's own intent — a convention this plan introduces needs to be written down, or the next contributor won't know to follow it for new test files).

- [ ] **Step 1: Add the data-owning-vs-shell distinction**

In `CLAUDE.md`, replace:

```
Mỗi feature module tự đóng gói theo layer con khi cần: `components/`, `services/`, `store/`, `types/`, `schemas/`, `hooks/`. Không tạo layer rỗng — `settings` chỉ có `components/`, `screens/`, `store/` vì chưa cần các layer khác.
```

with:

```
Mỗi feature module tự đóng gói theo layer con khi cần: `components/`, `services/`, `store/`, `types/`, `schemas/`, `hooks/`. Không tạo layer rỗng — `settings` chỉ có `components/`, `screens/`, `store/` vì chưa cần các layer khác.

**2 kiểu feature module:**
- **Feature sở hữu data** (`auth`, `cart`, `catalog`, `store`, `printer`) — có `store/` slice và/hoặc `services/` riêng, giữ state dùng ở nhiều màn hình.
- **Feature shell/ghép** (`sales`, `settings`) — không có `store/`/`services/`/`types/` riêng, đúng chủ đích: ghép screen/hook của các feature sở hữu data lại thành 1 màn hình. Riêng `settings` có 1 slice Redux nhỏ cho state UI của chính nó (`activeMenuKey` — mục sidebar đang chọn).
```

- [ ] **Step 2: Document the `__tests__/` test-file convention**

In `CLAUDE.md`, replace:

```
- Component UI thuần trình bày (`src/components/*`, các subcomponent nhỏ trong `features/*/components/`) **không có test file riêng** — verify qua `type-check` + `lint` + test thủ công trên thiết bị. Chỉ file logic (services, drivers, schemas, reducers, transports) mới có `.test.ts`
```

with:

```
- Component UI thuần trình bày (`src/components/*`, các subcomponent nhỏ trong `features/*/components/`) **không có test file riêng** — verify qua `type-check` + `lint` + test thủ công trên thiết bị. Chỉ file logic (services, drivers, schemas, reducers, transports) mới có `.test.ts`, đặt trong thư mục con `__tests__/` cùng cấp với file logic nó test (vd `services/__tests__/XService.test.ts`) — không nằm chung thư mục với file logic. Jest tự nhận diện `__tests__/` mặc định, không cần cấu hình thêm.
```

- [ ] **Step 3: Verify**

Run: `npm test`
Expected: all suites pass (documentation-only change, but confirms nothing else in the working tree is broken before this final commit).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document feature-shape distinction and __tests__/ convention"
```

---

## Post-plan verification

After all 8 tasks:

```bash
npm run verify   # type-check + lint + test
```

Then confirm the exact same total test count as before this plan started (39 total test suites project-wide — 17 moved by this plan + 22 untouched under `src/features/printer/`), and confirm `find src -iname "*.test.ts" -not -path "*/__tests__/*"` returns only files under `src/features/printer/` (the explicitly out-of-scope 22).
