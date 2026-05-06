import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { IssueReportService } from './issue-report.service';
import { environment } from '../../../environments/environment';

describe('IssueReportService', () => {
  let service: IssueReportService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(IssueReportService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('builds context with required fields', () => {
    const ctx = service.buildContext('/today');
    expect(ctx.route).toBe('/today');
    expect(ctx.appVersion).toBeDefined();
    expect(ctx.appCommit).toBeDefined();
    expect(ctx.timestamp).toBeDefined();
  });

  it('submits a multipart form to /api/issues', async () => {
    const promise = service.submit({
      type: 'bug',
      title: 'Test',
      description: 'Something broke',
      attachments: [],
      context: service.buildContext('/today'),
    });

    const req = http.expectOne(`${environment.apiUrl}/api/issues`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    const body = req.request.body as FormData;
    expect(body.get('type')).toBe('bug');
    expect(body.get('title')).toBe('Test');
    expect(body.get('description')).toBe('Something broke');
    expect(body.get('context')).toBeTruthy();

    req.flush({ number: 42, githubUrl: 'https://github.com/x/y/issues/42' });

    const result = await promise;
    expect(result.number).toBe(42);
  });

  it('queues a submission when the request fails with a network error (status 0)', async () => {
    const submitP = service
      .submit({
        type: 'suggestion',
        title: 'Add dark mode',
        description: 'Please',
        attachments: [],
        context: service.buildContext('/settings'),
      })
      .catch((e) => e);

    const req = http.expectOne(`${environment.apiUrl}/api/issues`);
    req.error(new ProgressEvent('error'), { status: 0 });

    await submitP;
    expect(service.queueLength()).toBe(1);

    const stored = JSON.parse(localStorage.getItem('meal-prep:issue-queue')!);
    expect(stored).toHaveLength(1);
    expect(stored[0].type).toBe('suggestion');
    expect(stored[0].title).toBe('Add dark mode');
  });

  it('does not queue when the worker rejects the payload (4xx)', async () => {
    const submitP = service
      .submit({
        type: 'bug',
        title: 'x',
        description: 'y',
        attachments: [],
        context: service.buildContext('/today'),
      })
      .catch((e) => e);

    const req = http.expectOne(`${environment.apiUrl}/api/issues`);
    req.flush({ error: 'too long' }, { status: 400, statusText: 'Bad Request' });

    await submitP;
    expect(service.queueLength()).toBe(0);
    expect(localStorage.getItem('meal-prep:issue-queue')).toBeNull();
  });

  it('flushes queued entries on flushQueue()', async () => {
    // Manually seed a queue entry
    const queue = [
      {
        id: 'abc',
        type: 'bug',
        title: 'queued',
        description: 'queued desc',
        context: service.buildContext('/today'),
        attachmentsBase64: [],
        queuedAt: new Date().toISOString(),
      },
    ];
    localStorage.setItem('meal-prep:issue-queue', JSON.stringify(queue));

    const flushP = service.flushQueue();
    // Yield a few microtasks so the inner await Promise.all + firstValueFrom can fire the HTTP request
    for (let i = 0; i < 5; i++) await Promise.resolve();

    const req = http.expectOne(`${environment.apiUrl}/api/issues`);
    req.flush({ number: 1, githubUrl: 'https://x' });
    await flushP;

    const remaining = JSON.parse(
      localStorage.getItem('meal-prep:issue-queue') ?? '[]',
    );
    expect(remaining).toHaveLength(0);
  });
});
