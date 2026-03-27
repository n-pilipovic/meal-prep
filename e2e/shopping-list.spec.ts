import { test, expect } from '@playwright/test';

const skipOnboarding = async (page: any) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('meal-prep:skipped-onboarding', 'true');
  });
};

test.describe('Shopping List', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/shopping');
  });

  test('should display shopping list title', async ({ page }) => {
    await expect(page.getByText('Lista za kupovinu')).toBeVisible();
  });

  test('should show scope toggle buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Danas' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cela nedelja' })).toBeVisible();
  });

  test('should show ingredient checkboxes', async ({ page }) => {
    // Wait for at least one checkbox to load
    await page.locator('input[type="checkbox"]').first().waitFor();
    const count = await page.locator('input[type="checkbox"]').count();
    expect(count).toBeGreaterThan(0);
  });

  test('should show category group headers', async ({ page }) => {
    // Wait for at least one checkbox to ensure data is loaded
    await page.locator('input[type="checkbox"]').first().waitFor();
    const possibleCategories = ['Meso', 'Mlečni proizvodi', 'Voće i povrće', 'Žitarice i hleb', 'Ostava', 'Začini', 'Ulja'];
    const text = await page.textContent('body');
    expect(possibleCategories.some(c => text?.includes(c))).toBe(true);
  });

  test('should toggle checkbox', async ({ page }) => {
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await firstCheckbox.check();
    await expect(firstCheckbox).toBeChecked();
  });

  test('should show strikethrough on checked item', async ({ page }) => {
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await firstCheckbox.check();
    const strikethroughItem = page.locator('.line-through').first();
    await expect(strikethroughItem).toBeVisible();
  });

  test('should switch to week scope', async ({ page }) => {
    // Get today count
    const todayCheckboxes = await page.locator('input[type="checkbox"]').count();

    // Switch to week
    await page.getByText('Cela nedelja').click();
    await page.waitForTimeout(300);

    const weekCheckboxes = await page.locator('input[type="checkbox"]').count();
    // Week should have >= today's count
    expect(weekCheckboxes).toBeGreaterThanOrEqual(todayCheckboxes);
  });

  test('should persist checked state after scope switch', async ({ page }) => {
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await firstCheckbox.check();

    // Switch to week and back
    await page.getByText('Cela nedelja').click();
    await page.getByRole('button', { name: 'Danas' }).click();

    // Should still be checked
    await expect(page.locator('input[type="checkbox"]').first()).toBeChecked();
  });

  test('should show bottom navigation', async ({ page }) => {
    const nav = page.locator('app-bottom-nav');
    await expect(nav.getByText('Danas')).toBeVisible();
    await expect(nav.getByText('Podešavanja')).toBeVisible();
  });
});
