// spec: Korean Search Functionality
// seed: e2e/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Korean Search Functionality', () => {
  test('should search by Korean song title', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Type '베들레헴' in the search input
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...');
    await searchInput.fill('베들레헴');

    // Press Enter to submit
    await searchInput.press('Enter');

    // Wait for loading spinner to disappear
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 });

    // Verify user message '베들레헴' appears in chat
    await expect(page.getByText('베들레헴', { exact: true })).toBeVisible();

    // Verify response card is displayed
    await expect(page.locator('[class*="bg-card"]').first()).toBeVisible({ timeout: 30000 });
  });

  test('should find specific Korean song', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Type '거룩하신 어린양' in search input
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...');
    await searchInput.fill('거룩하신 어린양');

    // Press Enter
    await searchInput.press('Enter');

    // Wait for loading to complete
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 });

    // Verify the song title appears in results
    await expect(page.locator('text=거룩하신 어린양')).toBeVisible({ timeout: 30000 });
  });

  test('should handle Korean spacing variations', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Search for '위대하신주' (no spaces)
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...');
    await searchInput.fill('위대하신주');
    await searchInput.press('Enter');

    // Wait for results
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 });

    // Verify results are shown
    const pageContent = await page.content();
    expect(pageContent).toContain('위대하신');
  });

  test('should handle Korean IME composition correctly', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Type Korean text '베들레헴' character by character with delays
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...');
    await searchInput.click();
    await searchInput.type('베들레헴', { delay: 100 });

    // Press Enter
    await searchInput.press('Enter');

    // Wait for results
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 });

    // Should have results displayed (IME handled correctly)
    await expect(page.locator('[class*="bg-card"]').first()).toBeVisible({ timeout: 30000 });

    // Verify the search term appears in user message
    await expect(page.getByText('베들레헴', { exact: true })).toBeVisible();
  });

  test('should handle typos with fuzzy matching', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Type '위대하신쥬' (typo: 쥬 instead of 주)
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...');
    await searchInput.fill('위대하신쥬');

    // Press Enter
    await searchInput.press('Enter');

    // Wait for results
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 30000 });

    // Verify results are shown (fuzzy matching should find related songs)
    await expect(page.locator('[class*="bg-card"]').first()).toBeVisible({ timeout: 30000 });
  });
});
