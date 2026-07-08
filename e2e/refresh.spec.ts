import { test, expect } from '@playwright/test'
import { otlpFixture } from './fixtures/otlp-fixture'

test('clicking Refresh re-fetches and displays newly returned data', async ({ page }) => {
  let call = 0
  await page.route('**/api/logs', async (route) => {
    call++
    const payload =
      call === 1
        ? otlpFixture
        : {
            resourceLogs: [
              {
                resource: {
                  attributes: [
                    { key: 'service.name', value: { stringValue: 'billing' } },
                    { key: 'service.namespace', value: { stringValue: 'finance' } },
                  ],
                  droppedAttributesCount: 0,
                },
                scopeLogs: [
                  {
                    scope: { name: 'mock', attributes: [] },
                    logRecords: [
                      {
                        timeUnixNano: '1704067200000000000',
                        observedTimeUnixNano: '1704067200000000000',
                        severityNumber: 9,
                        severityText: 'INFO',
                        body: { stringValue: 'freshly refreshed log entry' },
                        attributes: [],
                        droppedAttributesCount: 0,
                      },
                    ],
                  },
                ],
              },
            ],
          }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    })
  })

  await page.goto('/')
  await expect(page.getByText('10 logs')).toBeVisible()

  await page.getByRole('button', { name: 'Refresh logs' }).click()

  await expect(page.getByText('1 logs')).toBeVisible()
  await expect(page.getByRole('button', { name: /freshly refreshed log entry/ })).toBeVisible()
  expect(call).toBeGreaterThanOrEqual(2)
})

test('repeated rapid clicks on Refresh do not fire duplicate concurrent requests', async ({
  page,
}) => {
  let inFlight = 0
  let maxConcurrent = 0

  await page.route('**/api/logs', async (route) => {
    inFlight++
    maxConcurrent = Math.max(maxConcurrent, inFlight)
    await new Promise((r) => setTimeout(r, 300)) // hold the response open
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(otlpFixture),
    })
    inFlight--
  })

  await page.goto('/')
  await expect(page.getByText('10 logs')).toBeVisible()

  const refreshButton = page.getByRole('button', { name: 'Refresh logs' })

  // Dispatch several raw clicks a short (but real) gap apart — fast enough
  // that a naive "just call the handler" implementation would still fire a
  // request for each one, but with enough breathing room for React to
  // actually commit the `disabled` state between clicks (unlike a fully
  // synchronous batch, which every click would land before any re-render).
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('button[aria-label="Refresh logs"]')!.click()
    })
    await page.waitForTimeout(30)
  }

  await expect(refreshButton).toBeDisabled()
  await expect(refreshButton).toBeEnabled({ timeout: 5000 })

  // Only the first click's request should have actually gone out while the
  // button stayed disabled for the rest.
  expect(maxConcurrent).toBe(1)
})
