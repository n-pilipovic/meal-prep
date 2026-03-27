import { test, expect } from '@playwright/test';

const skipOnboarding = async (page: any) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('meal-prep:skipped-onboarding', 'true');
  });
};

test.describe('Prep Checklist', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/today');
    await page.getByText('Pripremi sastojke').click();
    await expect(page).toHaveURL(/\/day\/\d+\/checklist/);
  });

  test('should display prep checklist title', async ({ page }) => {
    await expect(page.getByText('Priprema za danas')).toBeVisible();
  });

  test('should show day name', async ({ page }) => {
    const dayNames = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];
    const text = await page.textContent('body');
    expect(dayNames.some(d => text?.includes(d))).toBe(true);
  });

  test('should show progress bar', async ({ page }) => {
    await expect(page.getByText('Napredak')).toBeVisible();
    // Should show 0/N initially
    const text = await page.textContent('body');
    expect(text).toMatch(/0\/\d+/);
  });

  test('should show meal group headers', async ({ page }) => {
    const possibleMeals = ['Doručak', 'Užina', 'Ručak', 'Večera'];
    const text = await page.textContent('body');
    expect(possibleMeals.some(m => text?.includes(m))).toBe(true);
  });

  test('should show ingredient checkboxes', async ({ page }) => {
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should update progress when checking items', async ({ page }) => {
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await firstCheckbox.check();

    // Wait for the progress to update
    await expect(page.locator('text=/1\\/\\d+/')).toBeVisible();
  });

  test('should show strikethrough on checked items', async ({ page }) => {
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await firstCheckbox.check();

    const strikethrough = page.locator('.line-through').first();
    await expect(strikethrough).toBeVisible();
  });

  test('should have back button', async ({ page }) => {
    await expect(page.getByText('Nazad')).toBeVisible();
  });

  test('should navigate back to daily view', async ({ page }) => {
    await page.getByText('Nazad').click();
    await expect(page).toHaveURL(/\/today/);
  });
});
