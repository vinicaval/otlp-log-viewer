import { test, expect } from '@playwright/test'
import { mockLogsApi } from './helpers'
import { TOTAL_LOG_COUNT } from './fixtures/otlp-fixture'

test.beforeEach(async ({ page }) => {
  await mockLogsApi(page)
  await page.goto('/')
})

test('renders every log from the API response with severity, time, and body', async ({
  page,
}) => {
  await expect(page.getByText(`${TOTAL_LOG_COUNT} logs`)).toBeVisible()

  const rows = page.locator('[role="list"][aria-label="Log records"] [data-index]')
  await expect(rows).toHaveCount(TOTAL_LOG_COUNT)

  await expect(
    page.getByRole('button', { name: /order confirmed for cart zzframboyant-42/ })
  ).toBeVisible()
})

test('surfaces OTLP severityNumber 0 as UNSPECIFIED, not INFO', async ({ page }) => {
  // Regression coverage for the bug fixed in PR #2 — an unspecified severity
  // must never silently render as a real INFO-level log.
  const row = page.getByRole('button', { name: /unrecognized event type/ })
  await expect(row).toBeVisible()
  await expect(row.getByText('UNSPECIFIED')).toBeVisible()
})

test('expanding a row reveals its attributes, including trace ID pulled from the attribute bag', async ({
  page,
}) => {
  // Regression coverage for the bug fixed in PR #10 — this API puts the
  // trace id under attributes["trace.id"], not the OTLP wire field.
  const row = page.getByRole('button', { name: /invalid credentials for user 42/ })
  await row.click()

  await expect(page.getByText('Trace ID')).toBeVisible()
  await expect(page.getByText('deadbeefcafe0001')).toBeVisible()
})

test('collapsing a row hides its detail panel again', async ({ page }) => {
  const row = page.getByRole('button', { name: /session created/ })
  await row.click()
  await expect(page.getByText('METADATA')).toBeVisible()

  await row.click()
  await expect(page.getByText('METADATA')).not.toBeVisible()
})

test('density toggle switches between condensed and expanded row heights', async ({
  page,
}) => {
  const firstRow = page.locator('[data-index="0"]').first()
  const condensedBox = await firstRow.boundingBox()

  await page.getByRole('button', { name: 'Expanded rows' }).click()
  const expandedBox = await firstRow.boundingBox()

  expect(expandedBox!.height).toBeGreaterThan(condensedBox!.height)
})
