import { test, expect } from '@playwright/test';

const skipOnboarding = async (page: any) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('meal-prep:skipped-onboarding', 'true');
    localStorage.setItem('meal-prep:ios-install-dismissed', 'true');
  });
};

test.describe('Feedback (Povratna informacija)', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test('Settings shows the feedback entry card', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Povratna informacija' })).toBeVisible();
    await expect(page.getByText('Greška, predlog ili pitanje')).toBeVisible();
  });

  test('Settings shows the my-issues entry card', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Moje prijave' })).toBeVisible();
  });

  test('feedback form renders with bug-tailored prompts by default', async ({ page }) => {
    await page.goto('/report-issue');
    await expect(page.getByRole('heading', { name: 'Povratna informacija' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Greška', exact: true })).toBeVisible();
    await expect(page.getByText('Kratko opiši grešku')).toBeVisible();
  });

  test('switching type to Predlog updates the prompts', async ({ page }) => {
    await page.goto('/report-issue');
    await page.getByRole('button', { name: 'Predlog', exact: true }).click();
    await expect(page.getByText('Šta želiš da dodamo?')).toBeVisible();
    await expect(page.getByText('Kako bi to izgledalo?')).toBeVisible();
  });

  test('submit button is disabled until title and description are filled', async ({ page }) => {
    await page.goto('/report-issue');
    const submit = page.getByRole('button', { name: 'Pošalji' });
    await expect(submit).toBeDisabled();
    await page.getByPlaceholder('Naslov').fill('Test');
    await expect(submit).toBeDisabled();
    await page.locator('textarea').fill('Description here');
    await expect(submit).toBeEnabled();
  });

  test('my-issues page renders tabs and empty state', async ({ page }) => {
    await page.route('**/api/me/issues', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/household/*/suggestions', (route) => route.fulfill({ json: [] }));
    await page.goto('/my-issues');
    await expect(page.getByRole('heading', { name: 'Prijave' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Moje prijave' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Predlozi domaćinstva' })).toBeVisible();
  });
});
