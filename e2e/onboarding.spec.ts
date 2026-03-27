import { test, expect } from '@playwright/test';

test.describe('Onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
  });

  test('should redirect to welcome screen on first visit', async ({ page }) => {
    await expect(page).toHaveURL(/\/welcome/);
  });

  test('should display the app title and options', async ({ page }) => {
    await expect(page.getByText('Priprema Obroka')).toBeVisible();
    await expect(page.getByText('Kreiraj domaćinstvo')).toBeVisible();
    await expect(page.getByText('Pridruži se')).toBeVisible();
    await expect(page.getByText('Nastavi bez naloga')).toBeVisible();
  });

  test('should navigate to create household form', async ({ page }) => {
    await page.getByText('Kreiraj domaćinstvo').click();
    await expect(page.getByPlaceholder('Tvoje ime')).toBeVisible();
    await expect(page.getByText('Kreiraj', { exact: true })).toBeVisible();
  });

  test('should show name input focused and ready for typing', async ({ page }) => {
    await page.getByText('Kreiraj domaćinstvo').click();
    const nameInput = page.getByPlaceholder('Tvoje ime');
    await nameInput.fill('Novica');
    await expect(nameInput).toHaveValue('Novica');
  });

  test('should navigate to join household form', async ({ page }) => {
    await page.getByText('Pridruži se', { exact: true }).click();
    await expect(page.getByPlaceholder('Kod domaćinstva')).toBeVisible();
    await expect(page.getByPlaceholder('Tvoje ime')).toBeVisible();
  });

  test('should allow typing in join form fields', async ({ page }) => {
    await page.getByText('Pridruži se', { exact: true }).click();
    await page.getByPlaceholder('Kod domaćinstva').fill('ABC123');
    await page.getByPlaceholder('Tvoje ime').fill('Ivana');
    await expect(page.getByPlaceholder('Kod domaćinstva')).toHaveValue('ABC123');
    await expect(page.getByPlaceholder('Tvoje ime')).toHaveValue('Ivana');
  });

  test('should go back from create form', async ({ page }) => {
    await page.getByText('Kreiraj domaćinstvo').click();
    await page.getByText('Nazad').click();
    await expect(page.getByText('Kreiraj domaćinstvo')).toBeVisible();
  });

  test('should go back from join form', async ({ page }) => {
    await page.getByRole('button', { name: 'Pridruži se' }).click();
    await page.getByText('Nazad').click();
    // Back on choice screen — check the button that only exists in choice mode
    await expect(page.getByRole('button', { name: 'Kreiraj domaćinstvo' })).toBeVisible();
  });

  test('should skip onboarding and go to daily view', async ({ page }) => {
    await page.getByText('Nastavi bez naloga').click();
    await expect(page).toHaveURL(/\/today/);
  });

  test('should persist skip and not redirect on next visit', async ({ page }) => {
    await page.getByText('Nastavi bez naloga').click();
    await expect(page).toHaveURL(/\/today/);

    await page.reload();
    await expect(page).toHaveURL(/\/today/);
  });

  test('should not show bottom nav on welcome screen', async ({ page }) => {
    await expect(page.getByText('Danas')).not.toBeVisible();
    await expect(page.getByText('Kupovina')).not.toBeVisible();
  });

  test('should guard protected routes when not onboarded', async ({ page }) => {
    await page.goto('/shopping');
    await expect(page).toHaveURL(/\/welcome/);
  });
});
