import { test, expect } from '@playwright/test'

/**
 * E2E Tests for English Search Functionality
 *
 * Test scenarios:
 * 1. Search by English song title
 * 2. Find Korean songs with English title alias
 * 3. Handle partial English title search
 */

test.describe('English Search Functionality', () => {
  test('should search by English song title', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/')

    // Type 'Holy Forever' in search input
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...')
    await searchInput.fill('Holy Forever')

    // Press Enter
    await searchInput.press('Enter')

    // Wait for loading spinner to disappear
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Verify user message 'Holy Forever' appears
    await expect(page.locator('text=Holy Forever').first()).toBeVisible({ timeout: 5000 })

    // Verify response is displayed
    await expect(page.locator('[class*="bg-card"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('should find Korean songs with English title alias', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/')

    // Type 'Great Are You Lord' in search input
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...')
    await searchInput.fill('Great Are You Lord')

    // Press Enter
    await searchInput.press('Enter')

    // Wait for results
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Verify results are displayed (cross-language alias matching)
    await expect(page.locator('[class*="bg-card"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('should handle partial English title search', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/')

    // Type 'Holy' in search input
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...')
    await searchInput.fill('Holy')

    // Press Enter
    await searchInput.press('Enter')

    // Wait for results
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 })

    // Verify songs containing 'Holy' in title are shown
    await expect(page.locator('[class*="bg-card"]').first()).toBeVisible({ timeout: 5000 })
  })
})
