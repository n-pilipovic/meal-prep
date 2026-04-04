/**
 * Ingredient name normalizer — thin safety net for shopping list aggregation.
 *
 * Primary consistency comes from the AI prompt rules in cf-worker/src/ai-prompt.ts.
 * This normalizer catches residual edge cases: parentheticals, whitespace, casing.
 */

/** Strip parenthetical content: "Pasulj (spremljen)" → "Pasulj" */
function stripParentheses(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
}

/**
 * Normalize an ingredient name for aggregation.
 * Strips parentheticals, collapses whitespace, lowercases.
 */
export function normalizeIngredientName(rawName: string): string {
  return stripParentheses(rawName).replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Build an aggregation key from ingredient name and unit.
 * Ingredients with the same normalized name and unit are merged.
 */
export function getIngredientKey(name: string, unit: string): string {
  return `${normalizeIngredientName(name)}_${unit}`;
}

/**
 * Capitalize the first letter of a canonical name for display.
 */
export function getDisplayName(canonicalName: string): string {
  if (!canonicalName) return '';
  return canonicalName.charAt(0).toUpperCase() + canonicalName.slice(1);
}
