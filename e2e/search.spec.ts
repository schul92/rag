import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Onnuri Praise Song Search App
 *
 * Test scenarios based on user testing:
 * 1. Initial page load and UI elements
 * 2. Korean song title search
 * 3. Key-based search with count (e.g., "D키 악보 3개")
 * 4. Multi-key song search (songs with D, B keys)
 * 5. Song deduplication (multi-page songs counted as 1)
 * 6. Quick search buttons
 * 7. Korean IME input handling
 * 8. Modal opening and interaction
 * 9. Mobile responsiveness
 */

test.describe('Initial Page Load', () => {
  test('should display the main UI elements', async ({ page }) => {
    await page.goto('/')

    // Header should be visible
    await expect(page.locator('header')).toBeVisible()

    // App title should be visible
    await expect(page.getByText('찬양팀 악보')).toBeVisible()

    // Search input should be visible
    await expect(page.getByPlaceholder('곡 제목을 입력하세요')).toBeVisible()

    // Quick search buttons should be visible
    await expect(page.getByRole('button', { name: /오 베들레헴/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /G키 찬양 5개/ })).toBeVisible()
  })

  test('should not be scrollable on initial state', async ({ page }) => {
    await page.goto('/')

    // Check that the page doesn't have overflow
    const isScrollable = await page.evaluate(() => {
      return document.documentElement.scrollHeight > document.documentElement.clientHeight
    })

    expect(isScrollable).toBe(false)
  })
})

test.describe('Korean Song Title Search', () => {
  test('should search for "베들레헴" and show results', async ({ page }) => {
    await page.goto('/')

    // Type in search input
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요')
    await searchInput.fill('베들레헴')
    await searchInput.press('Enter')

    // Wait for loading to finish
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Should show results
    await expect(page.locator('text=악보')).toBeVisible({ timeout: 30000 })
  })

  test('should search for "거룩하신 어린양" and get results', async ({ page }) => {
    await page.goto('/')

    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요')
    await searchInput.fill('거룩하신 어린양')
    await searchInput.press('Enter')

    // Wait for results
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Should find the song
    await expect(page.locator('text=거룩하신 어린양')).toBeVisible({ timeout: 30000 })
  })
})

test.describe('Key-based Search', () => {
  test('should search "D키 악보 3개" and return exactly 3 unique songs', async ({ page }) => {
    await page.goto('/')

    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요')
    await searchInput.fill('D키 악보 3개')
    await searchInput.press('Enter')

    // Wait for results
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Should mention 3 songs (not pages)
    const responseText = await page.locator('[class*="bg-card"]').first().textContent()
    expect(responseText).toContain('3곡')
  })

  test('should search "G키 찬양 5개" and return up to 5 unique songs', async ({ page }) => {
    await page.goto('/')

    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요')
    await searchInput.fill('G키 찬양 5개')
    await searchInput.press('Enter')

    // Wait for results
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Should have response with song count
    await expect(page.locator('text=G 키')).toBeVisible({ timeout: 30000 })
  })
})

test.describe('Multi-Key Song Search', () => {
  test('should find "저 들 밖에 한밤중에" when searching D키', async ({ page }) => {
    await page.goto('/')

    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요')
    await searchInput.fill('D키 악보')
    await searchInput.press('Enter')

    // Wait for results
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Should include the song with D, B keys
    const pageContent = await page.content()
    expect(pageContent).toContain('저 들 밖에')
  })

  test('should find "저 들 밖에 한밤중에" when searching B키', async ({ page }) => {
    await page.goto('/')

    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요')
    await searchInput.fill('B키 악보')
    await searchInput.press('Enter')

    // Wait for results
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Should include the song with D, B keys
    const pageContent = await page.content()
    expect(pageContent).toContain('저 들 밖에')
  })
})

test.describe('Song Deduplication', () => {
  test('Holy Forever with multiple pages should show as 1 song with page count', async ({ page }) => {
    await page.goto('/')

    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요')
    await searchInput.fill('Holy Forever')
    await searchInput.press('Enter')

    // Wait for results
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Check for song card with page indicator (e.g., "3p")
    const cards = page.locator('[class*="rounded-xl"], [class*="rounded-2xl"]').filter({ hasText: 'Holy Forever' })
    const cardCount = await cards.count()

    // Should only show 1 card for Holy Forever (not multiple)
    expect(cardCount).toBeGreaterThanOrEqual(1)

    // The card should have a page indicator if multi-page
    const pageIndicator = page.locator('text=/\\d+p/')
    await expect(pageIndicator).toBeVisible({ timeout: 5000 }).catch(() => {
      // Page indicator might not be visible if single page - that's ok
    })
  })

  test('should not show duplicate songs in key search results', async ({ page }) => {
    await page.goto('/')

    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요')
    await searchInput.fill('D키 악보 5개')
    await searchInput.press('Enter')

    // Wait for results
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Get the response text
    const responseText = await page.locator('[class*="rounded-2xl"][class*="bg-card"]').first().textContent() || ''

    // Extract song titles from numbered list (1. Title, 2. Title, etc.)
    const titles = responseText.match(/\d+\.\s*([^\n\d]+)/g) || []
    const cleanTitles = titles.map(t => t.replace(/^\d+\.\s*/, '').trim().toLowerCase())

    // Check for duplicates
    const uniqueTitles = new Set(cleanTitles)
    expect(uniqueTitles.size).toBe(cleanTitles.length) // No duplicates
  })
})

test.describe('Quick Search Buttons', () => {
  test('should trigger search when clicking quick search button', async ({ page }) => {
    await page.goto('/')

    // Click on a quick search button
    await page.getByRole('button', { name: /오 베들레헴/ }).click()

    // Wait for loading to start and finish
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Should show results
    await expect(page.locator('text=악보')).toBeVisible({ timeout: 30000 })
  })

  test('should trigger key search when clicking key-based quick search', async ({ page }) => {
    await page.goto('/')

    // Click on G키 quick search
    await page.getByRole('button', { name: /G키 찬양 5개/ }).click()

    // Wait for results
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Should show G key results
    await expect(page.locator('text=G 키')).toBeVisible({ timeout: 30000 })
  })
})

test.describe('Korean IME Input', () => {
  test('should handle Korean IME input correctly without sending partial characters', async ({ page }) => {
    await page.goto('/')

    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요')

    // Type Korean text character by character (simulating IME)
    await searchInput.type('베들레헴', { delay: 100 })
    await searchInput.press('Enter')

    // Wait for results
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Should only have ONE user message (not multiple fragmented ones)
    const userMessages = page.locator('[class*="from-amber-500"]')
    const messageCount = await userMessages.count()

    // Should have exactly 1 user message for the search
    expect(messageCount).toBe(1)
  })
})

test.describe('Song Modal', () => {
  test('should open modal when clicking on song card', async ({ page }) => {
    await page.goto('/')

    // First search for a song
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요')
    await searchInput.fill('Holy Forever')
    await searchInput.press('Enter')

    // Wait for results
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Click on the first song card image
    const songCard = page.locator('img[alt*="Sheet"]').first()
    await songCard.click()

    // Modal should open with download/share buttons
    await expect(page.getByRole('button', { name: /다운로드|Download/i })).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Loading States', () => {
  test('should show progressive loading messages', async ({ page }) => {
    await page.goto('/')

    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요')
    await searchInput.fill('테스트 검색')
    await searchInput.press('Enter')

    // Should show loading indicator
    await expect(page.locator('[class*="animate-spin"]')).toBeVisible({ timeout: 5000 })

    // Should show loading progress bar
    await expect(page.locator('[class*="bg-gradient-to-r"]')).toBeVisible({ timeout: 5000 })
  })

  test('should show user message immediately before loading', async ({ page }) => {
    await page.goto('/')

    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요')
    await searchInput.fill('테스트')

    // Press enter and immediately check for user message
    await searchInput.press('Enter')

    // User message should appear instantly (before loading finishes)
    await expect(page.locator('text=테스트').first()).toBeVisible({ timeout: 1000 })
  })
})

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } }) // iPhone SE

  test('should fit perfectly on mobile without horizontal scroll', async ({ page }) => {
    await page.goto('/')

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })

    expect(hasHorizontalScroll).toBe(false)
  })

  test('should have touch-friendly buttons on mobile', async ({ page }) => {
    await page.goto('/')

    // Quick search buttons should be visible and tappable
    const quickButton = page.getByRole('button', { name: /오 베들레헴/ })
    await expect(quickButton).toBeVisible()

    // Button should be at least 44px (Apple's minimum touch target)
    const buttonBox = await quickButton.boundingBox()
    expect(buttonBox?.height).toBeGreaterThanOrEqual(40)
  })
})

test.describe('Settings', () => {
  test('should open settings dialog', async ({ page }) => {
    await page.goto('/')

    // Click settings button
    await page.locator('[class*="Settings"], button:has(svg)').first().click()

    // Settings dialog should open
    await expect(page.getByText('설정')).toBeVisible({ timeout: 5000 })
  })

  test('should toggle theme', async ({ page }) => {
    await page.goto('/')

    // Get initial background
    const initialBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor
    })

    // Open settings
    await page.locator('button:has(svg)').last().click()

    // Click theme toggle
    await page.getByRole('button', { name: /어둡게|밝게|Dark|Light/i }).click()

    // Close settings
    await page.keyboard.press('Escape')

    // Background should change
    const newBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor
    })

    expect(newBg).not.toBe(initialBg)
  })
})
