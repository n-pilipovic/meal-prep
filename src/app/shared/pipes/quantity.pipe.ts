import { Pipe, PipeTransform } from '@angular/core';
import { Ingredient } from '../../core/models/meal.model';

@Pipe({ name: 'quantity' })
export class QuantityPipe implements PipeTransform {
  transform(ingredient: Ingredient): string {
    if (ingredient.quantity == null) {
      return ingredient.name;
    }
    return `${ingredient.name} ${ingredient.quantity}${ingredient.unit}`;
  }
}
