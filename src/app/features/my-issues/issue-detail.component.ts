import { Component, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { IssueReportService } from '../../core/services/issue-report.service';
import {
  IssueDetail,
  IssueState,
  ISSUE_STATE_LABELS,
  ISSUE_TYPE_LABELS,
} from '../../core/models/issue.model';

const STATE_BADGE_CLASS: Record<IssueState, string> = {
  open: 'bg-cream-light text-text-secondary',
  in_progress: 'bg-orange-primary/15 text-orange-primary',
  resolved: 'bg-green-primary/15 text-green-primary',
  rejected: 'bg-text-muted/15 text-text-muted',
};

@Component({
  selector: 'app-issue-detail',
  template: `
    <div class="px-4 py-4 pb-24 max-w-xl mx-auto">
      <button
        (click)="back()"
        class="text-green-primary font-medium text-sm active:opacity-70 min-h-11 mb-2">
        ‹ Nazad
      </button>

      @if (loading()) {
        <p class="text-sm text-text-muted text-center py-8">Učitavanje...</p>
      } @else if (error()) {
        <p role="alert" class="text-red-500 text-sm text-center py-4">{{ error() }}</p>
      } @else if (detail()) {
        <article class="flex flex-col gap-3">
          <div class="bg-white rounded-2xl shadow-sm p-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-xs font-mono text-text-muted">#{{ detail()!.issue.number }}</span>
              <span [class]="'px-2 py-0.5 text-xs rounded-full ' + stateBadge(detail()!.issue.state)">
                {{ stateLabels[detail()!.issue.state] }}
              </span>
              <span class="text-xs text-text-muted">{{ typeLabels[detail()!.issue.type] }}</span>
            </div>
            <h1 class="text-lg font-semibold text-text-primary">{{ detail()!.issue.title }}</h1>
            <p class="text-xs text-text-muted mt-1">
              {{ detail()!.issue.authorName }} · {{ formatDate(detail()!.issue.createdAt) }}
            </p>
          </div>

          <div class="bg-white rounded-2xl shadow-sm p-4">
            <h2 class="font-semibold text-text-primary mb-2">Opis</h2>
            <p class="text-sm text-text-secondary whitespace-pre-wrap">{{ detail()!.description }}</p>
          </div>

          @if (detail()!.attachments.length > 0) {
            <div class="bg-white rounded-2xl shadow-sm p-4">
              <h2 class="font-semibold text-text-primary mb-2">Prilozi</h2>
              <div class="grid grid-cols-2 gap-2">
                @for (att of detail()!.attachments; track att.url) {
                  <a [href]="att.url" target="_blank" rel="noopener" class="block aspect-square">
                    <img [src]="att.url" [alt]="att.name" class="w-full h-full object-cover rounded-xl" />
                  </a>
                }
              </div>
            </div>
          }

          @if (detail()!.comments.length > 0) {
            <div class="bg-white rounded-2xl shadow-sm p-4">
              <h2 class="font-semibold text-text-primary mb-2">Odgovori</h2>
              <div class="flex flex-col gap-3">
                @for (c of detail()!.comments; track c.createdAt) {
                  <div [class]="c.author === 'developer' ? 'bg-cream-light rounded-xl p-3' : 'bg-white border border-border rounded-xl p-3'">
                    <p class="text-xs text-text-muted mb-1">
                      {{ c.author === 'developer' ? 'Razvijač' : 'Prijavilac' }} · {{ formatDate(c.createdAt) }}
                    </p>
                    <p class="text-sm text-text-secondary whitespace-pre-wrap">{{ c.body }}</p>
                  </div>
                }
              </div>
            </div>
          }
        </article>
      }
    </div>
  `,
})
export class IssueDetailComponent {
  private readonly issueReport = inject(IssueReportService);
  private readonly location = inject(Location);

  readonly stateLabels = ISSUE_STATE_LABELS;
  readonly typeLabels = ISSUE_TYPE_LABELS;

  readonly number = input.required<string>();

  readonly detail = signal<IssueDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    queueMicrotask(() => void this.load());
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    const n = Number(this.number());
    if (!Number.isFinite(n)) {
      this.error.set('Neispravan broj prijave.');
      this.loading.set(false);
      return;
    }
    try {
      const d = await this.issueReport.getDetail(n);
      this.detail.set(d);
    } catch {
      this.error.set('Nije moguće učitati prijavu.');
    } finally {
      this.loading.set(false);
    }
  }

  stateBadge(state: IssueState): string {
    return STATE_BADGE_CLASS[state];
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString('sr-Latn-RS', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  back(): void {
    this.location.back();
  }
}
