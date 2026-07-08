import { test, expect } from '@playwright/test'
import { mockLogsApi } from './helpers'

test.beforeEach(async ({ page }) => {
  await mockLogsApi(page)
  await page.goto('/')
})

test('toggling Group by service switches from a flat list to per-service groups', async ({
  page,
}) => {
  await expect(page.getByRole('list', { name: 'Log records' })).toBeVisible()

  await page.getByRole('button', { name: 'Group by service' }).click()

  const groupedList = page.getByRole('list', { name: 'Logs grouped by service' })
  await expect(groupedList).toBeVisible()

  const commerceGroup = page.getByRole('button', { name: /commerce \/ checkout/ })
  const identityGroup = page.getByRole('button', { name: /identity \/ auth/ })
  await expect(commerceGroup).toContainText('5')
  await expect(identityGroup).toContainText('5')
})

test('switching back to the flat view restores chronological order', async ({ page }) => {
  await page.getByRole('button', { name: 'Group by service' }).click()
  await expect(page.getByRole('list', { name: 'Logs grouped by service' })).toBeVisible()

  await page.getByRole('button', { name: 'Flat chronological list' }).click()
  await expect(page.getByRole('list', { name: 'Log records' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Logs grouped by service' })).not.toBeVisible()
})

test('a service group can be collapsed and re-expanded', async ({ page }) => {
  await page.getByRole('button', { name: 'Group by service' }).click()

  const commerceGroup = page.getByRole('button', { name: /commerce \/ checkout/ })
  await commerceGroup.click() // collapse

  await expect(
    page.getByRole('button', { name: /order confirmed for cart/ })
  ).not.toBeVisible()

  await commerceGroup.click() // re-expand
  await expect(page.getByRole('button', { name: /order confirmed for cart/ })).toBeVisible()
})
