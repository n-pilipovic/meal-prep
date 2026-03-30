import { test, expect } from '@playwright/test';

const skipOnboarding = async (page: any) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('meal-prep:skipped-onboarding', 'true');
    localStorage.setItem('meal-prep:ios-install-dismissed', 'true');
  });
};

test.describe('AI Plan Generator', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/editor');
    await page.getByRole('button', { name: 'AI Plan' }).click();
  });

  test('should display AI plan form title and description', async ({ page }) => {
    await expect(page.getByText('Generiši AI plan')).toBeVisible();
    await expect(page.getByText('Gemini AI kreira nedeljni plan ishrane po tvojim zahtevima.')).toBeVisible();
  });

  test('should show all age group options', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'BLW beba (6–12 mes.)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Malo dete (1–3 god.)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Predškolsko (4–6 god.)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Školsko (7–10 god.)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Odrasli (18+ god.)' })).toBeVisible();
  });

  test('should default to adult age group', async ({ page }) => {
    const adultBtn = page.getByRole('button', { name: 'Odrasli (18+ god.)' });
    await expect(adultBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('should switch age group and update calorie range', async ({ page }) => {
    // Default adult: 1200-3500, default 2000
    await expect(page.getByText('Kalorijski cilj: 2000 kcal')).toBeVisible();

    // Switch to toddler
    await page.getByRole('button', { name: 'Malo dete (1–3 god.)' }).click();
    await expect(page.getByRole('button', { name: 'Malo dete (1–3 god.)' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Odrasli (18+ god.)' })).toHaveAttribute('aria-pressed', 'false');

    // Calorie default should update to 1100
    await expect(page.getByText('Kalorijski cilj: 1100 kcal')).toBeVisible();
    // Range bounds should update
    await expect(page.getByText('900')).toBeVisible();
    await expect(page.getByText('1400')).toBeVisible();
  });

  test('should show dietary restriction toggles', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Vegetarijansko' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Vegansko' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bez glutena' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bez laktoze' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Visoko proteinsko' })).toBeVisible();
  });

  test('should toggle dietary restrictions on and off', async ({ page }) => {
    const veganBtn = page.getByRole('button', { name: 'Vegansko' });
    await expect(veganBtn).toHaveAttribute('aria-pressed', 'false');

    await veganBtn.click();
    await expect(veganBtn).toHaveAttribute('aria-pressed', 'true');

    await veganBtn.click();
    await expect(veganBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('should select multiple dietary restrictions', async ({ page }) => {
    await page.getByRole('button', { name: 'Bez glutena' }).click();
    await page.getByRole('button', { name: 'Bez laktoze' }).click();

    await expect(page.getByRole('button', { name: 'Bez glutena' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Bez laktoze' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Vegetarijansko' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('should add preferred ingredients via button click', async ({ page }) => {
    const input = page.getByPlaceholder('npr. piletina, brokoli...');
    await input.fill('piletina');
    await page.getByRole('button', { name: 'Dodaj poželjni sastojak' }).click();

    await expect(page.getByText('piletina')).toBeVisible();
    await expect(input).toHaveValue('');
  });

  test('should add preferred ingredients via Enter key', async ({ page }) => {
    const input = page.getByPlaceholder('npr. piletina, brokoli...');
    await input.fill('brokoli');
    await input.press('Enter');

    await expect(page.getByText('brokoli')).toBeVisible();
    await expect(input).toHaveValue('');
  });

  test('should remove preferred ingredient', async ({ page }) => {
    const input = page.getByPlaceholder('npr. piletina, brokoli...');
    await input.fill('piletina');
    await input.press('Enter');
    await expect(page.getByText('piletina')).toBeVisible();

    await page.getByRole('button', { name: 'Ukloni piletina' }).click();
    await expect(page.getByText('piletina')).not.toBeVisible();
  });

  test('should not add duplicate preferred ingredients', async ({ page }) => {
    const input = page.getByPlaceholder('npr. piletina, brokoli...');
    await input.fill('piletina');
    await input.press('Enter');
    await input.fill('piletina');
    await input.press('Enter');

    // Should only have one tag
    const tags = page.getByRole('button', { name: 'Ukloni piletina' });
    await expect(tags).toHaveCount(1);
  });

  test('should show common allergen buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Gluten', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kravlje mleko' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Jaja' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kikiriki' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Orašasti plodovi' })).toBeVisible();
  });

  test('should toggle allergen on and off', async ({ page }) => {
    const jajaBtn = page.getByRole('button', { name: 'Jaja' });
    await expect(jajaBtn).toHaveAttribute('aria-pressed', 'false');

    await jajaBtn.click();
    await expect(jajaBtn).toHaveAttribute('aria-pressed', 'true');

    await jajaBtn.click();
    await expect(jajaBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('should select multiple allergens', async ({ page }) => {
    await page.getByRole('button', { name: 'Jaja' }).click();
    await page.getByRole('button', { name: 'Kikiriki' }).click();

    await expect(page.getByRole('button', { name: 'Jaja' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Kikiriki' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Soja' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('should add and remove custom allergies', async ({ page }) => {
    const input = page.getByPlaceholder('npr. jagode, med...');
    await input.fill('jagode');
    await page.getByRole('button', { name: 'Dodaj alergiju' }).click();

    await expect(page.getByText('jagode')).toBeVisible();
    await expect(input).toHaveValue('');

    await page.getByRole('button', { name: 'Ukloni alergiju jagode' }).click();
    await expect(page.getByText('jagode')).not.toBeVisible();
  });

  test('should add and remove avoided ingredients', async ({ page }) => {
    const input = page.getByPlaceholder('npr. ljuto, gljive...');
    await input.fill('gljive');
    await page.getByRole('button', { name: 'Dodaj sastojak za izbegavanje' }).click();

    await expect(page.getByText('gljive')).toBeVisible();
    await expect(input).toHaveValue('');

    await page.getByRole('button', { name: 'Ukloni gljive' }).click();
    await expect(page.getByText('gljive')).not.toBeVisible();
  });

  test('should allow typing in the note textarea', async ({ page }) => {
    const textarea = page.getByPlaceholder('npr. više proteina, budžet prijateljski, brza priprema...');
    await textarea.fill('Brza priprema, jednostavni recepti');
    await expect(textarea).toHaveValue('Brza priprema, jednostavni recepti');
  });

  test('should show generate button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Generiši plan' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generiši plan' })).toBeEnabled();
  });

  test('should show loading state when generating', async ({ page }) => {
    // Intercept the API call and delay it
    await page.route('**/api/generate-plan', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({ status: 500, body: JSON.stringify({ error: 'Test' }) });
    });

    await page.getByRole('button', { name: 'Generiši plan' }).click();

    await expect(page.getByText('Generisanje...')).toBeVisible();
    await expect(page.getByRole('button', { name: /Generisanje/ })).toBeDisabled();
  });

  test('should show error on generation failure', async ({ page }) => {
    await page.route('**/api/generate-plan', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'AI servis nije dostupan' }),
      }),
    );

    await page.getByRole('button', { name: 'Generiši plan' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('AI servis nije dostupan')).toBeVisible();
  });

  test('should switch to BLW age group with correct calorie range', async ({ page }) => {
    await page.getByRole('button', { name: 'BLW beba (6–12 mes.)' }).click();
    await expect(page.getByText('Kalorijski cilj: 700 kcal')).toBeVisible();
    await expect(page.getByText('600')).toBeVisible();
    await expect(page.getByText('900')).toBeVisible();
  });

  test('should combine all form options', async ({ page }) => {
    // Select age group
    await page.getByRole('button', { name: 'Školsko (7–10 god.)' }).click();

    // Select restriction
    await page.getByRole('button', { name: 'Bez laktoze' }).click();

    // Add preferred
    const preferredInput = page.getByPlaceholder('npr. piletina, brokoli...');
    await preferredInput.fill('piletina');
    await preferredInput.press('Enter');

    // Add avoided
    const avoidInput = page.getByPlaceholder('npr. ljuto, gljive...');
    await avoidInput.fill('gljive');
    await avoidInput.press('Enter');

    // Add note
    await page.getByPlaceholder('npr. više proteina, budžet prijateljski, brza priprema...').fill('Jednostavni recepti');

    // Verify all selections are visible
    await expect(page.getByRole('button', { name: 'Školsko (7–10 god.)' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Bez laktoze' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('piletina')).toBeVisible();
    await expect(page.getByText('gljive')).toBeVisible();
    await expect(page.getByText('Kalorijski cilj: 1700 kcal')).toBeVisible();
  });
});
