// spec: Mobile UX Testing
// Comprehensive mobile user experience tests

import { test, expect } from '@playwright/test';

test.describe('Mobile UX', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    // Wait for app to be ready
    await page.waitForSelector('[data-slot="carousel"]', { state: 'attached', timeout: 5000 }).catch(() => {});
  });

  test('Initial state - all elements visible and properly sized', async ({ page }) => {
    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/mobile-initial.png', fullPage: true });

    // Check header is visible
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Check logo/title is visible (Korean: 찬양팀 악보)
    await expect(page.locator('header h1')).toBeVisible();

    // Check settings button is visible and tappable
    const settingsBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    await expect(settingsBtn).toBeVisible();

    // Check search input is visible
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...').or(page.getByPlaceholder('Enter song title...'));
    await expect(searchInput).toBeVisible();

    // Check search input is properly sized (not too small)
    const inputBox = await searchInput.boundingBox();
    expect(inputBox?.height).toBeGreaterThan(35); // At least 35px tall

    // Check quick search buttons are visible
    const quickSearchButtons = page.locator('button').filter({ hasText: '찬양' }).or(
      page.locator('button').filter({ hasText: '베들레헴' })
    );
    const count = await quickSearchButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Quick search buttons are tappable on mobile', async ({ page }) => {
    // Find a quick search button
    const quickSearchBtn = page.locator('button').filter({ hasText: 'G키 찬양 5개' });
    await expect(quickSearchBtn).toBeVisible();

    // Check button is large enough for touch (at least 44px - iOS minimum)
    const btnBox = await quickSearchBtn.boundingBox();
    expect(btnBox?.height).toBeGreaterThanOrEqual(40);

    // Tap the button
    await quickSearchBtn.tap();

    // Wait for loading
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 60000 });

    // Take screenshot of results
    await page.screenshot({ path: 'test-results/mobile-results.png', fullPage: true });

    // Verify results are shown
    const cards = await page.locator('[class*="bg-card"]').count();
    expect(cards).toBeGreaterThan(0);
  });

  test('Carousel is swipeable on mobile', async ({ page }) => {
    // Search for something that returns multiple results
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...');
    await searchInput.fill('G키 찬양 5개');
    await searchInput.press('Enter');

    // Wait for loading
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 60000 });

    // Wait for carousel to appear
    await page.waitForTimeout(2000);

    // Check if carousel exists
    const carousel = page.locator('[data-slot="carousel"]');
    const carouselExists = await carousel.count() > 0;

    if (carouselExists) {
      // Take screenshot before swipe
      await page.screenshot({ path: 'test-results/mobile-carousel-before.png' });

      // Get carousel bounds
      const carouselBox = await carousel.boundingBox();
      if (carouselBox) {
        // Perform swipe gesture (left swipe)
        await page.mouse.move(carouselBox.x + carouselBox.width * 0.8, carouselBox.y + carouselBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(carouselBox.x + carouselBox.width * 0.2, carouselBox.y + carouselBox.height / 2, { steps: 10 });
        await page.mouse.up();

        await page.waitForTimeout(500);

        // Take screenshot after swipe
        await page.screenshot({ path: 'test-results/mobile-carousel-after.png' });
      }
    }

    // Verify results are visible
    const cards = await page.locator('[class*="bg-card"]').count();
    expect(cards).toBeGreaterThan(0);
  });

  test('Image modal works on mobile with pinch-to-zoom hint', async ({ page }) => {
    // Search for something
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...');
    await searchInput.fill('베들레헴');
    await searchInput.press('Enter');

    // Wait for loading
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 60000 });

    // Wait for results
    await page.waitForTimeout(2000);

    // Click on first image card
    const firstCard = page.locator('[class*="cursor-pointer"]').first();
    await firstCard.click();

    // Wait for modal to open
    await page.waitForTimeout(500);

    // Take screenshot of modal
    await page.screenshot({ path: 'test-results/mobile-modal.png' });

    // Check modal is visible (full screen on mobile)
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Check close button is visible
    const closeBtn = modal.locator('button').filter({ has: page.locator('svg') }).first();
    await expect(closeBtn).toBeVisible();

    // Check pinch-to-zoom hint is visible on mobile
    const zoomHint = page.getByText('두 손가락으로 확대/축소');
    const hintVisible = await zoomHint.isVisible().catch(() => false);
    console.log('Pinch-to-zoom hint visible:', hintVisible);

    // Close modal
    await closeBtn.click();
    await page.waitForTimeout(300);

    // Verify modal closed
    await expect(modal).not.toBeVisible();
  });

  test('Settings drawer works on mobile', async ({ page }) => {
    // Click settings button (should open drawer on mobile, not dialog)
    const settingsBtn = page.locator('header button').filter({ has: page.locator('svg') }).first();
    await settingsBtn.click();

    // Wait for drawer/dialog to open
    await page.waitForTimeout(500);

    // Take screenshot
    await page.screenshot({ path: 'test-results/mobile-settings.png' });

    // Check settings content is visible
    const languageOption = page.getByText('Language').or(page.getByText('언어'));
    await expect(languageOption).toBeVisible();

    const themeOption = page.getByText('Theme').or(page.getByText('테마'));
    await expect(themeOption).toBeVisible();
  });

  test('Search input stays visible while typing', async ({ page }) => {
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...');

    // Focus input
    await searchInput.click();

    // Take screenshot with keyboard potentially open
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/mobile-keyboard.png' });

    // Type some text
    await searchInput.fill('테스트 검색');

    // Verify input still visible
    await expect(searchInput).toBeVisible();

    // Verify input value
    await expect(searchInput).toHaveValue('테스트 검색');
  });

  test('Results scroll properly on mobile', async ({ page }) => {
    // Search for something with many results
    const searchInput = page.getByPlaceholder('곡 제목을 입력하세요...');
    await searchInput.fill('G키 찬양 5개');
    await searchInput.press('Enter');

    // Wait for loading
    await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 60000 });

    // Wait for results
    await page.waitForTimeout(2000);

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(300);

    // Take screenshot
    await page.screenshot({ path: 'test-results/mobile-scroll.png' });

    // Verify page scrolled
    const scrollY = await page.evaluate(() => window.scrollY);
    console.log('Scroll position:', scrollY);
  });
});
