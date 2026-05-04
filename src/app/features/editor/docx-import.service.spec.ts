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

  describe('parseOdtXml', () => {
    const cell = (text: string) =>
      `<table:table-cell><text:p>${text}</text:p></table:table-cell>`;
    const row = (label: string, days: string[]) =>
      `<table:table-row>${cell(label)}${days.map(cell).join('')}</table:table-row>`;

    const buildOdt = (rows: string[], extra: string = '') => `<?xml version="1.0"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
  <office:body>
    <office:text>
      <table:table>${rows.join('')}</table:table>
      ${extra}
    </office:text>
  </office:body>
</office:document-content>`;

    const SAMPLE_ROWS = [
      row('D', [
        'Pileca pasteta - belo meso 120 g , susam 20 g , pavlaka 50 g , hleb 70 g',
        'Pasteta od mesa , hleb 70 g , povrce',
        'Pecenica 50 g , puter 10 g , hleb 70 g',
        'Ovsena pita 1/3 + jogurt 150 g',
        'Ovsena pita 1/3 + jogurt 150 g',
        'Pogacice 6 kom + jogurt 1 casa',
        'Omlet od 2 jajeta na 30 g slanine , hleb 70 g',
      ]),
      row('U', [
        'Jabuka 120 g + 10 kom badema',
        '150 g jagoda + 15 g lesnika',
        '15 badema + borovnice 100 g',
        '4 polovine oraha + maline 150 g',
        'Jabuka 120 g + 10 kom badema',
        '150 g jagoda + 15 g lesnika',
        '15 badema + borovnice 100 g',
      ]),
      row('R', [
        'Becar sataras + pileci file 150 g , hleb 3 kom',
        'Becar sataras + jaje, hleb 3 kom',
        'Riba pecena 180 g , krompir 200 g , blitva 250 g',
        'Piletina sa senfom 150 g , hleb 3 kom',
        'Kupus sa junetinom , hleb 3 kom',
        'Kupus sa junetinom , hleb 3 kom',
        'Curetina 150 g , hleb 3 kom',
      ]),
      row('U', [
        'Uzina kao I prva samo kombinovati iz razl dana',
        '', '', '', '', '', '',
      ]),
      row('V', [
        'Salata kapri , belo meso 120 g , hleb 2 kom',
        'Tunjevina 120 g , hleb 2 kom',
        'Taratur salata , jaje 2 kom , hleb int 2 kom',
        'Salata kapri , belo meso 120 g , hleb 2 kom',
        'Pecenica 50 g , hleb 2 kom , kiselo mleko 150 g',
        'Taratur salata , jaje 2 kom , hleb int 2 kom',
        'Tunjevina 120 g , hleb 2 kom , brokoli',
      ]),
    ];

    it('parses 7 days with all 5 meal types from ODT table', () => {
      const plan = service.parseOdtXml(buildOdt(SAMPLE_ROWS));
      expect(plan.days.length).toBe(7);
      for (const day of plan.days) {
        expect(day.meals.length).toBe(5);
        const named = day.meals.filter(m => m.name.length > 0);
        // Every day should have at least breakfast/snack/lunch/snack2/dinner filled.
        expect(named.length).toBe(5);
      }
    });

    it('broadcasts the snack-2 row across all 7 days', () => {
      const plan = service.parseOdtXml(buildOdt(SAMPLE_ROWS));
      const snack2Texts = plan.days.map(
        d => d.meals.find(m => m.type === MealType.AfternoonSnack)!.description,
      );
      const expected = 'Uzina kao I prva samo kombinovati iz razl dana';
      for (const t of snack2Texts) {
        expect(t).toBe(expected);
      }
    });

    it('parses ingredients from ODT cell text', () => {
      const plan = service.parseOdtXml(buildOdt(SAMPLE_ROWS));
      const monday = plan.days[0];
      const breakfast = monday.meals.find(m => m.type === MealType.Breakfast)!;
      const hleb = breakfast.ingredients.find(i => i.name.toLowerCase().includes('hleb'));
      expect(hleb?.quantity).toBe(70);
      expect(hleb?.unit).toBe('g');
    });

    it('uses correct day names from ODT table', () => {
      const plan = service.parseOdtXml(buildOdt(SAMPLE_ROWS));
      expect(plan.days[0].dayName).toBe('Ponedeljak');
      expect(plan.days[6].dayName).toBe('Nedelja');
    });

    it('extracts recipes from paragraphs after the ODT table', () => {
      const extra = `
        <text:p>Becarac mera za dva dana</text:p>
        <text:list><text:list-item><text:p>500 g paprike</text:p></text:list-item><text:list-item><text:p>500 g paradajza</text:p></text:list-item></text:list>
        <text:p>Uputstvo za pripremu</text:p>
        <text:list><text:list-item><text:p>Na ulju dinstajte luk oko 10 minuta. Dodajte papriku.</text:p></text:list-item></text:list>
        <text:p>Ovsena pita</text:p>
        <text:p>2 jajeta</text:p>
        <text:p>15 kasika ovsenih pahuljica</text:p>
        <text:p>Umutiti jaja, dodati mekinje. Peci na 220 stepeni pola sata.</text:p>
      `;
      const plan = service.parseOdtXml(buildOdt(SAMPLE_ROWS, extra));
      const names = plan.recipes.map(r => r.name);
      expect(names).toContain('Bećar šataraš');
      expect(names).toContain('Ovsena pita');
      const becarac = plan.recipes.find(r => r.name === 'Bećar šataraš')!;
      expect(becarac.ingredients.length).toBeGreaterThan(0);
      expect(becarac.instructions.length).toBeGreaterThan(0);
    });

    it('handles missing table gracefully', () => {
      const plan = service.parseOdtXml(buildOdt([]));
      expect(plan.days.length).toBe(7);
      for (const day of plan.days) {
        for (const meal of day.meals) {
          expect(meal.name).toBe('');
        }
      }
    });
  });
});
