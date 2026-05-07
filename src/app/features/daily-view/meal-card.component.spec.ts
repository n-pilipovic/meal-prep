import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MealCardComponent } from './meal-card.component';
import { Meal, MealType, IngredientCategory } from '../../core/models/meal.model';

@Component({
  imports: [MealCardComponent],
  template: `<app-meal-card [meal]="meal" [dayIndex]="0" [userId]="userId()" />`,
})
class TestHost {
  meal: Meal = {
    type: MealType.Lunch,
    time: '14:00',
    name: 'Bolonjeze špagete',
    description: 'Test opis',
    ingredients: [
      { name: 'Junetina', quantity: 100, unit: 'g', category: IngredientCategory.Meat },
      { name: 'Špagete', quantity: 80, unit: 'g', category: IngredientCategory.Grain },
      { name: 'Paradajz', quantity: null, unit: '', category: IngredientCategory.Produce },
    ],
  };
  userId = signal<string | null>(null);
}

describe('MealCardComponent', () => {
  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
  });

  it('should display meal name', () => {
    expect(fixture.nativeElement.textContent).toContain('Bolonjeze špagete');
  });

  it('should display meal type label', () => {
    expect(fixture.nativeElement.textContent).toContain('Ručak');
  });

  it('should display meal time', () => {
    expect(fixture.nativeElement.textContent).toContain('14:00');
  });

  it('should display ingredient names', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Junetina');
    expect(text).toContain('Špagete');
    expect(text).toContain('Paradajz');
  });

  it('should display quantities for ingredients that have them', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('100g');
    expect(text).toContain('80g');
  });

  it('should link to meal detail route without query param when userId is null', () => {
    const link = fixture.nativeElement.querySelector('a');
    expect(link.getAttribute('href')).toBe('/day/0/meal/rucak');
  });

  it('should append ?user=<id> when userId is set (viewing another household member)', () => {
    fixture.componentInstance.userId.set('user-123');
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a');
    expect(link.getAttribute('href')).toBe('/day/0/meal/rucak?user=user-123');
  });
});
