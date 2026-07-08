import { test, expect } from '@playwright/test'
import { mockLogsApi } from './helpers'

test.beforeEach(async ({ page }) => {
  await mockLogsApi(page)
  await page.goto('/')
})

test('"/" focuses the search box', async ({ page }) => {
  const search = page.getByRole('searchbox', { name: 'Search log messages' })
  await expect(search).not.toBeFocused()

  await page.keyboard.press('/')
  await expect(search).toBeFocused()
})

test('j/k move the selected row and Enter expands it', async ({ page }) => {
  // Wait for the list to actually be interactive before sending keys —
  // otherwise the keydown listener may not be registered yet and the
  // keypress is silently dropped.
  await expect(
    page.locator('[role="list"][aria-label="Log records"] [data-index]').first()
  ).toBeVisible()
  // Move focus off the search box so "j" isn't typed into it.
  // Blur the search box rather than clicking elsewhere on the page — the
  // list fills the full viewport below the toolbar, so a click "on body"
  // actually lands on whichever row happens to be underneath and would
  // itself select/expand that row before any keypress is sent.
  await page.getByRole('searchbox', { name: 'Search log messages' }).evaluate((el) =>
    (el as HTMLElement).blur()
  )

  await page.keyboard.press('j')
  await page.keyboard.press('j')
  await page.keyboard.press('j')

  const selected = page.locator('[data-index].bg-muted\\/40')
  await expect(selected).toHaveAttribute('data-index', '3')

  await page.keyboard.press('Enter')
  await expect(page.getByText('METADATA')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByText('METADATA')).not.toBeVisible()
})

test('keyboard nav does not fire while a group is expanded in the grouped view', async ({
  page,
}) => {
  // Regression coverage for the bug fixed in PR #5 — grouped view used to
  // register one global keydown listener per group, so a single keypress
  // moved every group's selection at once.
  await page.getByRole('button', { name: 'Group by service' }).click()
  await expect(
    page.getByRole('list', { name: 'Logs grouped by service' }).locator('[data-index]').first()
  ).toBeVisible()
  // Blur the search box rather than clicking elsewhere on the page — the
  // list fills the full viewport below the toolbar, so a click "on body"
  // actually lands on whichever row happens to be underneath and would
  // itself select/expand that row before any keypress is sent.
  await page.getByRole('searchbox', { name: 'Search log messages' }).evaluate((el) =>
    (el as HTMLElement).blur()
  )

  // Each group's own LogList defaults its first row to "selected" on mount
  // (independent of any keypress) — capture that baseline first.
  const selected = page.locator('[data-index].bg-muted\\/40')
  const before = await selected.evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-index')).sort()
  )

  await page.keyboard.press('j')
  await page.keyboard.press('j')

  // If keyboard nav were (incorrectly) live here, both groups' selection
  // would have moved from index 0 to index 2. It should be a no-op instead.
  const after = await selected.evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-index')).sort()
  )
  expect(after).toEqual(before)
})
