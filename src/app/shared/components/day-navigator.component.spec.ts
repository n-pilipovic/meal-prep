import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { DayNavigatorComponent } from './day-navigator.component';

@Component({
  imports: [DayNavigatorComponent],
  template: `<app-day-navigator [dayIndex]="day()" (dayChange)="onDayChange($event)" />`,
})
class TestHost {
  day = signal(3);
  lastEmitted: number | null = null;
  onDayChange(idx: number) {
    this.lastEmitted = idx;
    this.day.set(idx);
  }
}

describe('DayNavigatorComponent', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should display the correct day name', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Četvrtak');
  });

  it('should emit previous day on left click', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    fixture.detectChanges();
    expect(host.lastEmitted).toBe(2);
  });

  it('should emit next day on right click', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[1].click();
    fixture.detectChanges();
    expect(host.lastEmitted).toBe(4);
  });

  it('should disable prev button at day 0', () => {
    host.day.set(0);
    fixture.detectChanges();
    const prevBtn = fixture.nativeElement.querySelectorAll('button')[0];
    expect(prevBtn.disabled).toBe(true);
  });

  it('should disable next button at day 6', () => {
    host.day.set(6);
    fixture.detectChanges();
    const nextBtn = fixture.nativeElement.querySelectorAll('button')[1];
    expect(nextBtn.disabled).toBe(true);
  });
});
