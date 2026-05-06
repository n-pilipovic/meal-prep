import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { APP_VERSION } from '../../../environments/version';
import { ApiService } from './api.service';
import {
  IssueContext,
  IssueDetail,
  IssueRecord,
  IssueType,
} from '../models/issue.model';

const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;
const QUEUE_KEY = 'meal-prep:issue-queue';

interface QueuedSubmission {
  id: string;
  type: IssueType;
  title: string;
  description: string;
  context: IssueContext;
  attachmentsBase64: { dataUrl: string; name: string }[];
  queuedAt: string;
}

@Injectable({ providedIn: 'root' })
export class IssueReportService {
  private readonly api = inject(ApiService);

  readonly submitting = signal(false);
  readonly queueLength = signal(this.loadQueue().length);

  buildContext(currentRoute: string): IssueContext {
    return {
      route: currentRoute,
      appVersion: APP_VERSION.version,
      appCommit: APP_VERSION.commit,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a',
      viewport:
        typeof window !== 'undefined'
          ? `${window.innerWidth}x${window.innerHeight}`
          : 'n/a',
      timestamp: new Date().toISOString(),
    };
  }

  /** Resize and re-encode an image to JPEG to strip EXIF + cap size. */
  async compressImage(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(w, h)
        : Object.assign(document.createElement('canvas'), { width: w, height: h });

    const ctx = (canvas as any).getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    (ctx as any).drawImage(bitmap, 0, 0, w, h);

    if (canvas instanceof OffscreenCanvas) {
      return canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
    }
    return await new Promise<Blob>((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        'image/jpeg',
        JPEG_QUALITY,
      );
    });
  }

  async submit(input: {
    type: IssueType;
    title: string;
    description: string;
    attachments: Blob[];
    context: IssueContext;
  }): Promise<{ number: number; githubUrl: string }> {
    this.submitting.set(true);
    try {
      const form = this.buildFormData(input);
      const result = await firstValueFrom(this.api.submitIssue(form));
      return result;
    } catch (err) {
      // Queue for retry on next online cycle if it's likely a network issue
      if (this.isNetworkError(err)) {
        await this.enqueue(input);
      }
      throw err;
    } finally {
      this.submitting.set(false);
    }
  }

  async flushQueue(): Promise<void> {
    const queue = this.loadQueue();
    if (queue.length === 0) return;

    const remaining: QueuedSubmission[] = [];
    for (const entry of queue) {
      try {
        const attachments = await Promise.all(
          entry.attachmentsBase64.map((a) => this.dataUrlToBlob(a.dataUrl)),
        );
        const form = this.buildFormData({
          type: entry.type,
          title: entry.title,
          description: entry.description,
          context: entry.context,
          attachments,
        });
        await firstValueFrom(this.api.submitIssue(form));
      } catch (err) {
        if (this.isNetworkError(err)) {
          remaining.push(entry);
        }
        // non-network errors drop the entry — the worker rejected it
      }
    }

    this.saveQueue(remaining);
  }

  myIssues(): Promise<IssueRecord[]> {
    return firstValueFrom(this.api.getMyIssues());
  }

  householdSuggestions(code: string): Promise<IssueRecord[]> {
    return firstValueFrom(this.api.getHouseholdSuggestions(code));
  }

  getDetail(number: number): Promise<IssueDetail> {
    return firstValueFrom(this.api.getIssueDetail(number));
  }

  toggleUpvote(number: number): Promise<{ upvotes: number; upvotedByMe: boolean }> {
    return firstValueFrom(this.api.toggleIssueUpvote(number));
  }

  private buildFormData(input: {
    type: IssueType;
    title: string;
    description: string;
    context: IssueContext;
    attachments: Blob[];
  }): FormData {
    const form = new FormData();
    form.append('type', input.type);
    form.append('title', input.title);
    form.append('description', input.description);
    form.append('context', JSON.stringify(input.context));
    input.attachments.forEach((blob, i) =>
      form.append('attachments', blob, `attachment-${i}.jpg`),
    );
    return form;
  }

  private async enqueue(input: {
    type: IssueType;
    title: string;
    description: string;
    attachments: Blob[];
    context: IssueContext;
  }): Promise<void> {
    const attachmentsBase64 = await Promise.all(
      input.attachments.map(async (b, i) => ({
        name: `attachment-${i}.jpg`,
        dataUrl: await this.blobToDataUrl(b),
      })),
    );
    const queue = this.loadQueue();
    queue.push({
      id: crypto.randomUUID(),
      type: input.type,
      title: input.title,
      description: input.description,
      context: input.context,
      attachmentsBase64,
      queuedAt: new Date().toISOString(),
    });
    this.saveQueue(queue);
  }

  private loadQueue(): QueuedSubmission[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? (JSON.parse(raw) as QueuedSubmission[]) : [];
    } catch {
      return [];
    }
  }

  private saveQueue(queue: QueuedSubmission[]): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    this.queueLength.set(queue.length);
  }

  private isNetworkError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const status = (err as { status?: number }).status;
    return status === 0 || status === undefined || status >= 500;
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }

  private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const res = await fetch(dataUrl);
    return res.blob();
  }
}
