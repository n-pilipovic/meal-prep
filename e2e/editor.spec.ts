import { test, expect } from '@playwright/test';

const skipOnboarding = async (page: any) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('meal-prep:skipped-onboarding', 'true');
    localStorage.setItem('meal-prep:ios-install-dismissed', 'true');
  });
};

test.describe('Editor', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/editor');
  });

  test('should display editor title', async ({ page }) => {
    await expect(page.getByText('Uredi plan')).toBeVisible();
  });

  test('should show main tab buttons', async ({ page }) => {
    await expect(page.getByText('Obroci')).toBeVisible();
    await expect(page.getByText('Recepti')).toBeVisible();
    await expect(page.getByText('Uvoz')).toBeVisible();
  });

  test('should show save and export buttons', async ({ page }) => {
    await expect(page.getByText('Sačuvaj')).toBeVisible();
    await expect(page.getByText('Izvezi JSON')).toBeVisible();
  });

  test('should show day selector tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Pon' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Uto' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sre' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Čet' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pet' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sub' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ned' })).toBeVisible();
  });

  test('should show 5 meal forms on meals tab', async ({ page }) => {
    const mealForms = page.locator('app-meal-form');
    await expect(mealForms).toHaveCount(5);
  });

  test('should show meal type labels in forms', async ({ page }) => {
    await expect(page.getByText('Doručak · 09:00')).toBeVisible();
    await expect(page.getByText('Užina · 11:00')).toBeVisible();
    await expect(page.getByText('Ručak · 14:00')).toBeVisible();
    await expect(page.getByText('Užina 2 · 16:00')).toBeVisible();
    await expect(page.getByText('Večera · 18:00')).toBeVisible();
  });

  test('should switch between days', async ({ page }) => {
    await page.getByRole('button', { name: 'Uto' }).click();
    // Form should still show 5 meal forms
    const mealForms = page.locator('app-meal-form');
    await expect(mealForms).toHaveCount(5);
  });

  test('should edit meal name', async ({ page }) => {
    const nameInput = page.locator('app-meal-form').first().getByPlaceholder('Naziv obroka');
    await nameInput.clear();
    await nameInput.fill('Novi obrok');
    await expect(nameInput).toHaveValue('Novi obrok');
  });

  test('should add ingredient to meal', async ({ page }) => {
    const firstMealForm = page.locator('app-meal-form').first();
    await firstMealForm.waitFor();
    const initialIngredients = await firstMealForm.locator('app-ingredient-row').count();

    await firstMealForm.getByText('+ Dodaj sastojak').click();

    await expect(firstMealForm.locator('app-ingredient-row')).toHaveCount(initialIngredients + 1);
  });

  test('should switch to recipes tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Recepti' }).click();
    await expect(page.getByText('+ Dodaj recept')).toBeVisible();
  });

  test('should add a new recipe', async ({ page }) => {
    await page.getByRole('button', { name: 'Recepti' }).click();
    await page.getByText('+ Dodaj recept').waitFor();

    const initialRecipes = await page.locator('app-recipe-form').count();
    await page.getByText('+ Dodaj recept').click();

    await expect(page.locator('app-recipe-form')).toHaveCount(initialRecipes + 1);
  });

  test('should switch to import tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Uvoz' }).click();
    await expect(page.getByText('Uvezi iz .docx fajla')).toBeVisible();
    await expect(page.getByText('Uvezi iz JSON fajla')).toBeVisible();
  });

  test('should show file inputs on import tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Uvoz' }).click();
    const fileInputs = page.locator('input[type="file"]');
    await expect(fileInputs).toHaveCount(2);
  });

  test('should save plan', async ({ page }) => {
    await page.getByText('Sačuvaj').click();
    await expect(page.getByText('Plan sačuvan!')).toBeVisible();
  });
});
