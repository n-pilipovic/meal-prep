import { test, expect } from '@playwright/test';

const skipOnboarding = async (page: any) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('meal-prep:skipped-onboarding', 'true');
  });
};

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/settings');
  });

  test('should display settings title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Podešavanja' })).toBeVisible();
  });

  test('should show household section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Domaćinstvo' })).toBeVisible();
  });

  test('should show notifications section', async ({ page }) => {
    await expect(page.getByText('Obaveštenja')).toBeVisible();
  });

  test('should show editor link', async ({ page }) => {
    await expect(page.getByText('Uredi plan')).toBeVisible();
    await expect(page.getByText('Izmeni obroke, sastojke i recepte')).toBeVisible();
  });

  test('should navigate to editor', async ({ page }) => {
    await page.getByText('Uredi plan').click();
    await expect(page).toHaveURL(/\/editor/);
  });

  test('should show "not logged in" when in skip mode', async ({ page }) => {
    await expect(page.getByText('Niste prijavljeni')).toBeVisible();
  });

  test('should show bottom navigation', async ({ page }) => {
    await expect(page.getByText('Danas')).toBeVisible();
    await expect(page.getByText('Kupovina')).toBeVisible();
  });
});
