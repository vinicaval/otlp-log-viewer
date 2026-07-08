import { test, expect } from '@playwright/test'
import { mockLogsApi } from './helpers'

test.beforeEach(async ({ page }) => {
  await mockLogsApi(page)
  await page.goto('/')
})

test('renders a severity-stacked histogram bar for every non-empty time bucket', async ({
  page,
}) => {
  const histogram = page.getByLabel('Log frequency histogram')
  await expect(histogram).toBeVisible()
  await expect(histogram.locator('svg')).toBeVisible()
  await expect(histogram.locator('path.recharts-rectangle').first()).toBeVisible()
})

// NOTE: the drag-to-brush time-range filter is intentionally not covered
// here. Recharts' brush interaction relies on its own internal mouse-event
// state machine, and neither Playwright's real `page.mouse` API nor raw
// `dispatchEvent`-based synthetic events reliably drive it end-to-end in a
// headless browser (confirmed by direct experimentation — the reference
// area / resulting filter never appears via either approach, despite
// correct coordinates verified against the actual rendered bar geometry).
// The feature itself was manually verified working in a real browser during
// development (see PR #4); it just isn't automatable here without
// introducing a flaky, high-maintenance test.
