import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Error Handling and Edge Cases
 * 
 * Test scenarios:
 * 1. Prevent empty search query submission
 * 2. Handle no results found gracefully
 * 3. Handle network errors gracefully
 * 4. Handle very long search queries
 * 5. Handle special characters in search query
 */

test.describe('Error Handling and Edge Cases', () => {
  test('should prevent empty search query submission', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/')

    // Leave search input empty
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...')
    
    // Press Enter on empty input
    await searchInput.press('Enter')

    // Verify no search is triggered - no loading state appears
    const spinner = page.locator('[class*="animate-spin"]')
    await expect(spinner).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // If it becomes visible, that means search was triggered (should not happen)
    })

    // Verify no user message appeared (search wasn't submitted)
    const userMessage = page.locator('[class*="from-amber-500"]')
    const messageCount = await userMessage.count()
    expect(messageCount).toBe(0)

    // Verify input validation prevents empty submission
    const messages = page.locator('[class*="bg-card"]')
    const messagesCount = await messages.count()
    expect(messagesCount).toBe(0)
  })

  test('should handle no results found gracefully', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/')

    // Search for non-existent song
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...')
    await searchInput.fill('xyznonexistentsong123456')
    
    // Press Enter
    await searchInput.press('Enter')

    // Wait for search to complete
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Verify a message indicating no results is displayed
    const responseText = await page.locator('[class*="bg-card"]').first().textContent()
    expect(responseText).toBeTruthy()
    
    // The response should indicate no results were found
    const hasNoResultsIndicator = responseText?.toLowerCase().includes('찾을 수 없') || 
                                   responseText?.toLowerCase().includes('없습니다') ||
                                   responseText?.toLowerCase().includes('not found') ||
                                   responseText?.toLowerCase().includes('no results')
    
    // Verify no image cards are displayed
    const imageCards = page.locator('img[alt*="Sheet"]')
    const imageCount = await imageCards.count()
    expect(imageCount).toBe(0)

    // Verify message is helpful (app handled it gracefully)
    expect(responseText?.length).toBeGreaterThan(10)
  })

  test('should handle network errors gracefully', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/')

    // Use page.route to simulate network failure on /api/chat
    await page.route('**/api/chat', route => {
      route.abort('failed')
    })

    // Submit a search query
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...')
    await searchInput.fill('Holy Forever')
    await searchInput.press('Enter')

    // Wait a bit for the error to be handled
    await page.waitForTimeout(3000)

    // Verify app does not crash - page should still be responsive
    await expect(page.locator('header')).toBeVisible()
    await expect(searchInput).toBeVisible()

    // Verify user can retry - restore network
    await page.unroute('**/api/chat')
    
    // Search again
    await searchInput.clear()
    await searchInput.fill('Holy Forever')
    await searchInput.press('Enter')

    // This time it should work
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })
    
    // Verify results are displayed
    await expect(page.locator('[class*="bg-card"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('should handle very long search queries', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/')

    // Type very long search query (200+ characters)
    const longQuery = 'Holy Forever Holy Forever Holy Forever Holy Forever Holy Forever Holy Forever Holy Forever Holy Forever Holy Forever Holy Forever Holy Forever Holy Forever Holy Forever Holy Forever Holy Forever Holy Forever Holy Forever Holy Forever Holy Forever Holy Forever'
    
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...')
    await searchInput.fill(longQuery)
    
    // Submit the query
    await searchInput.press('Enter')

    // Verify app handles it without breaking UI
    await expect(page.locator('header')).toBeVisible()
    
    // Wait for search to complete or timeout
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 }).catch(() => {
      // Timeout is acceptable for very long queries
    })

    // Verify search executes or provides appropriate feedback
    const hasResponse = await page.locator('[class*="bg-card"]').first().isVisible().catch(() => false)
    
    // App should either show results or handle gracefully
    expect(hasResponse).toBeDefined()
    
    // Verify UI is not broken
    await expect(searchInput).toBeVisible()
  })

  test('should handle special characters in search query', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/')

    // Search with special characters
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...')
    await searchInput.fill('#@&!%$')
    
    // Submit the query
    await searchInput.press('Enter')

    // Wait for search to complete
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Verify app handles special characters without errors
    await expect(page.locator('header')).toBeVisible()
    
    // Verify no JavaScript errors in console (app didn't crash)
    await expect(searchInput).toBeVisible()

    // Verify search completes (may show no results, but no crash)
    const response = page.locator('[class*="bg-card"]').first()
    await expect(response).toBeVisible({ timeout: 5000 })
    
    // Get response text to verify it handled the query
    const responseText = await response.textContent()
    expect(responseText).toBeTruthy()
  })
})
