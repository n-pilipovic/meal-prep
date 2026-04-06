import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { UserAvatarComponent } from './user-avatar.component';
import { UserProfile } from '../../core/models/user.model';

@Component({
  imports: [UserAvatarComponent],
  template: `<app-user-avatar [user]="user()" [size]="size()" />`,
})
class TestHost {
  user = signal<UserProfile>({ id: '1', name: 'Novica', color: '#2d6a4f' });
  size = signal<'sm' | 'md' | 'lg'>('md');
}

describe('UserAvatarComponent', () => {
  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
  });

  it('should display initials from name', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent?.trim()).toBe('NO');
  });

  it('should apply user color as inline style', () => {
    const span = fixture.nativeElement.querySelector('span');
    // Browser may normalize to rgb() or keep hex
    const color = span.style.color;
    expect(color).toBeTruthy();
  });

  it('should apply md size class by default', () => {
    const span = fixture.nativeElement.querySelector('span');
    expect(span.className).toContain('w-9');
  });

  it('should change size class when input changes', () => {
    fixture.componentInstance.size.set('lg');
    fixture.detectChanges();
    const span = fixture.nativeElement.querySelector('span');
    expect(span.className).toContain('w-12');
  });

  it('should update initials when user changes', () => {
    fixture.componentInstance.user.set({ id: '2', name: 'Ivana', color: '#e76f51' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent?.trim()).toBe('IV');
  });

  it('should show image when avatar is provided', () => {
    fixture.componentInstance.user.set({ id: '1', name: 'Novica', color: '#2d6a4f', avatar: 'https://example.com/photo.jpg' });
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.src).toContain('photo.jpg');
  });

  it('should fallback to initials when image fails to load', () => {
    fixture.componentInstance.user.set({ id: '1', name: 'Novica', color: '#2d6a4f', avatar: 'https://example.com/broken.jpg' });
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img');
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent?.trim()).toBe('NO');
  });

  it('should show initials when avatar is not set', () => {
    fixture.componentInstance.user.set({ id: '1', name: 'Novica', color: '#2d6a4f' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent?.trim()).toBe('NO');
  });
});
