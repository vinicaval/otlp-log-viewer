import { test, expect } from '@playwright/test'
import { mockLogsApi } from './helpers'
import { TOTAL_LOG_COUNT } from './fixtures/otlp-fixture'

test.beforeEach(async ({ page }) => {
  await mockLogsApi(page)
  await page.goto('/')
})

test('searching narrows the list to matching logs and shows a filtered/total count', async ({
  page,
}) => {
  await page.getByRole('searchbox', { name: 'Search log messages' }).fill('zzframboyant')

  await expect(page.locator('span.tabular-nums').first()).toContainText(
    `1 / ${TOTAL_LOG_COUNT}`
  )
  const rows = page.locator('[role="list"][aria-label="Log records"] [data-index]')
  await expect(rows).toHaveCount(1)
  await expect(page.getByRole('button', { name: /order confirmed for cart/ })).toBeVisible()
})

test('search also matches attribute values, not just the body', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Search log messages' }).fill('deadbeefcafe0001')
  await expect(page.getByRole('button', { name: /invalid credentials for user 42/ })).toBeVisible()
  const rows = page.locator('[role="list"][aria-label="Log records"] [data-index]')
  await expect(rows).toHaveCount(1)
})

test('clearing the search restores the full list', async ({ page }) => {
  const search = page.getByRole('searchbox', { name: 'Search log messages' })
  await search.fill('zzframboyant')
  await expect(page.locator('[role="list"][aria-label="Log records"] [data-index]')).toHaveCount(1)

  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(page.locator('[role="list"][aria-label="Log records"] [data-index]')).toHaveCount(
    TOTAL_LOG_COUNT
  )
})

test('a search with no matches shows the empty state', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Search log messages' }).fill('no-such-log-exists')
  await expect(page.getByText('No logs found')).toBeVisible()
  await expect(page.getByText('Try adjusting your search query or severity filters.')).toBeVisible()
})

test('deselecting a severity chip hides logs of that severity', async ({ page }) => {
  await page.getByRole('button', { name: 'Severity: ERROR' }).click()

  const rows = page.locator('[role="list"][aria-label="Log records"] [data-index]')
  await expect(rows).toHaveCount(TOTAL_LOG_COUNT - 2) // fixture has 2 ERROR logs
  await expect(page.getByRole('button', { name: /token refresh failed/ })).not.toBeVisible()
})

test('the "All" toggle re-selects every severity band', async ({ page }) => {
  await page.getByRole('button', { name: 'Severity: ERROR' }).click()
  await expect(
    page.locator('[role="list"][aria-label="Log records"] [data-index]')
  ).toHaveCount(TOTAL_LOG_COUNT - 2)

  await page.getByRole('button', { name: 'All', exact: true }).click()
  await expect(
    page.locator('[role="list"][aria-label="Log records"] [data-index]')
  ).toHaveCount(TOTAL_LOG_COUNT)
})
