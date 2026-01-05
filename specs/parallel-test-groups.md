# Parallel Test Execution Groups

## Analysis Summary

After analyzing the 59 test scenarios, I've identified **8 parallel execution groups** based on:
- **State isolation**: Tests that don't share browser state
- **Feature independence**: Tests targeting different components
- **Viewport requirements**: Tests requiring specific screen sizes
- **Settings mutations**: Tests that change language/theme

---

## Dependency Analysis

### Shared State Concerns

| Concern | Tests Affected | Solution |
|---------|---------------|----------|
| Language setting | Settings tests, all UI text assertions | Isolate settings tests |
| Theme setting | Settings tests, color assertions | Isolate settings tests |
| localStorage | Settings persistence | Clear before each test |
| Chat history | Sequential search tests | Fresh page per test |
| Modal state | Modal tests | Close modal after each test |
| Network state | Error handling tests | Mock network per test |

### No Shared State (Safe to Parallelize)

- Initial page load tests (read-only)
- Individual search tests (each starts fresh)
- Modal interactions (isolated per card)
- Responsive tests (different viewports)
- Accessibility tests (read-only checks)

---

## Parallel Execution Groups

### Group 1: Initial Load & Static UI (4 tests)
**Can run in parallel with ALL other groups**

```
e2e/initial-load/
├── main-ui-elements.spec.ts
├── quick-search-buttons.spec.ts
├── no-scroll-initial-state.spec.ts
└── desktop-responsive.spec.ts
```

**Rationale**: Read-only tests, no state mutations, fast execution
**Dependencies**: None
**Estimated time**: ~10s total

---

### Group 2: Korean Search Features (5 tests)
**Can run in parallel with Groups 1, 3, 5, 6, 7, 8**

```
e2e/search-korean/
├── basic-korean-search.spec.ts
├── specific-song-search.spec.ts
├── korean-spacing-variations.spec.ts
├── korean-ime-composition.spec.ts
└── typo-tolerance.spec.ts
```

**Rationale**: Each test uses fresh page, different search queries
**Dependencies**: None (each test navigates to homepage fresh)
**Estimated time**: ~45s total

---

### Group 3: English Search Features (3 tests)
**Can run in parallel with Groups 1, 2, 5, 6, 7, 8**

```
e2e/search-english/
├── basic-english-search.spec.ts
├── english-to-korean-alias.spec.ts
└── partial-title-search.spec.ts
```

**Rationale**: Independent search queries, no shared state
**Dependencies**: None
**Estimated time**: ~30s total

---

### Group 4: Settings & Preferences (7 tests) - SEQUENTIAL
**Must run ISOLATED from other groups**

```
e2e/settings/
├── open-settings.spec.ts
├── language-toggle-to-english.spec.ts      # Mutates language
├── language-toggle-to-korean.spec.ts       # Mutates language
├── theme-toggle-to-light.spec.ts           # Mutates theme
├── theme-toggle-to-dark.spec.ts            # Mutates theme
├── settings-persistence.spec.ts            # Tests localStorage
└── close-settings.spec.ts
```

**Rationale**: These tests mutate global state (localStorage) that affects UI text and colors
**Dependencies**: Must clear localStorage between tests
**Constraint**: Run sequentially within group, isolated from other groups
**Estimated time**: ~40s total

**Implementation**:
```typescript
// playwright.config.ts
{
  name: 'settings',
  testDir: './e2e/settings',
  fullyParallel: false, // Sequential within group
  use: {
    storageState: undefined, // Clear state
  },
}
```

---

### Group 5: Key Filtering & Multi-Page (8 tests)
**Can run in parallel with Groups 1, 2, 3, 6, 7, 8**

```
e2e/key-filtering/
├── key-with-count.spec.ts
├── g-key-five-songs.spec.ts
├── multi-key-song-d.spec.ts
├── multi-key-song-b.spec.ts
└── no-false-positive-key-detection.spec.ts

e2e/multi-page/
├── single-card-page-count.spec.ts
├── key-search-deduplication.spec.ts
└── filename-grouping.spec.ts
```

**Rationale**: Different search queries, test specific filtering logic
**Dependencies**: None
**Estimated time**: ~60s total

---

### Group 6: Modal Interactions (8 tests)
**Can run in parallel with Groups 1, 2, 3, 5, 7, 8**

```
e2e/modal/
├── open-modal.spec.ts
├── multi-page-navigation.spec.ts
├── download-single-page.spec.ts
├── download-all-pages.spec.ts
├── share-button.spec.ts
├── close-x-button.spec.ts
├── close-click-outside.spec.ts
└── close-escape-key.spec.ts
```

**Rationale**: Each test opens its own modal, isolated interactions
**Dependencies**: Requires search results first (but each test does its own search)
**Estimated time**: ~50s total

---

### Group 7: Responsive & Accessibility (10 tests)
**Can run in parallel with Groups 1, 2, 3, 5, 6, 8**

```
e2e/responsive/
├── mobile-no-horizontal-scroll.spec.ts      # 375x667
├── mobile-touch-targets.spec.ts             # 375x667
├── mobile-search-input.spec.ts              # 375x667
├── mobile-modal.spec.ts                     # 375x667
├── mobile-chat-messages.spec.ts             # 375x667
├── tablet-layout.spec.ts                    # 768x1024
└── tablet-search-results.spec.ts            # 768x1024

e2e/accessibility/
├── keyboard-navigation.spec.ts
├── screen-reader-labels.spec.ts
└── color-contrast.spec.ts
```

**Rationale**: Different viewports, read-only accessibility checks
**Dependencies**: None (viewport is test-specific)
**Estimated time**: ~60s total

**Implementation**:
```typescript
// Can use Playwright projects for viewport parallelization
{
  name: 'mobile',
  use: { viewport: { width: 375, height: 667 } },
},
{
  name: 'tablet',
  use: { viewport: { width: 768, height: 1024 } },
}
```

---

### Group 8: Search Methods & Performance (11 tests)
**Can run in parallel with Groups 1, 2, 3, 5, 6, 7**

```
e2e/search-methods/
├── exact-match.spec.ts
├── bm25-fts.spec.ts
├── normalized-korean.spec.ts
├── alias-lookup.spec.ts
├── fuzzy-matching.spec.ts
├── vector-semantic.spec.ts
├── ocr-text-search.spec.ts
└── rrf-fusion.spec.ts

e2e/performance/
├── search-response-time.spec.ts
├── image-loading.spec.ts
└── multiple-searches.spec.ts
```

**Rationale**: Independent search method validation, performance metrics
**Dependencies**: None
**Estimated time**: ~90s total

---

### Group 9: Error Handling & Edge Cases (5 tests)
**Can run in parallel with Groups 1, 2, 3, 5, 6, 7, 8**

```
e2e/errors/
├── empty-search-query.spec.ts
├── no-results-found.spec.ts
├── network-error.spec.ts          # Requires network mocking
├── long-search-query.spec.ts
└── special-characters.spec.ts
```

**Rationale**: Edge cases are isolated, network mocking is per-test
**Dependencies**: None
**Estimated time**: ~30s total

---

### Group 10: Loading States & Quick Search (7 tests)
**Can run in parallel with Groups 1, 2, 3, 5, 6, 7, 8, 9**

```
e2e/loading/
├── progressive-loading-messages.spec.ts
├── user-message-instant.spec.ts
├── input-disabled-during-search.spec.ts
└── loading-animation.spec.ts

e2e/quick-search/
├── button-triggers-search.spec.ts
├── key-based-quick-search.spec.ts
└── sequential-quick-searches.spec.ts
```

**Rationale**: UI behavior tests, independent interactions
**Dependencies**: None
**Estimated time**: ~45s total

---

## Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: process.env.CI ? 4 : 8,

  projects: [
    // Group 1-3, 5-10: Fully parallel
    {
      name: 'chromium-parallel',
      testDir: './e2e',
      testIgnore: ['**/settings/**'],
      use: { ...devices['Desktop Chrome'] },
    },

    // Group 4: Settings (Sequential, Isolated)
    {
      name: 'chromium-settings',
      testDir: './e2e/settings',
      fullyParallel: false,
      use: {
        ...devices['Desktop Chrome'],
        storageState: undefined,
      },
    },

    // Mobile viewport tests
    {
      name: 'mobile-safari',
      testMatch: '**/responsive/mobile-*.spec.ts',
      use: { ...devices['iPhone 13'] },
    },

    // Tablet viewport tests
    {
      name: 'tablet',
      testMatch: '**/responsive/tablet-*.spec.ts',
      use: {
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 2,
      },
    },
  ],
});
```

---

## Execution Matrix

| Group | Tests | Parallel With | Sequential Constraint | Est. Time |
|-------|-------|---------------|----------------------|-----------|
| 1 | 4 | All | None | 10s |
| 2 | 5 | 1,3,5-10 | None | 45s |
| 3 | 3 | 1,2,5-10 | None | 30s |
| 4 | 7 | **NONE** | Run isolated | 40s |
| 5 | 8 | 1-3,6-10 | None | 60s |
| 6 | 8 | 1-3,5,7-10 | None | 50s |
| 7 | 10 | 1-3,5,6,8-10 | None | 60s |
| 8 | 11 | 1-3,5-7,9,10 | None | 90s |
| 9 | 5 | 1-3,5-8,10 | None | 30s |
| 10 | 7 | 1-3,5-9 | None | 45s |

---

## Optimal Execution Strategy

### With 8 Workers (Local Development)

```
Timeline (parallel execution):

Worker 1: [Group 1 ----] [Group 5 ----------------]
Worker 2: [Group 2 -------------] [Group 9 ------]
Worker 3: [Group 3 --------] [Group 10 -----------]
Worker 4: [Group 6 --------------] [done]
Worker 5: [Group 7 ----------------] [done]
Worker 6: [Group 8 ------------------------]
Worker 7: [Group 4 (settings) ----------] [done]
Worker 8: [Accessibility --------] [done]

Total estimated time: ~2 minutes (vs ~8 minutes sequential)
```

### With 4 Workers (CI Environment)

```
Worker 1: [Groups 1,2,5]
Worker 2: [Groups 3,6,9]
Worker 3: [Groups 7,10]
Worker 4: [Group 4 (isolated), Group 8]

Total estimated time: ~3-4 minutes
```

---

## Test Isolation Checklist

Each test file should:

```typescript
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, context }) => {
  // Clear localStorage to prevent settings leakage
  await context.clearCookies();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test.afterEach(async ({ page }) => {
  // Close any open modals
  const modal = page.locator('[role="dialog"]');
  if (await modal.isVisible()) {
    await page.keyboard.press('Escape');
  }
});
```

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | 59 |
| Parallel Groups | 10 |
| Isolated Groups | 1 (Settings) |
| Max Parallelization | 9 groups simultaneously |
| Estimated Sequential Time | ~8 minutes |
| Estimated Parallel Time (8 workers) | ~2 minutes |
| **Speedup** | **4x** |
