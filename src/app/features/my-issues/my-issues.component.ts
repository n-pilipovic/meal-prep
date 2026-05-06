import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { HouseholdService } from '../../core/services/household.service';
import { IssueReportService } from '../../core/services/issue-report.service';
import {
  IssueRecord,
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

const TYPE_ICON: Record<string, string> = {
  bug: '🐞',
  suggestion: '💡',
  question: '❓',
};

@Component({
  selector: 'app-my-issues',
  imports: [RouterLink],
  template: `
    <div class="px-4 py-4 pb-24 max-w-xl mx-auto">
      <button
        (click)="back()"
        class="text-green-primary font-medium text-sm active:opacity-70 min-h-11 mb-2">
        ‹ Nazad
      </button>

      <h1 class="text-xl font-bold text-text-primary mb-3">Prijave</h1>

      <div class="grid grid-cols-2 gap-2 mb-4 bg-cream-light p-1 rounded-2xl">
        <button
          (click)="tab.set('mine')"
          [class]="tab() === 'mine'
            ? 'py-2.5 rounded-xl bg-white text-text-primary font-medium min-h-11 shadow-sm'
            : 'py-2.5 rounded-xl text-text-secondary min-h-11'">
          Moje prijave
        </button>
        <button
          (click)="tab.set('suggestions')"
          [class]="tab() === 'suggestions'
            ? 'py-2.5 rounded-xl bg-white text-text-primary font-medium min-h-11 shadow-sm'
            : 'py-2.5 rounded-xl text-text-secondary min-h-11'">
          Predlozi domaćinstva
        </button>
      </div>

      @if (loading()) {
        <p class="text-sm text-text-muted text-center py-8">Učitavanje...</p>
      } @else if (error()) {
        <p role="alert" class="text-red-500 text-sm text-center py-4">{{ error() }}</p>
      } @else if (visibleIssues().length === 0) {
        <div class="bg-white rounded-2xl shadow-sm p-6 text-center">
          <p class="text-sm text-text-secondary mb-3">
            @if (tab() === 'mine') {
              Još nemaš poslate prijave.
            } @else {
              Još nema predloga u domaćinstvu.
            }
          </p>
          <a routerLink="/report-issue"
             class="inline-block px-4 py-2 bg-green-primary text-white text-sm font-medium rounded-xl min-h-11">
            Pošalji povratnu informaciju
          </a>
        </div>
      } @else {
        <div class="flex flex-col gap-2">
          @for (issue of visibleIssues(); track issue.number) {
            <a [routerLink]="['/issue', issue.number]"
               class="bg-white rounded-2xl shadow-sm p-4 active:bg-cream-light transition-colors flex items-start gap-3">
              <span class="text-2xl" aria-hidden="true">{{ typeIcon(issue.type) }}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-xs font-mono text-text-muted">#{{ issue.number }}</span>
                  <span [class]="'px-2 py-0.5 text-xs rounded-full ' + stateBadge(issue.state)">
                    {{ stateLabels[issue.state] }}
                  </span>
                </div>
                <p class="font-medium text-text-primary truncate">{{ issue.title }}</p>
                <div class="flex items-center justify-between mt-1">
                  <p class="text-xs text-text-muted">
                    {{ typeLabels[issue.type] }} · {{ issue.authorName }}
                  </p>
                  @if (tab() === 'suggestions') {
                    <button
                      type="button"
                      (click)="upvote($event, issue)"
                      [class]="issue.upvotedByMe
                        ? 'flex items-center gap-1 px-2 py-1 bg-green-primary text-white rounded-full text-xs min-h-8'
                        : 'flex items-center gap-1 px-2 py-1 bg-cream-light text-text-secondary rounded-full text-xs min-h-8 active:opacity-70'">
                      👍 {{ issue.upvotes }}
                    </button>
                  }
                </div>
              </div>
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class MyIssuesComponent {
  private readonly issueReport = inject(IssueReportService);
  private readonly household = inject(HouseholdService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly stateLabels = ISSUE_STATE_LABELS;
  readonly typeLabels = ISSUE_TYPE_LABELS;

  readonly tab = signal<'mine' | 'suggestions'>('mine');
  readonly loading = signal(true);
  readonly error = signal('');

  readonly mine = signal<IssueRecord[]>([]);
  readonly suggestions = signal<IssueRecord[]>([]);

  readonly visibleIssues = computed(() =>
    this.tab() === 'mine' ? this.mine() : this.suggestions(),
  );

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const code = this.household.householdCode();
      const [mine, sugg] = await Promise.all([
        this.issueReport.myIssues(),
        code ? this.issueReport.householdSuggestions(code) : Promise.resolve([]),
      ]);
      this.mine.set(mine);
      this.suggestions.set(sugg);
    } catch (err: any) {
      this.error.set('Nije moguće učitati prijave.');
    } finally {
      this.loading.set(false);
    }
  }

  async upvote(event: Event, issue: IssueRecord): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    try {
      const result = await this.issueReport.toggleUpvote(issue.number);
      this.suggestions.update((list) =>
        list.map((s) =>
          s.number === issue.number
            ? { ...s, upvotes: result.upvotes, upvotedByMe: result.upvotedByMe }
            : s,
        ),
      );
    } catch {
      // ignore optimistic failure
    }
  }

  stateBadge(state: IssueState): string {
    return STATE_BADGE_CLASS[state];
  }

  typeIcon(type: string): string {
    return TYPE_ICON[type] ?? '📝';
  }

  back(): void {
    this.location.back();
  }
}
