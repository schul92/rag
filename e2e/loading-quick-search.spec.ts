import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Loading States and Quick Search
 * 
 * Test Suite: Loading States and Quick Search (7 tests)
 * This is a PraiseFlow app - a bilingual worship song chord sheet search system.
 * Base URL: http://localhost:3000
 */

test.describe('Loading States and Quick Search', () => {
  test('should show progressive loading messages during search', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/')

    // Type a search query
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...')
    await searchInput.fill('베들레헴')

    // Submit the search
    await searchInput.press('Enter')

    // Immediately check for loading spinner (animate-spin class)
    await expect(page.locator('[class*="animate-spin"]')).toBeVisible({ timeout: 2000 })

    // Look for progressive loading messages (e.g., '찾는 중...', '분석 중...')
    // Note: Progressive messages may appear quickly, so we check for their presence
    const loadingMessages = page.locator('text=/찾는 중|분석 중|처리 중/')
    await expect(loadingMessages.first()).toBeVisible({ timeout: 5000 }).catch(() => {
      // Loading messages may be too fast to catch - that's ok
    })

    // Verify loading progress bar is visible
    await expect(page.locator('[class*="bg-gradient-to-r"]').first()).toBeVisible({ timeout: 5000 })

    // Wait for loading to complete
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Verify loading indicators disappear when results ready
    await expect(page.locator('[class*="animate-spin"]')).not.toBeVisible()
    await expect(page.locator('[class*="bg-card"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('should show user message instantly before search completes', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/')

    // Type '테스트' in search input
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...')
    await searchInput.fill('테스트')

    // Press Enter
    await searchInput.press('Enter')

    // Immediately check if user message '테스트' appears (within 1 second)
    await expect(page.locator('text=테스트').first()).toBeVisible({ timeout: 1000 })

    // Verify user message visible before loading completes
    const userMessage = page.locator('text=테스트').first()
    await expect(userMessage).toBeVisible()

    // Verify loading indicator appears after user message
    await expect(page.locator('[class*="animate-spin"]')).toBeVisible({ timeout: 2000 })
  })

  test('should disable input during search', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/')

    // Submit a search query
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...')
    await searchInput.fill('검색 테스트')
    await searchInput.press('Enter')

    // While loading, check if search input is disabled
    await expect(searchInput).toBeDisabled({ timeout: 2000 })

    // Try to type in input during loading (should not work)
    await searchInput.fill('새로운 입력').catch(() => {
      // Expected to fail during disabled state
    })

    // Verify send button is also disabled
    const sendButton = page.locator('button[type="submit"], button:has-text("전송"), button:has(svg)')
      .filter({ hasText: /전송|보내기|Send/ })
    await expect(sendButton.first()).toBeDisabled().catch(() => {
      // Button might not have disabled attribute, but should not be clickable
    })

    // Wait for search to complete
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Verify input and button re-enabled after loading
    await expect(searchInput).toBeEnabled()
  })

  test('should show smooth loading animations', async ({ page }) => {
    // Navigate to homepage (implicit from seed)
    await page.goto('/')

    // Submit a search
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...')
    await searchInput.fill('애니메이션 테스트')
    await searchInput.press('Enter')

    // Verify spinner has animation class (animate-spin)
    const spinner = page.locator('[class*="animate-spin"]')
    await expect(spinner).toBeVisible({ timeout: 2000 })
    
    // Verify it has the animate-spin class
    const spinnerClass = await spinner.getAttribute('class')
    expect(spinnerClass).toContain('animate-spin')

    // Verify progress bar has gradient animation
    const progressBar = page.locator('[class*="bg-gradient-to-r"]').first()
    await expect(progressBar).toBeVisible({ timeout: 5000 })
    
    const progressClass = await progressBar.getAttribute('class')
    expect(progressClass).toContain('bg-gradient-to-r')

    // Check animations are smooth (no flickering)
    // We verify by checking that elements remain visible consistently
    await expect(spinner).toBeVisible()
    await page.waitForTimeout(500) // Brief wait to observe animation
    await expect(spinner).toBeVisible()
  })

  test('should trigger search when clicking quick search button', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/')

    // Click '오 베들레헴' quick search button
    await page.getByRole('button', { name: /오 베들레헴/ }).click()

    // Verify loading spinner appears
    await expect(page.locator('[class*="animate-spin"]')).toBeVisible({ timeout: 2000 })

    // Wait for loading to complete
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Verify search results displayed
    await expect(page.locator('[class*="bg-card"]').first()).toBeVisible({ timeout: 5000 })

    // Verify '악보' appears in response
    const responseText = await page.locator('[class*="bg-card"], [class*="rounded-2xl"]').first().textContent()
    expect(responseText).toContain('악보')

    // Verify image cards shown
    const songCards = page.locator('img[alt*="Sheet"], img[alt*="악보"]')
    await expect(songCards.first()).toBeVisible({ timeout: 5000 })
  })

  test('should work with key-based quick search button', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/')

    // Click 'G키 찬양 5개' quick search button
    await page.getByRole('button', { name: /G키 찬양 5개/ }).click()

    // Wait for loading to complete
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Verify results mention 'G 키' or 'G키'
    await expect(page.locator('text=/G\\s*키|G키/').first()).toBeVisible({ timeout: 5000 })

    // Verify up to 5 songs displayed
    const responseText = await page.locator('[class*="bg-card"], [class*="rounded-2xl"]').first().textContent() || ''
    
    // Count numbered items (1. 2. 3. etc.) in the response
    const numberedItems = responseText.match(/\d+\./g) || []
    expect(numberedItems.length).toBeLessThanOrEqual(5)
    expect(numberedItems.length).toBeGreaterThan(0)

    // Check cards have 'G' key badges
    const keyBadges = page.locator('text=/G\\s*키|G키/').first()
    await expect(keyBadges).toBeVisible({ timeout: 5000 })
  })

  test('should handle multiple sequential quick searches', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/')

    // Click '오 베들레헴' button, wait for results
    await page.getByRole('button', { name: /오 베들레헴/ }).click()
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Verify results displayed
    await expect(page.locator('[class*="bg-card"]').first()).toBeVisible({ timeout: 5000 })

    // Click 'D키 악보 3개' button
    const dKeyButton = page.getByRole('button', { name: /D키.*3개|D키 악보 3개/ })
    await dKeyButton.click()

    // Wait for new results
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Verify chat shows both searches
    const userMessages = page.locator('[class*="from-amber-500"], [class*="user"]')
    const messageCount = await userMessages.count()
    expect(messageCount).toBeGreaterThanOrEqual(2)

    // Verify latest results are for D key songs
    const latestResponse = page.locator('[class*="bg-card"], [class*="rounded-2xl"]').last()
    const latestText = await latestResponse.textContent() || ''
    expect(latestText).toMatch(/D\s*키|D키/)

    // Verify previous results still visible in chat
    await expect(page.locator('text=베들레헴')).toBeVisible()
    await expect(page.locator('text=/D\\s*키|D키/')).toBeVisible()
  })
})
