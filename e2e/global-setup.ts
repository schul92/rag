import { chromium, type FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  // Access baseURL from projects if available, otherwise use default
  const baseURL = (config.projects?.[0]?.use as { baseURL?: string })?.baseURL || 'http://localhost:3000'

  console.log(`Checking if server is running at ${baseURL}...`)

  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    const response = await page.goto(baseURL, {
      timeout: 5000,
      waitUntil: 'domcontentloaded'
    })

    if (response && response.ok()) {
      console.log(`✓ Server is ready at ${baseURL}`)
      await browser.close()
      return
    }
  } catch (error) {
    await browser.close()
    throw new Error(
      `\n\n` +
      `==================================================\n` +
      `ERROR: Server is not running at ${baseURL}\n` +
      `\n` +
      `Please start the development server before running tests:\n` +
      `  npm run dev\n` +
      `\n` +
      `Then run the tests in a separate terminal.\n` +
      `==================================================\n`
    )
  }

  await browser.close()
  throw new Error(`Server at ${baseURL} is not responding`)
}

export default globalSetup
