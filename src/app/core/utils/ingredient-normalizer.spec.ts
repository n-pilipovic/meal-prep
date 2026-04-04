import { normalizeIngredientName, getIngredientKey, getDisplayName } from './ingredient-normalizer';

describe('ingredient-normalizer', () => {
  describe('normalizeIngredientName', () => {
    it('should lowercase and trim names', () => {
      expect(normalizeIngredientName('  Hleb  ')).toBe('hleb');
      expect(normalizeIngredientName('PUTER')).toBe('puter');
    });

    it('should strip parenthetical content', () => {
      expect(normalizeIngredientName('Pasulj (spremljen)')).toBe('pasulj');
      expect(normalizeIngredientName('Jaje (za premaz)')).toBe('jaje');
      expect(normalizeIngredientName('Sveže povrće (rotkvica, krastavac ili paradajz)')).toBe('sveže povrće');
    });

    it('should collapse multiple spaces', () => {
      expect(normalizeIngredientName('Crni  luk')).toBe('crni luk');
    });

    it('should keep distinct ingredients separate', () => {
      expect(normalizeIngredientName('Crni luk')).not.toBe(normalizeIngredientName('Crveni luk'));
      expect(normalizeIngredientName('Ulje')).not.toBe(normalizeIngredientName('Maslinovo ulje'));
      expect(normalizeIngredientName('Hleb')).not.toBe(normalizeIngredientName('Integralni hleb'));
    });
  });

  describe('getIngredientKey', () => {
    it('should combine normalized name with unit', () => {
      expect(getIngredientKey('Hleb', 'g')).toBe('hleb_g');
      expect(getIngredientKey('  Hleb  ', 'g')).toBe('hleb_g');
    });

    it('should merge same ingredient with parenthetical variants', () => {
      expect(getIngredientKey('Jaje', 'kom')).toBe(getIngredientKey('Jaje (za premaz)', 'kom'));
    });

    it('should keep different units separate', () => {
      expect(getIngredientKey('Ulje', 'kašičica')).not.toBe(getIngredientKey('Ulje', 'kašika'));
    });
  });

  describe('getDisplayName', () => {
    it('should capitalize first letter', () => {
      expect(getDisplayName('hleb')).toBe('Hleb');
      expect(getDisplayName('grčki jogurt')).toBe('Grčki jogurt');
    });

    it('should handle empty string', () => {
      expect(getDisplayName('')).toBe('');
    });
  });
});
