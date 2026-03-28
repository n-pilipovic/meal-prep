import { DocxImportService } from './docx-import.service';
import { MealType, IngredientCategory } from '../../core/models/meal.model';

describe('DocxImportService', () => {
  let service: DocxImportService;

  beforeEach(() => {
    service = new DocxImportService();
  });

  const SAMPLE_TEXT = `D 9 h

Pecenica 50 g , puter 10 g , hleb 70 g , grcki jogurt
Pecenica 50 g , puter 10 g , hleb 70 g , grcki jogurt
Pileca pasteta , hleb int 70 g , sveze povrce
Pasteta od mesa , hleb integrlani 70 g
Pogacice 7 kom + kiselo mleko 250 ml
Omlet od 2 jajeta na 30 g slanine , hleb 70 g
Pogacice 7 kom + kiselo mleko 250 ml

U 11 h

Jabuka 150 g + 20 g badema
Abc sir 40 g , integrlani hleb 30 g , masline 10 g
Coko mus banana 80 g , sir abc 20 g
Jabuka 150 g + orasi 15 g
Nar 200 g + lesnik 15 g
Jagode 200 g + orasi 20 g
Jabuka 150 g + bademi 20 g

R  14 gh

Bolonjeze spagete 80 g , junetina 100 g , pelat 100 g
Pasulj 150 g , hleb intgralni 50 g , salata kupus
Pasulj kuvan 150 g , hleb 50 g , salat zelena
Pileci batak 150 g , hleb integralni 60 g , brokoli
Skusa pecena 160 g , hleb 60 g
Svinjski file 150 g , int hleb 80 g
Pileci file 150 g , salata , feta 40 g , hleb 80 g

V 18h

Tunjevina 120 g , hleb 50 g , masline 20 g
Piletina sa senfom 130 g , hleb integralni 40 g
Taratur salata
Bareno jaje 2 kom , kiselo mleko 150 g , hleb int 40 g
Feta sir 70 g , ajvar 50 g , hleb int 60 g
Bela corba , hleb 70 g
Brusketi , hleb int 60 g , feta 70 g`;

  it('should parse text into 7 days', () => {
    const plan = service.parseText(SAMPLE_TEXT);
    expect(plan.days.length).toBe(7);
  });

  it('should assign 5 meals per day', () => {
    const plan = service.parseText(SAMPLE_TEXT);
    for (const day of plan.days) {
      expect(day.meals.length).toBe(5);
      const types = day.meals.map(m => m.type);
      expect(types).toContain(MealType.Breakfast);
      expect(types).toContain(MealType.Snack);
      expect(types).toContain(MealType.Lunch);
      expect(types).toContain(MealType.AfternoonSnack);
      expect(types).toContain(MealType.Dinner);
    }
  });

  it('should extract meal names', () => {
    const plan = service.parseText(SAMPLE_TEXT);
    const monday = plan.days[0];
    const breakfast = monday.meals.find(m => m.type === MealType.Breakfast)!;
    expect(breakfast.name.length).toBeGreaterThan(0);
  });

  it('should parse ingredients with quantities', () => {
    const plan = service.parseText(SAMPLE_TEXT);
    const monday = plan.days[0];
    const breakfast = monday.meals.find(m => m.type === MealType.Breakfast)!;
    expect(breakfast.ingredients.length).toBeGreaterThan(0);

    const hleb = breakfast.ingredients.find(i => i.name.toLowerCase().includes('hleb'));
    expect(hleb).toBeTruthy();
    expect(hleb!.quantity).toBe(70);
    expect(hleb!.unit).toBe('g');
  });

  it('should guess ingredient categories', () => {
    const ingredients = service.parseIngredients('hleb 70 g , puter 10 g , jabuka 150 g');
    const hleb = ingredients.find(i => i.name.toLowerCase().includes('hleb'));
    const puter = ingredients.find(i => i.name.toLowerCase().includes('puter'));
    const jabuka = ingredients.find(i => i.name.toLowerCase().includes('jabuka'));

    expect(hleb?.category).toBe(IngredientCategory.Grain);
    expect(puter?.category).toBe(IngredientCategory.Dairy);
    expect(jabuka?.category).toBe(IngredientCategory.Produce);
  });

  it('should set week label with date', () => {
    const plan = service.parseText(SAMPLE_TEXT);
    expect(plan.weekLabel).toContain('Uvoz');
  });

  it('should handle empty text gracefully', () => {
    const plan = service.parseText('');
    expect(plan.days.length).toBe(7);
    // All meals should be empty
    for (const day of plan.days) {
      for (const meal of day.meals) {
        expect(meal.name).toBe('');
      }
    }
  });

  it('should set correct day names', () => {
    const plan = service.parseText(SAMPLE_TEXT);
    expect(plan.days[0].dayName).toBe('Ponedeljak');
    expect(plan.days[6].dayName).toBe('Nedelja');
  });
});
