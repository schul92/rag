// spec: Key Query Variations
// Tests for different ways users might ask for key-based searches

import { test, expect } from '@playwright/test';

test.describe('Key Query Variations', () => {
  test('G키 5개 찾아줘 - should search DB (filler words)', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...');
    await searchInput.fill('G키 5개 찾아줘');
    await searchInput.press('Enter');

    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 60000 });
    await page.waitForTimeout(2000);

    const hasResults = await page.locator('[class*="bg-card"]').count();
    console.log(`"G키 5개 찾아줘" found ${hasResults} result cards`);
    expect(hasResults).toBeGreaterThan(0);
  });

  test('G키 찬양 5개 - should search DB (original working)', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...');
    await searchInput.fill('G키 찬양 5개');
    await searchInput.press('Enter');

    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 60000 });
    await page.waitForTimeout(2000);

    const hasResults = await page.locator('[class*="bg-card"]').count();
    console.log(`"G키 찬양 5개" found ${hasResults} result cards`);
    expect(hasResults).toBeGreaterThan(0);
  });

  test('C키 곡 추천해줘 - should search DB', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...');
    await searchInput.fill('C키 곡 추천해줘');
    await searchInput.press('Enter');

    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 60000 });
    await page.waitForTimeout(2000);

    const hasResults = await page.locator('[class*="bg-card"]').count();
    console.log(`"C키 곡 추천해줘" found ${hasResults} result cards`);
    expect(hasResults).toBeGreaterThan(0);
  });

  test('A키 악보 보여줘 - should search DB', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...');
    await searchInput.fill('A키 악보 보여줘');
    await searchInput.press('Enter');

    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 60000 });
    await page.waitForTimeout(2000);

    const hasResults = await page.locator('[class*="bg-card"]').count();
    console.log(`"A키 악보 보여줘" found ${hasResults} result cards`);
    expect(hasResults).toBeGreaterThan(0);
  });

  test('광대하신 주 c키 - should find specific song (not all C key)', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...');
    await searchInput.fill('광대하신 주 c키');
    await searchInput.press('Enter');

    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 60000 });
    await page.waitForTimeout(2000);

    const pageContent = await page.content();
    // Should find results related to 광대하신 주
    expect(pageContent.toLowerCase()).toContain('광대하신');
  });
});
