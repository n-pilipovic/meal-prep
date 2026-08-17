import { test, expect } from '@playwright/test';

const skipOnboarding = async (page: any) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('meal-prep:skipped-onboarding', 'true');
    localStorage.setItem('meal-prep:ios-install-dismissed', 'true');
  });
};

test.describe('Cook Plan', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/cook-plan');
    await expect(page.getByText('Plan kuvanja')).toBeVisible();
  });

  test('should display title and day picker', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Plan kuvanja' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Dani kada kuvam' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ned', exact: true })).toBeVisible();
  });

  test('should show default cook days selected (Sre + Ned)', async ({ page }) => {
    const sreda = page.getByRole('group', { name: 'Dani kada kuvam' }).getByRole('button', { name: 'Sre', exact: true });
    const nedelja = page.getByRole('group', { name: 'Dani kada kuvam' }).getByRole('button', { name: 'Ned', exact: true });
    await expect(sreda).toHaveAttribute('aria-pressed', 'true');
    await expect(nedelja).toHaveAttribute('aria-pressed', 'true');
  });

  test('should render cooking blocks with grouped ingredients', async ({ page }) => {
    await expect(page.getByText(/Kuvanje — /).first()).toBeVisible();
    await expect(page.getByText('Sastojci — grupisano').first()).toBeVisible();
  });

  test('should toggle a cook day and update blocks', async ({ page }) => {
    const pon = page.getByRole('group', { name: 'Dani kada kuvam' }).getByRole('button', { name: 'Pon', exact: true });
    await pon.click();
    await expect(pon).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Kuvanje — Ponedeljak')).toBeVisible();
  });

  test('should show empty state when all cook days are deselected', async ({ page }) => {
    const group = page.getByRole('group', { name: 'Dani kada kuvam' });
    await group.getByRole('button', { name: 'Sre', exact: true }).click();
    await group.getByRole('button', { name: 'Ned', exact: true }).click();
    await expect(page.getByText('Izaberi bar jedan dan kuvanja iznad.')).toBeVisible();
  });

  test('should check off a dish and update progress', async ({ page }) => {
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await firstCheckbox.check();
    await expect(page.locator('text=/1\\/\\d+/').first()).toBeVisible();
    await expect(page.locator('.line-through').first()).toBeVisible();
  });

  test('should be reachable from the weekly view', async ({ page }) => {
    await page.goto('/week');
    await page.getByText('🍳 Plan kuvanja').click();
    await expect(page).toHaveURL(/\/cook-plan/);
  });

  test('should have a working back button', async ({ page }) => {
    await page.goto('/week');
    await page.getByText('🍳 Plan kuvanja').click();
    await expect(page).toHaveURL(/\/cook-plan/);
    await page.getByRole('button', { name: 'Nazad' }).click();
    await expect(page).toHaveURL(/\/week/);
  });
});
