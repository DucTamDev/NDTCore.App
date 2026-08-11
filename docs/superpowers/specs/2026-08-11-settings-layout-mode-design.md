# Settings Screen — Responsive Layout via Shared LayoutMode

## Context

`src/features/sales/hooks/useSalesLayoutMode.ts` already classifies the window
into `'phone' | 'tablet-portrait' | 'tablet-landscape'` for the Sales screen
(shortest-side threshold `TABLET_MIN_DP = 500`).

An initial attempt to give the Settings screen the same phone/tablet split
lives on branch `feature/settings-responsive-ux` (commit `977fe71`). It works,
but:
- `settings/hooks/useSettings.ts` reaches across features and imports
  `TABLET_MIN_DP` directly from `sales/hooks/useSalesLayoutMode.ts`.
- It re-derives its own `isTablet` boolean from that constant instead of
  reusing the sales feature's actual classification, so the two features can
  silently drift apart if the threshold or algorithm ever changes.
- `SettingsSidebarItem.tsx` has WHAT-comments the project's comment
  convention forbids.
- No test coverage was added for the new `settingsSlice` behavior or the new
  hook logic, unlike `useSalesLayoutMode` which has a pure, tested function.

This spec replaces that branch with a clean version built on a shared
`LayoutMode` concept. Work happens on a fresh branch,
`feature/settings-layout-mode`, off `main` — not a continuation of
`feature/settings-responsive-ux`.

## Goals

- Settings screen layout (sidebar-only vs. sidebar+content vs. detail-only)
  reacts to the same `LayoutMode` concept the Sales screen already uses, with
  no cross-feature import.
- `tablet-portrait` and `tablet-landscape` behave identically for Settings
  (`isTablet = layoutMode !== 'phone'`) — both get sidebar+content
  side-by-side; only `phone` gets the single-pane master-detail behavior.
- Logic that branches (layout classification, active-section/header-title
  derivation) is a pure, tested function; UI components stay untested per
  project convention.

## 1. Shared `useLayoutMode` hook

Move `src/features/sales/hooks/useSalesLayoutMode.ts` →
`src/hooks/useLayoutMode.ts` (new top-level `src/hooks/` dir, sibling to
`components/`, `services/`, `utils/`). Content unchanged except naming:

```ts
export type LayoutMode = 'tablet-landscape' | 'tablet-portrait' | 'phone';
export const TABLET_MIN_DP = 500;
export function getLayoutMode(width: number, height: number): LayoutMode { ... }
export function useLayoutMode(): LayoutMode { ... }
```

Move `useSalesLayoutMode.test.ts` → `src/hooks/useLayoutMode.test.ts`
unchanged (same cases, including the square-viewport case that motivated the
existing `width > height` fix).

Update the two Sales call sites to import from the new path and use the
`LayoutMode` name:
- `src/features/sales/components/ProductArea.tsx`
- `src/features/sales/screens/SalesScreen.tsx`

`src/features/sales/hooks/useSalesLayoutMode.ts` and its test are deleted.

## 2. Settings feature

Rebuild (not cherry-pick) the following, informed by the
`feature/settings-responsive-ux` attempt but corrected:

**`config/settingsConfig.ts`** (new file) — static menu metadata, same shape
as the prior attempt, plus a named default:
```ts
export const DEFAULT_TABLET_MENU_KEY: SettingsMenuKey = 'printer';
export const settingsMenuItems: SettingsMenuItem[] = [ ...same 6 items... ];
```

**`store/settingsSlice.ts`** — `SettingsMenuKey` gains `null`; initial
`activeMenuKey: null` (nothing selected until the user picks one, needed for
phone's "no selection yet" sidebar-only state).

**`hooks/useSettings.ts`** — pure function + thin hook, mirroring the
`getSalesLayoutMode`/`useSalesLayoutMode` split:
```ts
export function getSettingsView(
  layoutMode: LayoutMode,
  activeMenuKey: SettingsMenuKey,
): { isTablet: boolean; activeSection: SettingsMenuKey; headerTitle: string } {
  const isTablet = layoutMode !== 'phone';
  const activeSection = isTablet ? (activeMenuKey ?? DEFAULT_TABLET_MENU_KEY) : activeMenuKey;
  const activeItem = settingsMenuItems.find((item) => item.key === activeSection);
  const headerTitle = !isTablet && activeItem ? activeItem.label : 'Cài đặt';
  return { isTablet, activeSection, headerTitle };
}

export function useSettings() {
  const dispatch = useDispatch();
  const layoutMode = useLayoutMode();
  const activeMenuKey = useSelector(selectActiveMenuKey);
  const { isTablet, activeSection, headerTitle } = getSettingsView(layoutMode, activeMenuKey);
  // selectSection/clearSection dispatch activeMenuKeyChanged as before
  return { isTablet, activeSection, selectSection, clearSection, headerTitle };
}
```

**Components** — same structure as the prior attempt (no behavior change),
cleanup only:
- `components/SettingsHeader.tsx` (new) — title + optional back button, as
  designed.
- `components/SettingsSidebarItem.tsx` (new) — extracted row renderer; drop
  the WHAT-comments (`// Compute item colors dynamically based on state`,
  `// Unify inner item content rendering`).
- `components/SettingsSidebar.tsx` — takes `activeSection` /
  `onSelectSection` / `isTablet` props, renders `settingsMenuItems` via
  `SettingsSidebarItem`. Drop the stale `// src/features/settings/...` path
  comment for consistency with the other touched files.
- `components/SettingsContent.tsx` — takes `activeSection`, renders
  `PrinterManagementPanel` only when `activeSection === 'printer'`.
- `screens/SettingsScreen.tsx` — wires `useSettings()` into
  `SettingsHeader` + conditional `SettingsSidebar`/`SettingsContent` exactly
  as the prior attempt did.

## 3. Testing

- `src/hooks/useLayoutMode.test.ts` — moved as-is.
- `src/features/settings/store/settingsSlice.test.ts` (new) — initial state,
  `activeMenuKeyChanged` with a real key and with `null`.
- `src/features/settings/hooks/useSettings.test.ts` (new) — table-driven
  tests of `getSettingsView`: phone + `null` → sidebar-only; phone + key →
  detail mode with matching `headerTitle`; tablet + `null` → falls back to
  `DEFAULT_TABLET_MENU_KEY`; tablet + key → keeps that key regardless of
  header title (always `'Cài đặt'` on tablet).
- No new test files for `SettingsScreen`/`SettingsSidebar`/
  `SettingsSidebarItem`/`SettingsHeader`/`SettingsContent` — pure
  presentational components, verified via type-check + lint + manual check,
  per project convention.

## Out of scope

- Any of the disabled menu items (scanner, account, language, sync, info)
  becoming functional.
- Visual/theme changes beyond what the prior attempt already did (it already
  moved from hardcoded hex colors to theme tokens, which this spec keeps).
- Sales screen behavior changes — the move to `src/hooks/` is a rename, not
  a logic change.

## Docs

`NDTCore.App/CLAUDE.md`'s Source Structure tree gains a `hooks/` entry.

## Cleanup

Once this branch lands, `feature/settings-responsive-ux` (commit `977fe71`,
superseded by this spec) is no longer needed and can be deleted — confirm
with the user before deleting since it's a named branch, not scratch state.
