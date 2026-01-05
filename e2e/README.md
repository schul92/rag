# E2E Tests

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PLAYWRIGHT TEST WORKFLOW                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   YOU RUN    │     │  PLAYWRIGHT  │     │   NEXT.JS    │     │   SUPABASE   │
│              │────▶│   CONFIG     │────▶│  DEV SERVER  │────▶│   DATABASE   │
│ npx playwright│     │              │     │              │     │              │
│    test      │     │ webServer:   │     │ npm run dev  │     │  Test Data   │
└──────────────┘     │ auto-start   │     │ :3000        │     └──────────────┘
                     └──────────────┘     └──────────────┘
                            │                    │
                            ▼                    ▼
                     ┌──────────────┐     ┌──────────────┐
                     │   BROWSER    │     │   NEXT.JS    │
                     │   LAUNCH     │     │     APP      │
                     │              │────▶│              │
                     │  Chromium    │     │  localhost   │
                     │  Mobile      │     │    :3000     │
                     └──────────────┘     └──────────────┘
                            │                    │
                            ▼                    ▼
                     ┌──────────────────────────────────────┐
                     │           TEST EXECUTION             │
                     │                                      │
                     │  1. Navigate to page                 │
                     │  2. Interact with UI elements        │
                     │  3. Make assertions                  │
                     │  4. Generate report                  │
                     └──────────────────────────────────────┘
                                      │
                                      ▼
                     ┌──────────────────────────────────────┐
                     │            TEST RESULTS              │
                     │                                      │
                     │  ✓ Passed    ✗ Failed   ⟳ Retried   │
                     │                                      │
                     │  HTML Report: playwright-report/     │
                     │  Screenshots: test-results/          │
                     └──────────────────────────────────────┘
```

## Test Files Structure

```
e2e/
├── search.spec.ts          # Main search functionality tests
├── korean-search.spec.ts   # Korean language search tests
├── english-search.spec.ts  # English search tests
├── loading-quick-search.spec.ts  # Quick search button tests
├── error-handling.spec.ts  # Error scenario tests
├── seed.spec.ts            # Page setup/seed tests
└── settings/
    └── settings.spec.ts    # Settings page tests
```

## Prerequisites

1. **Environment Variables**: Ensure `.env.local` is properly configured with all required credentials:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `VOYAGE_API_KEY`
   - (Optional) `COHERE_API_KEY` or `HF_TOKEN`

2. **Database**: Supabase database must be accessible and seeded with test data

## Running Tests

### Option 1: Automatic Server Start (Recommended)

Playwright is configured to automatically start the development server:

```bash
# Run all tests (server starts automatically)
npx playwright test

# Run specific test file
npx playwright test e2e/search.spec.ts

# Run in UI mode
npx playwright test --ui

# Run in debug mode
npx playwright test --debug

# Run only chromium project
npx playwright test --project=chromium
```

The `webServer` configuration in `playwright.config.ts` will:
- Start `npm run dev` automatically
- Wait for `http://localhost:3000` to be ready
- Reuse existing server if already running (non-CI)
- Timeout after 120 seconds if server doesn't start

### Option 2: Manual Server Start

If automatic server start fails, start the server manually:

```bash
# Terminal 1: Start the development server
npm run dev
```

```bash
# Terminal 2: Run the tests
npx playwright test
```

## Troubleshooting

### Server Won't Start

If you get `ERR_CONNECTION_TIMED_OUT` errors:

1. **Check environment variables**: Ensure `.env.local` exists and has valid values
2. **Check port availability**: Make sure port 3000 is not already in use
3. **Start server manually**: Run `npm run dev` in a separate terminal to see error messages
4. **Check Supabase connection**: Verify Supabase URL and keys are correct

### Tests Failing

1. **Database not seeded**: Ensure your Supabase database has test data
2. **Network issues**: Check internet connection for external API calls
3. **Stale data**: Clear browser cache or use `--headed` mode to debug

## Test Coverage

The E2E tests cover:

- **Initial Page Load**: UI elements visibility and layout
- **Korean Song Title Search**: Search by Korean song titles
- **Key-based Search**: Search with musical key filters (e.g., "D키 악보 3개")
- **Multi-Key Song Search**: Songs available in multiple keys
- **Song Deduplication**: Multi-page songs counted as single entries
- **Quick Search Buttons**: Pre-configured search shortcuts
- **Korean IME Input**: Proper handling of Korean input method
- **Modal Interactions**: Song detail modal functionality
- **Mobile Responsiveness**: Touch-friendly UI on mobile devices
- **Settings**: Theme toggle and language preferences

## Test Projects

- **chromium**: Desktop Chrome browser
- **mobile**: iPhone 13 viewport (375x667)
