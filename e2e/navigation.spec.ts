import { test, expect } from '@playwright/test';

const skipOnboarding = async (page: any) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('meal-prep:skipped-onboarding', 'true');
  });
};

test.describe('Navigation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test('should complete full navigation cycle via bottom nav', async ({ page }) => {
    await page.goto('/today');

    // Daily → Weekly
    await page.getByText('Nedelja').click();
    await expect(page).toHaveURL(/\/week/);

    // Weekly → Shopping
    await page.getByText('Kupovina').click();
    await expect(page).toHaveURL(/\/shopping/);

    // Shopping → Settings
    await page.getByText('Podešavanja').click();
    await expect(page).toHaveURL(/\/settings/);

    // Settings → Daily
    await page.getByText('Danas').click();
    await expect(page).toHaveURL(/\/today/);
  });

  test('should navigate from daily → meal detail → back → checklist → back', async ({ page }) => {
    await page.goto('/today');

    // Click first meal card
    await page.locator('app-meal-card').first().click();
    await expect(page).toHaveURL(/\/day\/\d+\/meal\//);

    // Back to daily
    await page.getByText('Nazad').click();
    await expect(page).toHaveURL(/\/today/);

    // Go to prep checklist
    await page.getByText('Pripremi sastojke').click();
    await expect(page).toHaveURL(/\/day\/\d+\/checklist/);

    // Back to daily
    await page.getByText('Nazad').click();
    await expect(page).toHaveURL(/\/today/);
  });

  test('should navigate settings → editor → back', async ({ page }) => {
    await page.goto('/settings');

    await page.getByText('Uredi plan').click();
    await expect(page).toHaveURL(/\/editor/);

    // Use browser back
    await page.goBack();
    await expect(page).toHaveURL(/\/settings/);
  });

  test('should redirect root to /today when onboarded', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/today/);
  });

  test('should handle direct URL access to all routes', async ({ page }) => {
    await page.goto('/today');
    await expect(page).toHaveURL(/\/today/);

    await page.goto('/week');
    await expect(page).toHaveURL(/\/week/);

    await page.goto('/shopping');
    await expect(page).toHaveURL(/\/shopping/);

    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);

    await page.goto('/editor');
    await expect(page).toHaveURL(/\/editor/);
  });
});
