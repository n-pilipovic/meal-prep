import { QuantityPipe } from './quantity.pipe';
import { Ingredient, IngredientCategory } from '../../core/models/meal.model';

describe('QuantityPipe', () => {
  const pipe = new QuantityPipe();

  it('should format ingredient with quantity and unit', () => {
    const ing: Ingredient = {
      name: 'Hleb',
      quantity: 70,
      unit: 'g',
      category: IngredientCategory.Grain,
    };
    expect(pipe.transform(ing)).toBe('Hleb 70g');
  });

  it('should format ingredient with decimal quantity', () => {
    const ing: Ingredient = {
      name: 'Ulje',
      quantity: 1.5,
      unit: 'kašika',
      category: IngredientCategory.Oil,
    };
    expect(pipe.transform(ing)).toBe('Ulje 1.5kašika');
  });

  it('should return only name when quantity is null', () => {
    const ing: Ingredient = {
      name: 'Sveže povrće',
      quantity: null,
      unit: '',
      category: IngredientCategory.Produce,
    };
    expect(pipe.transform(ing)).toBe('Sveže povrće');
  });

  it('should handle zero quantity', () => {
    const ing: Ingredient = {
      name: 'Test',
      quantity: 0,
      unit: 'g',
      category: IngredientCategory.Pantry,
    };
    expect(pipe.transform(ing)).toBe('Test 0g');
  });
});
