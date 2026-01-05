import { test, expect } from '@playwright/test'

test.describe('Settings and Preferences', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
  })

  test('should open settings dialog', async ({ page }) => {
    // Click settings button (gear icon) in header
    const settingsButton = page.locator('button:has(svg)').last()
    await settingsButton.click()

    // Verify settings dialog opens
    await expect(page.getByText('설정')).toBeVisible({ timeout: 5000 })

    // Verify dialog title '설정' is displayed
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible()

    // Verify language toggle option is visible
    await expect(page.getByText(/한국어|English/)).toBeVisible()

    // Verify theme toggle option is visible
    await expect(page.getByText(/어둡게|밝게|Dark|Light/)).toBeVisible()
  })

  test('should toggle language from Korean to English', async ({ page }) => {
    // Open settings dialog
    const settingsButton = page.locator('button:has(svg)').last()
    await settingsButton.click()

    // Verify current language shows '한국어'
    await expect(page.getByText('한국어')).toBeVisible({ timeout: 5000 })

    // Click 'English' button
    await page.getByRole('button', { name: /English/i }).click()

    // Close settings dialog
    await page.keyboard.press('Escape')

    // Verify UI text changes to English
    // Wait a bit for the language to update
    await page.waitForTimeout(500)

    // Verify search placeholder becomes English text
    const searchInput = page.locator('input[type="text"], input[placeholder]').first()
    const placeholder = await searchInput.getAttribute('placeholder')
    
    // Check if placeholder is in English (not Korean)
    expect(placeholder).not.toContain('곡 제목')
    expect(placeholder?.toLowerCase()).toMatch(/enter|search|song|title/)
  })

  test('should toggle language from English to Korean', async ({ page }) => {
    // Open settings and set language to English first
    let settingsButton = page.locator('button:has(svg)').last()
    await settingsButton.click()
    await page.getByRole('button', { name: /English/i }).click()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Open settings again
    settingsButton = page.locator('button:has(svg)').last()
    await settingsButton.click()

    // Click Korean language button
    await page.getByRole('button', { name: /한국어|Korean/i }).click()

    // Close settings
    await page.keyboard.press('Escape')

    // Verify UI text changes to Korean
    await page.waitForTimeout(500)

    // Verify placeholder becomes Korean
    const searchInput = page.locator('input[type="text"], input[placeholder]').first()
    const placeholder = await searchInput.getAttribute('placeholder')
    
    expect(placeholder).toContain('곡 제목')
  })

  test('should toggle theme from dark to light', async ({ page }) => {
    // Navigate to app (default: dark mode)
    // Capture initial background color
    const initialBg = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement).backgroundColor
    })

    // Open settings dialog
    const settingsButton = page.locator('button:has(svg)').last()
    await settingsButton.click()

    // Click '밝게' (Light) button
    await page.getByRole('button', { name: /밝게|Light/i }).click()

    // Close settings
    await page.keyboard.press('Escape')

    // Wait for theme to update
    await page.waitForTimeout(500)

    // Verify background color changed to light
    const newBg = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement).backgroundColor
    })
    expect(newBg).not.toBe(initialBg)

    // Verify the html element has 'light' class or data-theme='light'
    const hasLightClass = await page.evaluate(() => {
      const html = document.documentElement
      return html.classList.contains('light') || 
             html.getAttribute('data-theme') === 'light' ||
             html.classList.contains('light-mode')
    })
    
    expect(hasLightClass).toBe(true)
  })

  test('should toggle theme from light to dark', async ({ page }) => {
    // Set theme to light mode first
    let settingsButton = page.locator('button:has(svg)').last()
    await settingsButton.click()
    await page.getByRole('button', { name: /밝게|Light/i }).click()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Capture light mode background
    const lightBg = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement).backgroundColor
    })

    // Open settings
    settingsButton = page.locator('button:has(svg)').last()
    await settingsButton.click()

    // Click dark mode button
    await page.getByRole('button', { name: /어둡게|Dark/i }).click()

    // Close settings
    await page.keyboard.press('Escape')

    // Wait for theme to update
    await page.waitForTimeout(500)

    // Verify background changes to dark
    const darkBg = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement).backgroundColor
    })
    expect(darkBg).not.toBe(lightBg)

    // Verify html element has 'dark' class
    const hasDarkClass = await page.evaluate(() => {
      const html = document.documentElement
      return html.classList.contains('dark') || 
             html.getAttribute('data-theme') === 'dark' ||
             html.classList.contains('dark-mode')
    })
    
    expect(hasDarkClass).toBe(true)
  })

  test('should persist settings after page reload', async ({ page }) => {
    // Open settings and change language to English
    let settingsButton = page.locator('button:has(svg)').last()
    await settingsButton.click()
    await page.getByRole('button', { name: /English/i }).click()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Change theme to light mode
    settingsButton = page.locator('button:has(svg)').last()
    await settingsButton.click()
    await page.getByRole('button', { name: /밝게|Light/i }).click()

    // Close settings
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Reload the page
    await page.reload()
    await page.waitForTimeout(1000)

    // Verify language is still English after reload
    const searchInput = page.locator('input[type="text"], input[placeholder]').first()
    const placeholder = await searchInput.getAttribute('placeholder')
    expect(placeholder?.toLowerCase()).toMatch(/enter|search|song|title/)

    // Verify theme is still light mode after reload
    const hasLightClass = await page.evaluate(() => {
      const html = document.documentElement
      return html.classList.contains('light') || 
             html.getAttribute('data-theme') === 'light' ||
             html.classList.contains('light-mode')
    })
    
    expect(hasLightClass).toBe(true)
  })

  test('should close settings dialog with multiple methods', async ({ page }) => {
    // Open settings dialog
    let settingsButton = page.locator('button:has(svg)').last()
    await settingsButton.click()

    // Verify dialog is open
    await expect(page.getByText('설정')).toBeVisible({ timeout: 5000 })

    // Click 'Close' or X button
    const closeButton = page.locator('button[aria-label*="close" i], button:has(svg):near(:text("설정"))').last()
    await closeButton.click()

    // Verify dialog closes
    await expect(page.getByText('설정')).not.toBeVisible({ timeout: 3000 })

    // Open settings again
    settingsButton = page.locator('button:has(svg)').last()
    await settingsButton.click()

    // Verify dialog is open again
    await expect(page.getByText('설정')).toBeVisible({ timeout: 5000 })

    // Press Escape key
    await page.keyboard.press('Escape')

    // Verify dialog closes
    await expect(page.getByText('설정')).not.toBeVisible({ timeout: 3000 })
  })
})
