import { test, expect } from '@playwright/test';

const skipOnboarding = async (page: any) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('meal-prep:skipped-onboarding', 'true');
  });
};

test.describe('Meal Detail', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/today');
    await page.locator('app-meal-card').first().click();
    await expect(page).toHaveURL(/\/day\/\d+\/meal\//);
  });

  test('should show meal name', async ({ page }) => {
    // The h1 or prominent text should have the meal name
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    const text = await heading.textContent();
    expect(text!.length).toBeGreaterThan(0);
  });

  test('should show ingredients section', async ({ page }) => {
    await expect(page.getByText('Sastojci')).toBeVisible();
  });

  test('should show ingredient checkboxes', async ({ page }) => {
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should toggle ingredient checkbox', async ({ page }) => {
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await firstCheckbox.check();
    await expect(firstCheckbox).toBeChecked();
    await firstCheckbox.uncheck();
    await expect(firstCheckbox).not.toBeChecked();
  });

  test('should have a back button', async ({ page }) => {
    const backBtn = page.getByText('Nazad');
    await expect(backBtn).toBeVisible();
  });

  test('should navigate back to daily view', async ({ page }) => {
    await page.getByText('Nazad').click();
    await expect(page).toHaveURL(/\/today/);
  });

  test('should show time badge', async ({ page }) => {
    const times = ['09:00', '11:00', '14:00', '18:00'];
    const pageText = await page.textContent('body');
    expect(times.some(t => pageText?.includes(t))).toBe(true);
  });
});
