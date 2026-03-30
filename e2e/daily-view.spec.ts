import { test, expect } from '@playwright/test';

const skipOnboarding = async (page: any) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('meal-prep:skipped-onboarding', 'true');
    localStorage.setItem('meal-prep:ios-install-dismissed', 'true');
  });
  await page.goto('/today');
};

test.describe('Daily View', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test('should display the day navigator', async ({ page }) => {
    const dayNames = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];
    const dayText = await page.locator('h2').first().textContent();
    expect(dayNames.some(d => dayText?.includes(d))).toBe(true);
  });

  test('should display 5 meal cards', async ({ page }) => {
    const mealCards = page.locator('app-meal-card');
    await expect(mealCards).toHaveCount(5);
  });

  test('should show meal times on cards', async ({ page }) => {
    await expect(page.getByText('09:00')).toBeVisible();
    await expect(page.getByText('11:00')).toBeVisible();
    await expect(page.getByText('14:00')).toBeVisible();
    await expect(page.getByText('16:00')).toBeVisible();
    await expect(page.getByText('18:00')).toBeVisible();
  });

  test('should show meal type labels on cards', async ({ page }) => {
    const cards = page.locator('app-meal-card');
    await expect(cards).toHaveCount(5);
    await expect(cards.filter({ has: page.getByText('Doručak', { exact: true }) })).toBeVisible();
    await expect(cards.filter({ has: page.getByText('Užina', { exact: true }) })).toBeVisible();
    await expect(cards.filter({ has: page.getByText('Ručak', { exact: true }) })).toBeVisible();
    await expect(cards.filter({ has: page.getByText('Užina 2', { exact: true }) })).toBeVisible();
    await expect(cards.filter({ has: page.getByText('Večera', { exact: true }) })).toBeVisible();
  });

  test('should show "Pripremi sastojke" button', async ({ page }) => {
    await expect(page.getByText('Pripremi sastojke')).toBeVisible();
  });

  test('should navigate to next day', async ({ page }) => {
    const dayNames = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];
    const initialDay = await page.locator('h2').first().textContent();
    const initialIndex = dayNames.findIndex(d => initialDay?.includes(d));

    if (initialIndex < 6) {
      await page.getByRole('button', { name: 'Sledeći dan' }).click();
      await expect(page.locator('h2').first()).toContainText(dayNames[initialIndex + 1]);
    }
  });

  test('should navigate to previous day', async ({ page }) => {
    const dayNames = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];
    const initialDay = await page.locator('h2').first().textContent();
    const initialIndex = dayNames.findIndex(d => initialDay?.includes(d));

    if (initialIndex > 0) {
      await page.getByRole('button', { name: 'Prethodni dan' }).click();
      await expect(page.locator('h2').first()).toContainText(dayNames[initialIndex - 1]);
    }
  });

  test('should navigate to meal detail on card click', async ({ page }) => {
    await page.locator('app-meal-card').first().click();
    await expect(page).toHaveURL(/\/day\/\d+\/meal\//);
    await expect(page.getByText('Sastojci')).toBeVisible();
  });

  test('should navigate to prep checklist', async ({ page }) => {
    await page.getByText('Pripremi sastojke').click();
    await expect(page).toHaveURL(/\/day\/\d+\/checklist/);
    await expect(page.getByText('Priprema za danas')).toBeVisible();
  });

  test('should show bottom navigation', async ({ page }) => {
    const nav = page.locator('nav');
    await expect(nav.getByText('Danas')).toBeVisible();
    await expect(nav.getByText('Nedelja', { exact: true })).toBeVisible();
    await expect(nav.getByText('Kupovina')).toBeVisible();
    await expect(nav.getByText('Podešavanja')).toBeVisible();
  });

  test('should navigate to weekly view via bottom nav', async ({ page }) => {
    await page.getByRole('link', { name: 'Nedelja' }).click();
    await expect(page).toHaveURL(/\/week/);
  });

  test('should navigate to shopping list via bottom nav', async ({ page }) => {
    await page.getByRole('link', { name: 'Kupovina' }).click();
    await expect(page).toHaveURL(/\/shopping/);
  });

  test('should navigate to settings via bottom nav', async ({ page }) => {
    await page.getByRole('link', { name: 'Podešavanja' }).click();
    await expect(page).toHaveURL(/\/settings/);
  });
});
