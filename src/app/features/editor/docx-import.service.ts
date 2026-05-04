import { Injectable } from '@angular/core';
import { WeeklyPlan, DayPlan, Meal, MealType, Ingredient, IngredientCategory, MEAL_TIMES, DAY_NAMES, Recipe } from '../../core/models/meal.model';

const ODT_TABLE_NS = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0';
const ODT_TEXT_NS = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
const ODT_OFFICE_NS = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';

/**
 * Parses meal plan files (.docx and .odt) into WeeklyPlan objects.
 *
 * .docx format (Ivana.docx):
 * - Sections starting with "D 9 h" (breakfast), "U 11 h" (snack), "R 14 gh" (lunch), "V 18h" (dinner)
 * - Each section has 7 items (one per day, Mon-Sun)
 *
 * .odt format (Ivana Krsmanovic 2.odt):
 * - Single 5-row table with first column = meal-type letter and 7 columns for Mon-Sun
 * - Rows: D, U (snack), R, U (snack 2 — same for all days), V
 * - Recipes follow as paragraphs after the table
 */
@Injectable({ providedIn: 'root' })
export class DocxImportService {
  async parseDocx(file: File): Promise<WeeklyPlan> {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return this.parseText(result.value);
  }

  async parseOdt(file: File): Promise<WeeklyPlan> {
    const JSZip = (await import('jszip')).default;
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const contentXml = await zip.file('content.xml')?.async('string');
    if (!contentXml) {
      throw new Error('content.xml not found in .odt file');
    }
    return this.parseOdtXml(contentXml);
  }

  /** Auto-detects format from filename extension. */
  async parseFile(file: File): Promise<WeeklyPlan> {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.odt')) return this.parseOdt(file);
    return this.parseDocx(file);
  }

  parseOdtXml(xml: string): WeeklyPlan {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      throw new Error('Invalid ODT XML: ' + parserError.textContent);
    }

    const days: DayPlan[] = Array.from({ length: 7 }, (_, i) => ({
      dayIndex: i,
      dayName: DAY_NAMES[i],
      meals: [
        this.createEmptyMeal(MealType.Breakfast),
        this.createEmptyMeal(MealType.Snack),
        this.createEmptyMeal(MealType.Lunch),
        this.createEmptyMeal(MealType.AfternoonSnack),
        this.createEmptyMeal(MealType.Dinner),
      ],
    }));

    const table = doc.getElementsByTagNameNS(ODT_TABLE_NS, 'table')[0];
    if (table) {
      this.fillDaysFromOdtTable(table, days);
    }

    const recipes = this.parseOdtRecipes(doc);

    return {
      weekLabel: `Uvoz ${new Date().toLocaleDateString('sr-Latn')}`,
      days,
      recipes,
    };
  }

  private fillDaysFromOdtTable(table: Element, days: DayPlan[]): void {
    // Row index → meal type. Row 3 = Užina 2 (afternoon snack), same content for all days.
    const rowToMealType: Record<number, MealType> = {
      0: MealType.Breakfast,
      1: MealType.Snack,
      2: MealType.Lunch,
      3: MealType.AfternoonSnack,
      4: MealType.Dinner,
    };

    const rows = Array.from(table.getElementsByTagNameNS(ODT_TABLE_NS, 'table-row'));

    rows.forEach((row, rowIndex) => {
      const mealType = rowToMealType[rowIndex];
      if (mealType === undefined) return;

      const cells = Array.from(row.getElementsByTagNameNS(ODT_TABLE_NS, 'table-cell'));
      // First cell is the meal-type label (D, U, R, U, V); skip it.
      const dayCells = cells.slice(1, 8).map(c => this.cellText(c));

      // Snack 2: only the first non-empty cell is provided; reuse for all 7 days.
      const isAfternoonSnack = mealType === MealType.AfternoonSnack;
      const broadcastValue = isAfternoonSnack ? dayCells.find(t => t.length > 0) ?? '' : null;

      for (let i = 0; i < 7; i++) {
        const raw = isAfternoonSnack ? broadcastValue! : (dayCells[i] ?? '');
        if (!raw) continue;
        const meal = days[i].meals.find(m => m.type === mealType);
        if (!meal) continue;
        meal.name = this.extractMealName(raw);
        meal.description = raw;
        meal.ingredients = this.parseIngredients(raw);
      }
    });
  }

  private cellText(cell: Element): string {
    const paragraphs = Array.from(cell.getElementsByTagNameNS(ODT_TEXT_NS, 'p'))
      .map(p => (p.textContent ?? '').trim())
      .filter(t => t.length > 0);
    return paragraphs.join(' | ');
  }

  private parseOdtRecipes(doc: Document): Recipe[] {
    const body = doc.getElementsByTagNameNS(ODT_OFFICE_NS, 'text')[0];
    if (!body) return [];

    // Collect text-blocks that follow the table.
    const blocks: string[] = [];
    let pastTable = false;
    for (const child of Array.from(body.childNodes)) {
      if (child.nodeType !== 1 /* ELEMENT_NODE */) continue;
      const el = child as Element;
      if (el.namespaceURI === ODT_TABLE_NS && el.localName === 'table') {
        pastTable = true;
        continue;
      }
      if (!pastTable) continue;
      // <text:p> direct, or <text:list> containing <text:list-item><text:p>
      if (el.namespaceURI === ODT_TEXT_NS && el.localName === 'p') {
        const t = (el.textContent ?? '').trim();
        if (t) blocks.push(t);
      } else if (el.namespaceURI === ODT_TEXT_NS && el.localName === 'list') {
        for (const p of Array.from(el.getElementsByTagNameNS(ODT_TEXT_NS, 'p'))) {
          const t = (p.textContent ?? '').trim();
          if (t) blocks.push(t);
        }
      }
    }

    return this.buildRecipesFromBlocks(blocks);
  }

  private buildRecipesFromBlocks(blocks: string[]): Recipe[] {
    // Recognized recipe titles (lowercased substring → display name + id).
    const titles: { match: RegExp; name: string; id: string; servings: string }[] = [
      { match: /be[cć]ar/i, name: 'Bećar šataraš', id: 'imported-becarac', servings: 'mera za 2 dana' },
      { match: /pogacic|pogačic/i, name: 'Pogačice', id: 'imported-pogacice', servings: '35 komada' },
      { match: /ovsena pita/i, name: 'Ovsena pita', id: 'imported-ovsena-pita', servings: '1 plitka tepsija' },
    ];

    // Find indices where a recipe title appears.
    const titleIndices: { index: number; def: typeof titles[number] }[] = [];
    blocks.forEach((b, i) => {
      const def = titles.find(t => t.match.test(b));
      if (def && !titleIndices.some(t => t.def === def)) {
        titleIndices.push({ index: i, def });
      }
    });

    if (titleIndices.length === 0) return [];

    const recipes: Recipe[] = [];
    for (let i = 0; i < titleIndices.length; i++) {
      const start = titleIndices[i].index + 1; // skip the title line itself
      const end = i + 1 < titleIndices.length ? titleIndices[i + 1].index : blocks.length;
      const block = blocks.slice(start, end).filter(b => !/^sastojci$/i.test(b));
      const { ingredients, instructions } = this.splitRecipeBlock(block);
      const def = titleIndices[i].def;
      recipes.push({
        id: def.id,
        name: def.name,
        servings: def.servings,
        ingredients,
        instructions,
      });
    }
    return recipes;
  }

  private splitRecipeBlock(blocks: string[]): { ingredients: Ingredient[]; instructions: string[] } {
    const headerIdx = blocks.findIndex(b => /uputstvo za pripremu/i.test(b));
    const ingredientLines: string[] = [];
    const instructionLines: string[] = [];

    if (headerIdx >= 0) {
      ingredientLines.push(...blocks.slice(0, headerIdx));
      instructionLines.push(...blocks.slice(headerIdx + 1));
    } else {
      // No explicit header: short qty-like lines = ingredients, long lines = instructions.
      for (const b of blocks) {
        const looksLikeIngredient =
          /^\d/.test(b) || /\b\d+\s*(g|ml|kom|kasik|kasicic)\b/i.test(b) || b.length < 35;
        if (looksLikeIngredient) ingredientLines.push(b);
        else instructionLines.push(b);
      }
    }

    const ingredients: Ingredient[] = [];
    for (const line of ingredientLines) {
      ingredients.push(...this.parseIngredients(line));
    }

    const instructions = instructionLines
      .flatMap(line => line.split(/(?<=[.!])\s+/))
      .map(s => s.trim())
      .filter(s => s.length > 10);

    return { ingredients, instructions };
  }

  parseText(text: string): WeeklyPlan {
    const lines = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const sections = this.splitIntoSections(lines);

    const days: DayPlan[] = Array.from({ length: 7 }, (_, i) => ({
      dayIndex: i,
      dayName: DAY_NAMES[i],
      meals: [
        this.createEmptyMeal(MealType.Breakfast),
        this.createEmptyMeal(MealType.Snack),
        this.createEmptyMeal(MealType.Lunch),
        this.createEmptyMeal(MealType.AfternoonSnack),
        this.createEmptyMeal(MealType.Dinner),
      ],
    }));

    // Parse each section's items into meals
    if (sections.breakfast.length > 0) {
      this.assignMeals(days, MealType.Breakfast, sections.breakfast);
    }
    if (sections.snack.length > 0) {
      this.assignMeals(days, MealType.Snack, sections.snack);
    }
    if (sections.lunch.length > 0) {
      this.assignMeals(days, MealType.Lunch, sections.lunch);
    }
    if (sections.afternoonSnack.length > 0) {
      this.assignMeals(days, MealType.AfternoonSnack, sections.afternoonSnack);
    }
    if (sections.dinner.length > 0) {
      this.assignMeals(days, MealType.Dinner, sections.dinner);
    }

    const recipes = this.parseRecipes(sections.extra);

    return {
      weekLabel: `Uvoz ${new Date().toLocaleDateString('sr-Latn')}`,
      days,
      recipes,
    };
  }

  private splitIntoSections(lines: string[]): {
    breakfast: string[];
    snack: string[];
    lunch: string[];
    afternoonSnack: string[];
    dinner: string[];
    extra: string[];
  } {
    const result = {
      breakfast: [] as string[],
      snack: [] as string[],
      lunch: [] as string[],
      afternoonSnack: [] as string[],
      dinner: [] as string[],
      extra: [] as string[],
    };

    let current: keyof typeof result = 'extra';

    for (const line of lines) {
      const lower = line.toLowerCase();

      if (this.isSectionHeader(lower, 'd', '9')) {
        current = 'breakfast';
        continue;
      } else if (this.isSectionHeader(lower, 'u', '11')) {
        current = 'snack';
        continue;
      } else if (this.isSectionHeader(lower, 'r', '14')) {
        current = 'lunch';
        continue;
      } else if (this.isSectionHeader(lower, 'u', '16') || this.isAfternoonSnackHeader(lower)) {
        current = 'afternoonSnack';
        continue;
      } else if (this.isSectionHeader(lower, 'v', '18')) {
        current = 'dinner';
        continue;
      } else if (lower.includes('alternativa') || lower.includes('pogacic')) {
        current = 'extra';
      }

      result[current].push(line);
    }

    return result;
  }

  private isAfternoonSnackHeader(line: string): boolean {
    const stripped = line.replace(/\s+/g, '');
    return stripped.startsWith('u16') || stripped.startsWith('u2') || stripped.includes('uzina2');
  }

  private isSectionHeader(line: string, letter: string, hour: string): boolean {
    const stripped = line.replace(/\s+/g, '');
    return (
      stripped.startsWith(`${letter}${hour}h`) ||
      stripped.startsWith(`${letter}${hour}`) && stripped.includes('h') && stripped.length < 10
    );
  }

  private assignMeals(days: DayPlan[], mealType: MealType, items: string[]): void {
    // Filter out very short lines (likely noise) and combine multi-line items
    const consolidated = this.consolidateItems(items);

    for (let i = 0; i < Math.min(consolidated.length, 7); i++) {
      const raw = consolidated[i];
      const meal = days[i].meals.find(m => m.type === mealType);
      if (!meal) continue;

      meal.name = this.extractMealName(raw);
      meal.description = raw;
      meal.ingredients = this.parseIngredients(raw);
    }
  }

  private consolidateItems(items: string[]): string[] {
    const result: string[] = [];
    let current = '';

    for (const item of items) {
      // Check if this looks like a new meal item (has quantities or common food words)
      const hasQuantity = /\d+\s*g\b/i.test(item);
      const isShort = item.length < 15;
      const isAlternative = item.toLowerCase().startsWith('ili ') || item.toLowerCase().startsWith('or ');

      if (isAlternative && current) {
        // "Ili" alternatives: append to previous
        current += ' / ' + item;
      } else if (hasQuantity || (!isShort && current.length === 0)) {
        if (current) result.push(current);
        current = item;
      } else if (current) {
        current += ' , ' + item;
      } else {
        current = item;
      }
    }
    if (current) result.push(current);

    return result;
  }

  private extractMealName(raw: string): string {
    // Take the first meaningful part before quantities
    const parts = raw.split(/[,.]/).map(p => p.trim());
    const first = parts[0] ?? raw;

    // Remove quantity info
    const name = first
      .replace(/\d+\s*g\b/gi, '')
      .replace(/\d+\s*ml\b/gi, '')
      .replace(/\d+\s*kom\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return name.length > 50 ? name.substring(0, 50) + '…' : name;
  }

  parseIngredients(text: string): Ingredient[] {
    const ingredients: Ingredient[] = [];
    // Split by comma, plus sign, or period followed by space
    const parts = text.split(/[,+]|(?:\.\s)/);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed || trimmed.length < 2) continue;

      const ingredient = this.parseOneIngredient(trimmed);
      if (ingredient) {
        ingredients.push(ingredient);
      }
    }

    return ingredients;
  }

  private parseOneIngredient(text: string): Ingredient | null {
    // Try to match patterns like "hleb 70 g", "100 g mesa", "2 jajeta", "250 ml mleka"
    const qtyMatch = text.match(/(\d+(?:[.,]\s?\d+)?)\s*(g|ml|kom|kasicic[ae]?|kasik[ae]?)\b/i);

    let name: string;
    let quantity: number | null = null;
    let unit = '';

    if (qtyMatch) {
      quantity = parseFloat(qtyMatch[1].replace(',', '.'));
      unit = this.normalizeUnit(qtyMatch[2]);
      // Remove the matched quantity from text to get the name
      name = text.replace(qtyMatch[0], '').trim();
    } else {
      name = text;
    }

    // Clean up name
    name = name
      .replace(/^\s*[-–]\s*/, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^(npr|za|ili|od|po|sa|na|uz|u|i)\s+/i, '')
      .trim();

    if (!name || name.length < 2) return null;

    // Capitalize first letter
    name = name.charAt(0).toUpperCase() + name.slice(1);

    return {
      name,
      quantity,
      unit,
      category: this.guessCategory(name.toLowerCase()),
    };
  }

  private normalizeUnit(raw: string): string {
    const lower = raw.toLowerCase();
    if (lower === 'g') return 'g';
    if (lower === 'ml') return 'ml';
    if (lower === 'kom') return 'kom';
    if (lower.startsWith('kasicic')) return 'kašičica';
    if (lower.startsWith('kasik')) return 'kašika';
    return lower;
  }

  private guessCategory(name: string): IngredientCategory {
    const meat = ['meso', 'pilet', 'junet', 'svinj', 'ćurec', 'curet', 'curec', 'slanin', 'pecenic', 'tunjev', 'skuš', 'skus', 'batak'];
    const dairy = ['sir', 'jogurt', 'mleko', 'pavlak', 'feta', 'puter', 'jaje', 'jajeta', 'abc'];
    const produce = ['jabuk', 'jagod', 'banan', 'malin', 'kupin', 'nar ', 'paradajz', 'krastavac', 'rotkvic', 'kupus', 'brokoli', 'karfiol', 'paprik', 'tikvic', 'pecurk', 'luk', 'salat', 'povrce', 'povrć'];
    const grain = ['hleb', 'brasn', 'brašn', 'spaget', 'makaron', 'pogacic', 'pogačic'];
    const spice = ['so ', 'biber', 'zacin', 'začin', 'origano', 'ruzmarin', 'lovor', 'persun', 'senf', 'susam', 'šušam'];
    const oil = ['ulje', 'ulja', 'maslin'];

    if (meat.some(m => name.includes(m))) return IngredientCategory.Meat;
    if (dairy.some(d => name.includes(d))) return IngredientCategory.Dairy;
    if (produce.some(p => name.includes(p))) return IngredientCategory.Produce;
    if (grain.some(g => name.includes(g))) return IngredientCategory.Grain;
    if (spice.some(s => name.includes(s))) return IngredientCategory.Spice;
    if (oil.some(o => name.includes(o))) return IngredientCategory.Oil;
    return IngredientCategory.Pantry;
  }

  private parseRecipes(extraLines: string[]): Recipe[] {
    const recipes: Recipe[] = [];
    const text = extraLines.join('\n');

    // Look for recipe-like blocks (e.g., "pogacica", "cureci gulas")
    const pogaciceMatch = text.match(/pogacic[\s\S]*?(?=alternativa|curec|$)/i);
    if (pogaciceMatch) {
      const block = pogaciceMatch[0];
      recipes.push({
        id: 'imported-pogacice',
        name: 'Pogačice',
        servings: '35 komada',
        ingredients: this.parseIngredients(block),
        instructions: this.extractInstructions(block),
      });
    }

    const gulasMatch = text.match(/[cć]ure[cć]i gula[sš][\s\S]*/i);
    if (gulasMatch) {
      const block = gulasMatch[0];
      recipes.push({
        id: 'imported-cureci-gulas',
        name: 'Ćureći gulaš',
        servings: 'za 2 dana',
        ingredients: this.parseIngredients(block),
        instructions: this.extractInstructions(block),
      });
    }

    return recipes;
  }

  private extractInstructions(block: string): string[] {
    // Look for sentences that describe actions (verbs like "dodati", "kuvati", etc.)
    const sentences = block.split(/[.!]/).map(s => s.trim()).filter(s => s.length > 20);
    const actionWords = ['dodati', 'kuvati', 'peći', 'peci', 'dinstati', 'umesiti', 'izmiksati', 'preliti',
      'iseci', 'iseći', 'operite', 'premazati', 'rastanjiti', 'vaditi', 'sjediniti', 'spremiti',
      'skuvati', 'umuti', 'vratiti', 'mesati', 'mešati', 'zapeci', 'pripremiti'];

    return sentences
      .filter(s => actionWords.some(w => s.toLowerCase().includes(w)))
      .map(s => s.charAt(0).toUpperCase() + s.slice(1));
  }

  private createEmptyMeal(type: MealType): Meal {
    return {
      type,
      time: MEAL_TIMES[type],
      name: '',
      description: '',
      ingredients: [],
    };
  }
}
