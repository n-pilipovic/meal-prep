import { test, expect } from '@playwright/test';

const skipOnboarding = async (page: any) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('meal-prep:skipped-onboarding', 'true');
    localStorage.setItem('meal-prep:ios-install-dismissed', 'true');
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
    await expect(page.getByRole('heading', { name: 'Obaveštenja' })).toBeVisible();
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

  test.describe('Meal times', () => {
    const lunchInput = (page: any) => page.getByLabel('Vreme — Ručak');

    test('should show a time input seeded from the plan for every meal type', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Vreme obroka' })).toBeVisible();

      for (const label of ['Doručak', 'Užina', 'Ručak', 'Užina 2', 'Večera']) {
        await expect(page.getByLabel(`Vreme — ${label}`, { exact: true })).toBeVisible();
      }
      // seed plan declares 14:00 for lunch
      await expect(lunchInput(page)).toHaveValue('14:00');
    });

    test('should apply an override to the meal card on the daily view', async ({ page }) => {
      await lunchInput(page).fill('12:15');
      await expect(lunchInput(page)).toHaveValue('12:15');

      await page.goto('/');
      await expect(page.getByText('12:15')).toBeVisible();
    });

    test('should keep the override after a reload', async ({ page }) => {
      await lunchInput(page).fill('12:15');
      await page.reload();
      await expect(lunchInput(page)).toHaveValue('12:15');
    });

    test('should restore the plan time via "Vrati sve na plan"', async ({ page }) => {
      await lunchInput(page).fill('12:15');
      await expect(page.getByText('Plan: 14:00')).toBeVisible();

      await page.getByRole('button', { name: 'Vrati sve na plan' }).click();

      await expect(lunchInput(page)).toHaveValue('14:00');
      await expect(page.getByRole('button', { name: 'Vrati sve na plan' })).toHaveCount(0);
    });
  });
});
