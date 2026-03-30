import { test, expect } from '@playwright/test';

const skipOnboarding = async (page: any) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('meal-prep:skipped-onboarding', 'true');
    localStorage.setItem('meal-prep:ios-install-dismissed', 'true');
  });
};

test.describe('Weekly View', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/week');
  });

  test('should display weekly view title', async ({ page }) => {
    await expect(page.getByText('Nedeljni plan')).toBeVisible();
  });

  test('should show all 7 day names', async ({ page }) => {
    const dayNames = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];
    for (const name of dayNames) {
      await expect(page.getByText(name, { exact: false }).first()).toBeVisible();
    }
  });

  test('should highlight current day', async ({ page }) => {
    // Wait for day cards to render
    await page.getByText('Ponedeljak').first().waitFor();
    // Current day card should have ring-2 styling
    const highlightedCard = page.locator('.ring-2');
    await expect(highlightedCard).toHaveCount(1);
  });

  test('should navigate to daily view on day click', async ({ page }) => {
    // Click the first day card
    await page.getByText('Ponedeljak').first().click();
    await expect(page).toHaveURL(/\/day\/0|\/today/);
  });

  test('should show bottom navigation', async ({ page }) => {
    await expect(page.getByText('Danas')).toBeVisible();
    await expect(page.getByText('Kupovina')).toBeVisible();
  });
});
