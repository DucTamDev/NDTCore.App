# File Structure Reorganization — Test Colocation + Layer Consistency

## Context

An architecture review of `NDTCore.App` (everything outside `src/features/printer/`, already well understood from recent work) surfaced two structural findings worth fixing:

1. **Test files sit directly next to their logic file** (`PrinterLogger.ts` + `PrinterLogger.test.ts` in the same folder) across all 39 `.test.ts` files in the repo. The user wants tests organized separately from logic files, not intermixed in the same directory listing.
2. **One feature (`store/`) is missing a `components/` folder** that every sibling feature has, with a subcomponent (`StoreCard`) defined inline inside a screen file instead of extracted — the one genuine "layer inconsistency" found in the earlier survey worth fixing (the others — `sales`/`settings` having no `store/services/types` of their own, `cart`/`catalog` having no `schemas/` — turned out to be intentional shapes for "shell" features and features with no validation need yet, not gaps).

Two options were evaluated for (1) — see "Test Organization Decision" below for the full trade-off analysis; `__tests__/` per-directory subfolders was chosen over a top-level `test/` tree mirroring `src/`.

## Goals

- Every `.test.ts` file outside `src/features/printer/` moves into a `__tests__/` subfolder alongside the code it tests — no jest config changes needed (Jest's default `testMatch` already covers `**/__tests__/**/*.[jt]s?(x)`, confirmed against this repo's actual `jest.config.js`, which sets `preset: 'react-native'` and does not override `testMatch`).
- `StoreCard` moves from being defined inline in `StoreSelectScreen.tsx` into its own file in a new `store/components/` folder, matching every sibling feature's convention.
- `CLAUDE.md` gains a short section explicitly naming the "data-owning feature" vs. "shell/compositor feature" distinction, so `sales`/`settings`'s different shape reads as intentional to the next person (or agent) working in this repo, not as a gap to "fix."
- Zero behavior change anywhere — this is a pure file-organization change. No test's assertions change, no component's rendered output changes.

## Non-Goals

- **`src/features/printer/` is explicitly out of scope for this reorganization.** It has 22 of the repo's 39 test files (the largest single chunk) and has had heavy, active development all in the current session (driver swap, concurrency fix) — reorganizing its tests right after so much churn adds risk for no functional benefit. Deferred to a dedicated follow-up once printer/ development settles.
- **Cross-feature public-API/barrel-file boundaries** (a separate finding from the same architecture review — features currently import directly into each other's `store/xSlice.ts`/`services/XService.ts` rather than through an exported surface) is a different, larger topic, not part of this reorganization.
- No new test coverage is added anywhere as part of this work — existing test bodies move verbatim, only their file path and internal `import` paths change.
- No `jest.config.js` changes — confirmed unnecessary (see Goals).

## Test Organization Decision

Two options were considered:

**Option A — `__tests__/` subfolder per directory** (chosen): `src/features/auth/services/AuthService.ts` + `src/features/auth/services/__tests__/AuthService.test.ts`. Jest auto-discovers `__tests__/` folders by default (no config change). Each moved test file needs exactly one import-path adjustment: relative imports referencing sibling files in the same original directory gain one `../` level (`./AuthService` → `../AuthService`); imports already reaching outside the original directory gain one more `../` level too. Keeps tests one directory level from their subject — satisfies "not intermixed with logic" without a large context-switch cost to locate a file's test. This is a widely-used, tooling-blessed pattern in the Jest/React Native ecosystem, not a deviation from it.

**Option B — top-level `test/` directory mirroring `src/`** (rejected): `test/features/auth/services/AuthService.test.ts`. Would fully separate "app code" from "test code" at the top level, but: requires `jest.config.js` changes (`roots`/`testMatch`), requires deep relative import paths in every test file (`../../../../src/features/auth/services/AuthService` instead of `../AuthService`), and — most importantly — increases the friction of finding/opening a file's test during TDD work, which is how every feature in this codebase has actually been built (write the failing test immediately next to the implementation, iterate). Rejected as higher cost and higher risk for a purely organizational benefit, and it fights the ecosystem's own conventions rather than working with them.

## 1. Test file migration (17 files, non-printer)

Move each `.test.ts` file into a `__tests__/` subfolder in its current directory, updating only the relative import paths inside the moved file (never the source file being tested — it does not know or care where its test lives).

| Current path | New path |
|---|---|
| `src/features/auth/services/AuthService.test.ts` | `src/features/auth/services/__tests__/AuthService.test.ts` |
| `src/features/auth/store/authSlice.test.ts` | `src/features/auth/store/__tests__/authSlice.test.ts` |
| `src/features/cart/services/CartService.test.ts` | `src/features/cart/services/__tests__/CartService.test.ts` |
| `src/features/cart/services/OrderPrintTrigger.test.ts` | `src/features/cart/services/__tests__/OrderPrintTrigger.test.ts` |
| `src/features/cart/store/cartSlice.test.ts` | `src/features/cart/store/__tests__/cartSlice.test.ts` |
| `src/features/catalog/services/CatalogService.test.ts` | `src/features/catalog/services/__tests__/CatalogService.test.ts` |
| `src/features/catalog/store/catalogSlice.test.ts` | `src/features/catalog/store/__tests__/catalogSlice.test.ts` |
| `src/features/settings/hooks/useSettings.test.ts` | `src/features/settings/hooks/__tests__/useSettings.test.ts` |
| `src/features/settings/store/settingsSlice.test.ts` | `src/features/settings/store/__tests__/settingsSlice.test.ts` |
| `src/features/store/services/StoreService.test.ts` | `src/features/store/services/__tests__/StoreService.test.ts` |
| `src/features/store/store/storeSlice.test.ts` | `src/features/store/store/__tests__/storeSlice.test.ts` |
| `src/hooks/useLayoutMode.test.ts` | `src/hooks/__tests__/useLayoutMode.test.ts` |
| `src/services/StorageService.test.ts` | `src/services/__tests__/StorageService.test.ts` |
| `src/services/StorageService.web.test.ts` | `src/services/__tests__/StorageService.web.test.ts` |
| `src/services/http/HttpClient.test.ts` | `src/services/http/__tests__/HttpClient.test.ts` |
| `src/services/http/authTokenStorage.test.ts` | `src/services/http/__tests__/authTokenStorage.test.ts` |
| `src/services/http/sessionEvents.test.ts` | `src/services/http/__tests__/sessionEvents.test.ts` |

Each move: `git mv` the file (preserves history), then adjust every relative `import`/`jest.mock(...)` path inside it by prepending one `../`. No other content in any moved file changes. The source file being tested is never touched.

## 2. `StoreCard` extraction

New file `src/features/store/components/StoreCard.tsx`, containing the `StoreCardProps` interface, the `StoreCard` component, and the 4 style keys (`card`, `code`, `address`, `chip`) currently defined inline in `StoreSelectScreen.tsx`. `StoreSelectScreen.tsx` imports `StoreCard` from `../components/StoreCard` and keeps only its own 4 style keys (`safeArea`, `title`, `emptyWrap`, `actionsRow`, `grid`).

No new test — `StoreCard` is a presentational component, matching this repo's established convention (only logic files get `.test.ts`).

## 3. `CLAUDE.md` documentation addition

A short new subsection under "Source Structure" naming the two feature shapes this repo actually has:
- **Data-owning features** (`auth`, `cart`, `catalog`, `store`, `printer`) — have their own `store/` slice and/or `services/`, hold state used across more than one screen.
- **Shell/compositor features** (`sales`, `settings`) — no `store/`/`services/`/`types/` of their own by design; they compose data-owning features' screens/hooks into one screen. `settings` additionally holds one small `store/` slice for its own sidebar-selection UI state (`activeMenuKey`) — reviewed separately, not part of this reorg (see Out of Scope note below).

This documents the *intended* shape so a future feature's author (human or agent) picks the right pattern deliberately, instead of the current implicit-and-undocumented split found during the architecture review.

## Out of Scope (explicit follow-ups noted, not actioned here)

- `src/features/printer/`'s 22 test files — deferred (see Non-Goals).
- Cross-feature public-API/barrel-file boundaries — separate, larger topic.
- `settingsSlice.activeMenuKey` arguably belonging in local `useState` instead of Redux, and `LoginForm.tsx` not using this repo's established React Hook Form + Zod convention — both flagged in the same architecture review, neither is a file-*organization* issue, left for a separate decision.

## Testing

No new tests. Verification is: after each batch of file moves, `npm test` for the affected suite(s) passes with the exact same test count/names as before the move (proving the move didn't silently drop or break a test), then a full `npm test` + `npm run type-check` + `npm run lint` pass at the end confirms nothing broke project-wide.
