import type { Page } from '@playwright/test'
import { otlpFixture } from './fixtures/otlp-fixture'

// Intercepts the app's own `/api/logs` proxy route (not the real upstream)
// so tests run against a fixed, known dataset instead of the upstream mock
// API's fresh-random-data-every-call behavior.
export async function mockLogsApi(page: Page, payload: unknown = otlpFixture) {
  await page.route('**/api/logs', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    })
  })
}
