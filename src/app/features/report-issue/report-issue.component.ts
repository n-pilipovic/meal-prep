import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { IssueReportService } from '../../core/services/issue-report.service';
import { IssueType, ISSUE_TYPE_LABELS } from '../../core/models/issue.model';

interface ThumbnailEntry {
  blob: Blob;
  url: string;
}

const TYPE_PROMPTS: Record<IssueType, { titleLabel: string; descLabel: string; attachmentHint: string; placeholder: string }> = {
  bug: {
    titleLabel: 'Kratko opiši grešku',
    descLabel: 'Šta se desilo? Šta si očekivao?',
    attachmentHint: 'Slika greške pomaže razvijaču da je razume.',
    placeholder: 'Npr. Aplikacija prijavljuje grešku kada otvorim listu kupovine.',
  },
  suggestion: {
    titleLabel: 'Šta želiš da dodamo?',
    descLabel: 'Kako bi to izgledalo? Koji problem rešava?',
    attachmentHint: 'Slika ekrana ili skica pomaže da razumemo ideju.',
    placeholder: 'Npr. Voleo bih da mogu da označim omiljene recepte.',
  },
  question: {
    titleLabel: 'Šta te zanima?',
    descLabel: 'Postavi pitanje',
    attachmentHint: '',
    placeholder: 'Npr. Kako da kreiram nedeljni plan za dete?',
  },
};

@Component({
  selector: 'app-report-issue',
  imports: [FormsModule],
  template: `
    <div class="px-4 py-4 pb-24 max-w-xl mx-auto">
      <button
        (click)="back()"
        class="text-green-primary font-medium text-sm active:opacity-70 min-h-11 mb-2">
        ‹ Nazad
      </button>

      <h1 class="text-xl font-bold text-text-primary mb-4">Povratna informacija</h1>

      @if (submitted()) {
        <div class="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center text-center gap-3">
          <span class="text-4xl" aria-hidden="true">✓</span>
          <h2 class="font-semibold text-text-primary text-lg">Hvala!</h2>
          <p class="text-sm text-text-secondary">Tvoja prijava je poslata.</p>
          <p class="text-sm text-text-primary font-mono">
            Referenca: <strong>#{{ submittedNumber() }}</strong>
          </p>
          <p class="text-xs text-text-muted">Sačuvaj broj reference za praćenje.</p>
          <button
            (click)="goToMyIssues()"
            class="mt-2 px-4 py-2 bg-green-primary text-white font-medium rounded-xl min-h-11">
            Moje prijave
          </button>
          <button
            (click)="back()"
            class="text-text-muted text-sm active:opacity-70 min-h-11">
            Nazad
          </button>
        </div>
      } @else {
        <form (ngSubmit)="submit()" class="flex flex-col gap-4">
          <!-- Type selector -->
          <div class="bg-white rounded-2xl shadow-sm p-4">
            <label class="block text-sm font-medium text-text-primary mb-2">Tip</label>
            <div class="grid grid-cols-3 gap-2">
              @for (t of types; track t) {
                <button
                  type="button"
                  (click)="type.set(t)"
                  [class]="t === type()
                    ? 'py-3 rounded-xl bg-green-primary text-white font-medium min-h-11'
                    : 'py-3 rounded-xl bg-cream-light text-text-primary min-h-11 active:opacity-70'">
                  {{ typeLabels[t] }}
                </button>
              }
            </div>
          </div>

          <!-- Title -->
          <div class="bg-white rounded-2xl shadow-sm p-4">
            <label class="block text-sm font-medium text-text-primary mb-2">
              {{ prompts().titleLabel }}
            </label>
            <input
              type="text"
              [(ngModel)]="title"
              name="title"
              maxlength="100"
              class="w-full px-3 py-2.5 bg-cream-light rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-green-primary min-h-11"
              placeholder="Naslov" />
          </div>

          <!-- Description -->
          <div class="bg-white rounded-2xl shadow-sm p-4">
            <label class="block text-sm font-medium text-text-primary mb-2">
              {{ prompts().descLabel }}
            </label>
            <textarea
              [(ngModel)]="description"
              name="description"
              rows="5"
              maxlength="4000"
              [placeholder]="prompts().placeholder"
              class="w-full px-3 py-2.5 bg-cream-light rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-green-primary resize-none"></textarea>
            <p class="text-xs text-text-muted mt-1 text-right">{{ description().length }}/4000</p>
          </div>

          <!-- Attachments -->
          <div class="bg-white rounded-2xl shadow-sm p-4">
            <label class="block text-sm font-medium text-text-primary mb-2">
              Prilozi (do 3 slike)
            </label>
            @if (prompts().attachmentHint) {
              <p class="text-xs text-text-muted mb-2">{{ prompts().attachmentHint }}</p>
            }
            <input
              #fileInput
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              (change)="onFiles($event)"
              class="hidden" />
            <button
              type="button"
              (click)="fileInput.click()"
              [disabled]="thumbnails().length >= 3 || compressing()"
              class="w-full py-3 rounded-xl border border-dashed border-border text-text-secondary disabled:opacity-40 min-h-11 active:opacity-70">
              {{ compressing() ? 'Obrada...' : '+ Dodaj sliku' }}
            </button>

            @if (thumbnails().length > 0) {
              <div class="grid grid-cols-3 gap-2 mt-3">
                @for (thumb of thumbnails(); track thumb.url; let i = $index) {
                  <div class="relative aspect-square">
                    <img [src]="thumb.url" alt="" class="w-full h-full object-cover rounded-xl" />
                    <button
                      type="button"
                      (click)="removeThumbnail(i)"
                      aria-label="Ukloni sliku"
                      class="absolute top-1 right-1 w-7 h-7 bg-black/60 text-white rounded-full text-sm leading-none flex items-center justify-center active:opacity-70">
                      ×
                    </button>
                  </div>
                }
              </div>
            }

            @if (attachmentError()) {
              <p role="alert" class="text-red-500 text-xs mt-2">{{ attachmentError() }}</p>
            }
          </div>

          <!-- Disclosure -->
          <p class="text-xs text-text-muted px-2">
            Uz prijavu se šalju: tvoje ime, verzija aplikacije, trenutna stranica, tip uređaja i prikačene slike.
            Prijave se čuvaju javno u GitHub repozitorijumu aplikacije.
          </p>

          @if (error()) {
            <p role="alert" class="text-red-500 text-sm text-center">{{ error() }}</p>
          }

          <button
            type="submit"
            [disabled]="!canSubmit()"
            class="w-full py-4 bg-green-primary text-white font-semibold rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-40 min-h-13">
            {{ issueReport.submitting() ? 'Šaljem...' : 'Pošalji' }}
          </button>
          <button
            type="button"
            (click)="back()"
            class="w-full py-3 text-text-muted text-sm active:opacity-70 min-h-11">
            Otkaži
          </button>
        </form>
      }
    </div>
  `,
})
export class ReportIssueComponent {
  readonly issueReport = inject(IssueReportService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly types: IssueType[] = ['bug', 'suggestion', 'question'];
  readonly typeLabels = ISSUE_TYPE_LABELS;

  readonly type = signal<IssueType>('bug');
  readonly title = signal('');
  readonly description = signal('');
  readonly thumbnails = signal<ThumbnailEntry[]>([]);
  readonly compressing = signal(false);
  readonly attachmentError = signal('');
  readonly error = signal('');
  readonly submitted = signal(false);
  readonly submittedNumber = signal<number | null>(null);

  readonly prompts = computed(() => TYPE_PROMPTS[this.type()]);

  readonly canSubmit = computed(() => {
    return (
      !this.issueReport.submitting() &&
      !this.compressing() &&
      this.title().trim().length > 0 &&
      this.description().trim().length > 0
    );
  });

  private readonly capturedRoute = this.router.url;

  async onFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    this.attachmentError.set('');
    this.compressing.set(true);

    const remaining = 3 - this.thumbnails().length;
    const files = Array.from(input.files).slice(0, remaining);

    try {
      const newThumbs: ThumbnailEntry[] = [];
      for (const f of files) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
          this.attachmentError.set('Dozvoljeni formati: JPEG, PNG, WebP.');
          continue;
        }
        const blob = await this.issueReport.compressImage(f);
        if (blob.size > 5 * 1024 * 1024) {
          this.attachmentError.set('Slika je prevelika. Pokušaj sa manjom.');
          continue;
        }
        newThumbs.push({ blob, url: URL.createObjectURL(blob) });
      }
      this.thumbnails.update((current) => [...current, ...newThumbs]);
    } catch (err) {
      this.attachmentError.set('Nije moguće obraditi sliku.');
    } finally {
      this.compressing.set(false);
      input.value = '';
    }
  }

  removeThumbnail(i: number): void {
    this.thumbnails.update((current) => {
      const removed = current[i];
      if (removed) URL.revokeObjectURL(removed.url);
      return current.filter((_, idx) => idx !== i);
    });
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.error.set('');

    const context = this.issueReport.buildContext(this.capturedRoute);
    try {
      const result = await this.issueReport.submit({
        type: this.type(),
        title: this.title().trim(),
        description: this.description().trim(),
        attachments: this.thumbnails().map((t) => t.blob),
        context,
      });
      this.thumbnails().forEach((t) => URL.revokeObjectURL(t.url));
      this.submittedNumber.set(result.number);
      this.submitted.set(true);
    } catch (err: any) {
      const msg = err?.error?.error ?? err?.message ?? 'Slanje nije uspelo.';
      this.error.set(msg);
    }
  }

  goToMyIssues(): void {
    this.router.navigate(['/my-issues']);
  }

  back(): void {
    this.thumbnails().forEach((t) => URL.revokeObjectURL(t.url));
    this.location.back();
  }
}
