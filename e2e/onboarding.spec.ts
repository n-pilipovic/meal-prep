import { test, expect } from '@playwright/test';

test.describe('Onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('meal-prep:ios-install-dismissed', 'true');
    });
    await page.goto('/');
  });

  test('should redirect to welcome screen on first visit', async ({ page }) => {
    await expect(page).toHaveURL(/\/welcome/);
  });

  test('should display the app title and auth options', async ({ page }) => {
    await expect(page.getByText('Priprema Obroka')).toBeVisible();
    await expect(page.getByText('Prijavi se sa Google nalogom')).toBeVisible();
    await expect(page.getByText('Prijavi se sa email-om')).toBeVisible();
    await expect(page.getByText('Nastavi bez naloga')).toBeVisible();
  });

  test('should navigate to email login form', async ({ page }) => {
    await page.getByText('Prijavi se sa email-om').click();
    await expect(page.getByPlaceholder('Email adresa')).toBeVisible();
    await expect(page.getByPlaceholder('Lozinka')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Prijavi se' })).toBeVisible();
  });

  test('should allow typing in login form fields', async ({ page }) => {
    await page.getByText('Prijavi se sa email-om').click();
    await page.getByPlaceholder('Email adresa').fill('test@example.com');
    await page.getByPlaceholder('Lozinka').fill('password123');
    await expect(page.getByPlaceholder('Email adresa')).toHaveValue('test@example.com');
    await expect(page.getByPlaceholder('Lozinka')).toHaveValue('password123');
  });

  test('should navigate to register form from login', async ({ page }) => {
    await page.getByText('Prijavi se sa email-om').click();
    await page.getByText('Nemaš nalog? Registruj se').click();
    await expect(page.getByPlaceholder('Tvoje ime')).toBeVisible();
    await expect(page.getByPlaceholder('Email adresa')).toBeVisible();
    await expect(page.getByPlaceholder('Lozinka (min. 6 karaktera)')).toBeVisible();
  });

  test('should go back from login form', async ({ page }) => {
    await page.getByText('Prijavi se sa email-om').click();
    await page.getByText('Nazad').click();
    await expect(page.getByText('Prijavi se sa Google nalogom')).toBeVisible();
  });

  test('should go back from register form', async ({ page }) => {
    await page.getByText('Prijavi se sa email-om').click();
    await page.getByText('Nemaš nalog? Registruj se').click();
    await page.getByText('Nazad').click();
    // Back on login form
    await expect(page.getByRole('button', { name: 'Prijavi se' })).toBeVisible();
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
