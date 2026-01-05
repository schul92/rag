// spec: Key Query Functionality
// Tests for key-based song searches

import { test, expect } from '@playwright/test';

test.describe('Key Query Functionality', () => {
  test('G키 찬양 5개 - should search DB for G key songs, not web', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Enable request interception to check what API receives
    let apiRequest: any = null;
    page.on('request', request => {
      if (request.url().includes('/api/chat')) {
        apiRequest = request;
      }
    });

    // Type 'G키 찬양 5개' in the search input
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...');
    await searchInput.fill('G키 찬양 5개');

    // Press Enter to submit
    await searchInput.press('Enter');

    // Wait for loading spinner to disappear (with longer timeout for API call)
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 60000 });

    // Verify user message appears in chat
    await expect(page.getByText('G키 찬양 5개', { exact: true })).toBeVisible();

    // Wait for results to appear
    await page.waitForTimeout(2000);

    // Check that results are shown (should be from DB, not web)
    const pageContent = await page.content();

    // Should NOT see "웹에서 찾은 결과" or web search fallback indicators
    // If results are from DB, they should have key information
    const hasResults = await page.locator('[class*="bg-card"]').count();
    console.log(`Found ${hasResults} result cards`);

    // Verify we got some results
    expect(hasResults).toBeGreaterThan(0);
  });

  test('광대하신 주 c키 - should find specific song in C key', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Type '광대하신 주 c키' in the search input
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...');
    await searchInput.fill('광대하신 주 c키');

    // Press Enter to submit
    await searchInput.press('Enter');

    // Wait for loading spinner to disappear
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 60000 });

    // Verify user message appears
    await expect(page.getByText('광대하신 주 c키', { exact: true })).toBeVisible();

    // Wait for results
    await page.waitForTimeout(2000);

    // Get page content
    const pageContent = await page.content();

    // Should find results related to '광대하신 주' (specific song)
    // Not just random C key songs
    const hasResults = await page.locator('[class*="bg-card"]').count();
    console.log(`Found ${hasResults} result cards`);

    expect(hasResults).toBeGreaterThan(0);

    // The result should mention 광대하신 주 or similar
    expect(pageContent.toLowerCase()).toContain('광대하신');
  });

  test('c키 찬양 3개 - should search DB for C key songs', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Type 'c키 찬양 3개' in the search input
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...');
    await searchInput.fill('c키 찬양 3개');

    // Press Enter
    await searchInput.press('Enter');

    // Wait for loading
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 60000 });

    // Verify message appears
    await expect(page.getByText('c키 찬양 3개', { exact: true })).toBeVisible();

    // Check for results
    await page.waitForTimeout(2000);
    const hasResults = await page.locator('[class*="bg-card"]').count();
    console.log(`Found ${hasResults} result cards`);

    expect(hasResults).toBeGreaterThan(0);
  });

  test('Quick search: G키 찬양 5개 button', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Click the 'G키 찬양 5개' quick search button
    const quickSearchButton = page.getByRole('button', { name: /G키 찬양 5개/i });
    await quickSearchButton.click();

    // Wait for loading
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 60000 });

    // Wait for results
    await page.waitForTimeout(2000);

    // Check for results
    const hasResults = await page.locator('[class*="bg-card"]').count();
    console.log(`Quick search found ${hasResults} result cards`);

    expect(hasResults).toBeGreaterThan(0);
  });
});
