import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { WelcomeComponent } from './welcome.component';

describe('WelcomeComponent a11y', () => {
  let fixture: ComponentFixture<WelcomeComponent>;
  let component: WelcomeComponent;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [WelcomeComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WelcomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

  it('should hide decorative emoji from screen readers', () => {
    const hiddenEmoji = fixture.nativeElement.querySelector('[aria-hidden="true"]');
    expect(hiddenEmoji).toBeTruthy();
    expect(hiddenEmoji.textContent.trim()).toBe('🍽️');
  });

  it('should have an h1 heading', () => {
    const h1 = fixture.nativeElement.querySelector('h1');
    expect(h1).toBeTruthy();
    expect(h1.textContent).toContain('Priprema Obroka');
  });

  describe('login form', () => {
    beforeEach(() => {
      component.authMode.set('login');
      fixture.detectChanges();
    });

    it('should have sr-only labels for email and password inputs', () => {
      const srLabels = fixture.nativeElement.querySelectorAll('.sr-only');
      const labelTexts = Array.from(srLabels).map((el: any) => el.textContent.trim());
      expect(labelTexts).toContain('Email adresa');
      expect(labelTexts).toContain('Lozinka');
    });

    it('should wrap inputs in label elements', () => {
      const inputs = fixture.nativeElement.querySelectorAll('input[type="email"], input[type="password"]');
      for (const input of inputs) {
        expect(input.closest('label')).toBeTruthy();
      }
    });

    it('should have autocomplete attributes on inputs', () => {
      const emailInput = fixture.nativeElement.querySelector('input[type="email"]');
      const passwordInput = fixture.nativeElement.querySelector('input[type="password"]');
      expect(emailInput.getAttribute('autocomplete')).toBe('email');
      expect(passwordInput.getAttribute('autocomplete')).toBe('current-password');
    });
  });

  describe('register form', () => {
    beforeEach(() => {
      component.authMode.set('register');
      fixture.detectChanges();
    });

    it('should have sr-only labels for all registration inputs', () => {
      const srLabels = fixture.nativeElement.querySelectorAll('.sr-only');
      const labelTexts = Array.from(srLabels).map((el: any) => el.textContent.trim());
      expect(labelTexts).toContain('Tvoje ime');
      expect(labelTexts).toContain('Email adresa');
      expect(labelTexts).toContain('Lozinka (min. 6 karaktera)');
    });

    it('should show error message with role="alert"', () => {
      component.error.set('Test greška');
      fixture.detectChanges();

      const alert = fixture.nativeElement.querySelector('[role="alert"]');
      expect(alert).toBeTruthy();
      expect(alert.textContent).toContain('Test greška');
    });
  });
});
