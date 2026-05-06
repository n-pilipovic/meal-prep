import { getJSON, putJSON, type KVNamespace } from './kv-helpers';
import { sendPushNotification } from './web-push';

export interface IssuesEnv {
  KV: KVNamespace;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  GITHUB_ASSETS_RELEASE_ID: string;
  GITHUB_WEBHOOK_SECRET: string;
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
}

export type IssueType = 'bug' | 'suggestion' | 'question';
export type IssueState = 'open' | 'in_progress' | 'resolved' | 'rejected';

interface AttachmentRef {
  url: string;
  name: string;
  assetId: number;
}

interface IssueRecord {
  number: number;
  type: IssueType;
  title: string;
  description: string;
  state: IssueState;
  githubUrl: string;
  authorUserId: string;
  householdCode: string;
  upvotes: Record<string, true>;
  attachments: AttachmentRef[];
  createdAt: string;
  updatedAt: string;
}

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_ISSUES_PER_HOUR = 5;
const MAX_UPLOAD_BYTES_PER_HOUR = 20 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const TYPE_TO_LABEL: Record<IssueType, string> = {
  bug: 'bug',
  suggestion: 'enhancement',
  question: 'question',
};

const TYPE_PREFIX: Record<IssueType, string> = {
  bug: '[bug]',
  suggestion: '[suggestion]',
  question: '[question]',
};

const STATE_LABELS_SR: Record<IssueState, string> = {
  open: 'Otvoreno',
  in_progress: 'U obradi',
  resolved: 'Rešeno',
  rejected: 'Odbačeno',
};

function ghHeaders(env: IssuesEnv, accept = 'application/vnd.github+json'): HeadersInit {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: accept,
    'User-Agent': 'meal-prep-worker',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return 'image/png';
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return 'image/webp';
  return null;
}

function extForMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'bin';
}

interface RateState {
  windowStart: number;
  issues: number;
  bytes: number;
}

async function checkRateLimit(
  kv: KVNamespace,
  householdCode: string,
  bytesToAdd: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const key = `ratelimit:issues:${householdCode}`;
  const now = Date.now();
  const state = (await getJSON<RateState>(kv, key)) ?? {
    windowStart: now,
    issues: 0,
    bytes: 0,
  };

  if (now - state.windowStart > RATE_LIMIT_WINDOW_MS) {
    state.windowStart = now;
    state.issues = 0;
    state.bytes = 0;
  }

  if (state.issues >= MAX_ISSUES_PER_HOUR) {
    return { ok: false, reason: 'Previše prijava u poslednjih sat vremena.' };
  }
  if (state.bytes + bytesToAdd > MAX_UPLOAD_BYTES_PER_HOUR) {
    return { ok: false, reason: 'Premašen mesečni limit priloga. Pokušaj kasnije.' };
  }

  state.issues += 1;
  state.bytes += bytesToAdd;
  await putJSON(kv, key, state);
  return { ok: true };
}

async function uploadAttachment(
  env: IssuesEnv,
  body: Uint8Array,
  mime: string,
): Promise<AttachmentRef> {
  const id = crypto.randomUUID();
  const date = new Date().toISOString().slice(0, 10);
  const name = `${date}-${id}.${extForMime(mime)}`;

  const url = `https://uploads.github.com/repos/${env.GITHUB_REPO}/releases/${env.GITHUB_ASSETS_RELEASE_ID}/assets?name=${encodeURIComponent(name)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...ghHeaders(env),
      'Content-Type': mime,
      'Content-Length': body.byteLength.toString(),
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Asset upload failed: ${res.status} ${text}`);
  }

  const asset = (await res.json()) as { id: number; browser_download_url: string; name: string };
  return { url: asset.browser_download_url, name: asset.name, assetId: asset.id };
}

function buildIssueBody(
  description: string,
  attachments: AttachmentRef[],
  context: Record<string, string>,
  authorName: string,
  householdCode: string,
): string {
  const lines: string[] = [];
  lines.push('## Opis');
  lines.push(description);
  if (attachments.length > 0) {
    lines.push('');
    lines.push('## Prilozi');
    for (const a of attachments) {
      lines.push(`![${a.name}](${a.url})`);
    }
  }
  lines.push('');
  lines.push('<details><summary>Metadata</summary>');
  lines.push('');
  lines.push(`- **Korisnik**: ${authorName}`);
  lines.push(`- **Domaćinstvo**: ${householdCode}`);
  lines.push(`- **Stranica**: ${context.route ?? 'n/a'}`);
  lines.push(`- **Verzija**: ${context.appVersion ?? 'n/a'} · ${context.appCommit ?? 'n/a'}`);
  lines.push(`- **Uređaj**: ${context.userAgent ?? 'n/a'}`);
  lines.push(`- **Viewport**: ${context.viewport ?? 'n/a'}`);
  lines.push(`- **Vreme**: ${context.timestamp ?? new Date().toISOString()}`);
  lines.push('');
  lines.push('</details>');
  return lines.join('\n');
}

async function createGithubIssue(
  env: IssuesEnv,
  type: IssueType,
  title: string,
  body: string,
): Promise<{ number: number; html_url: string }> {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
    method: 'POST',
    headers: { ...ghHeaders(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `${TYPE_PREFIX[type]} ${title}`.slice(0, 256),
      body,
      labels: ['user-report', TYPE_TO_LABEL[type]],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub issue create failed: ${res.status} ${text}`);
  }
  return (await res.json()) as { number: number; html_url: string };
}

async function deriveStateFromGithub(
  env: IssuesEnv,
  number: number,
): Promise<{ state: IssueState; updatedAt: string } | null> {
  const res = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/issues/${number}`,
    { headers: ghHeaders(env) },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    state: 'open' | 'closed';
    state_reason: string | null;
    labels: { name: string }[];
    updated_at: string;
  };
  let state: IssueState;
  if (data.state === 'closed') {
    state = data.state_reason === 'not_planned' ? 'rejected' : 'resolved';
  } else if (data.labels.some((l) => l.name === 'in-progress')) {
    state = 'in_progress';
  } else {
    state = 'open';
  }
  return { state, updatedAt: data.updated_at };
}

async function appendUserIssue(
  kv: KVNamespace,
  userId: string,
  number: number,
): Promise<void> {
  const key = `userIssues:${userId}`;
  const list = (await getJSON<number[]>(kv, key)) ?? [];
  if (!list.includes(number)) {
    list.unshift(number);
    await putJSON(kv, key, list.slice(0, 200));
  }
}

async function appendHouseholdIssue(
  kv: KVNamespace,
  householdCode: string,
  number: number,
): Promise<void> {
  const key = `householdIssues:${householdCode}`;
  const list = (await getJSON<number[]>(kv, key)) ?? [];
  if (!list.includes(number)) {
    list.unshift(number);
    await putJSON(kv, key, list.slice(0, 500));
  }
}

interface CreateIssueInput {
  type: IssueType;
  title: string;
  description: string;
  attachments: { bytes: Uint8Array; mime: string }[];
  context: Record<string, string>;
  authorUserId: string;
  authorName: string;
  householdCode: string;
}

export async function createIssueFlow(
  env: IssuesEnv,
  input: CreateIssueInput,
): Promise<{ number: number; githubUrl: string }> {
  const totalBytes = input.attachments.reduce((s, a) => s + a.bytes.byteLength, 0);
  const rate = await checkRateLimit(env.KV, input.householdCode, totalBytes);
  if (!rate.ok) throw new Error(rate.reason);

  const uploaded: AttachmentRef[] = [];
  for (const a of input.attachments) {
    uploaded.push(await uploadAttachment(env, a.bytes, a.mime));
  }

  const body = buildIssueBody(
    input.description,
    uploaded,
    input.context,
    input.authorName,
    input.householdCode,
  );

  const created = await createGithubIssue(env, input.type, input.title, body);

  const record: IssueRecord = {
    number: created.number,
    type: input.type,
    title: input.title,
    description: input.description,
    state: 'open',
    githubUrl: created.html_url,
    authorUserId: input.authorUserId,
    householdCode: input.householdCode,
    upvotes: {},
    attachments: uploaded,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await putJSON(env.KV, `issue:${created.number}`, record);
  await appendUserIssue(env.KV, input.authorUserId, created.number);
  await appendHouseholdIssue(env.KV, input.householdCode, created.number);

  return { number: created.number, githubUrl: created.html_url };
}

interface PublicIssue {
  number: number;
  type: IssueType;
  title: string;
  state: IssueState;
  githubUrl: string;
  authorUserId: string;
  authorName: string;
  upvotes: number;
  upvotedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

interface HouseholdMember {
  id: string;
  name: string;
}

interface HouseholdSnapshot {
  members: HouseholdMember[];
}

async function projectIssue(
  record: IssueRecord,
  household: HouseholdSnapshot | null,
  viewerUserId: string,
): Promise<PublicIssue> {
  const author = household?.members.find((m) => m.id === record.authorUserId);
  return {
    number: record.number,
    type: record.type,
    title: record.title,
    state: record.state,
    githubUrl: record.githubUrl,
    authorUserId: record.authorUserId,
    authorName: author?.name ?? 'Korisnik',
    upvotes: Object.keys(record.upvotes).length,
    upvotedByMe: !!record.upvotes[viewerUserId],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function listMyIssues(
  env: IssuesEnv,
  userId: string,
  householdCode: string,
): Promise<PublicIssue[]> {
  const numbers = (await getJSON<number[]>(env.KV, `userIssues:${userId}`)) ?? [];
  const household = await getJSON<HouseholdSnapshot>(env.KV, `household:${householdCode}`);
  const out: PublicIssue[] = [];
  for (const n of numbers) {
    const rec = await getJSON<IssueRecord>(env.KV, `issue:${n}`);
    if (!rec) continue;
    out.push(await projectIssue(rec, household, userId));
  }
  return out;
}

export async function listHouseholdSuggestions(
  env: IssuesEnv,
  householdCode: string,
  viewerUserId: string,
): Promise<PublicIssue[]> {
  const numbers = (await getJSON<number[]>(env.KV, `householdIssues:${householdCode}`)) ?? [];
  const household = await getJSON<HouseholdSnapshot>(env.KV, `household:${householdCode}`);
  const out: PublicIssue[] = [];
  for (const n of numbers) {
    const rec = await getJSON<IssueRecord>(env.KV, `issue:${n}`);
    if (!rec || rec.type !== 'suggestion') continue;
    out.push(await projectIssue(rec, household, viewerUserId));
  }
  return out;
}

export async function getIssueDetail(
  env: IssuesEnv,
  number: number,
  viewerUserId: string,
  viewerHouseholdCode: string,
): Promise<{
  issue: PublicIssue;
  description: string;
  attachments: { url: string; name: string }[];
  comments: { author: 'developer' | 'reporter'; body: string; createdAt: string }[];
} | null> {
  const rec = await getJSON<IssueRecord>(env.KV, `issue:${number}`);
  if (!rec) return null;
  if (rec.householdCode !== viewerHouseholdCode) return null;

  const household = await getJSON<HouseholdSnapshot>(env.KV, `household:${rec.householdCode}`);
  const issue = await projectIssue(rec, household, viewerUserId);

  const commentsRes = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/issues/${number}/comments`,
    { headers: ghHeaders(env) },
  );
  let comments: { author: 'developer' | 'reporter'; body: string; createdAt: string }[] = [];
  if (commentsRes.ok) {
    const raw = (await commentsRes.json()) as {
      body: string;
      created_at: string;
      author_association: string;
    }[];
    comments = raw.map((c) => ({
      author:
        c.author_association === 'OWNER' || c.author_association === 'MEMBER'
          ? 'developer'
          : 'reporter',
      body: c.body,
      createdAt: c.created_at,
    }));
  }

  return {
    issue,
    description: rec.description,
    attachments: rec.attachments.map((a) => ({ url: a.url, name: a.name })),
    comments,
  };
}

export async function toggleUpvote(
  env: IssuesEnv,
  number: number,
  userId: string,
): Promise<{ upvotes: number; upvotedByMe: boolean } | null> {
  const rec = await getJSON<IssueRecord>(env.KV, `issue:${number}`);
  if (!rec) return null;
  if (rec.upvotes[userId]) {
    delete rec.upvotes[userId];
  } else {
    rec.upvotes[userId] = true;
  }
  await putJSON(env.KV, `issue:${number}`, rec);
  return {
    upvotes: Object.keys(rec.upvotes).length,
    upvotedByMe: !!rec.upvotes[userId],
  };
}

export async function verifyWebhookSignature(
  secret: string,
  signatureHeader: string | null,
  rawBody: string,
): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = signatureHeader.slice('sha256='.length);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (hex.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) {
    diff |= hex.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface UserNotificationPrefs {
  enabled?: boolean;
  issueUpdates?: boolean;
}

async function notifyReporter(
  env: IssuesEnv,
  rec: IssueRecord,
  title: string,
  body: string,
): Promise<void> {
  const prefs = await getJSON<UserNotificationPrefs>(
    env.KV,
    `notif-prefs:${rec.authorUserId}`,
  );
  if (prefs && prefs.enabled === false) return;
  if (prefs && prefs.issueUpdates === false) return;

  const sub = await getJSON<PushSubscription>(env.KV, `subscription:${rec.authorUserId}`);
  if (!sub) return;

  await sendPushNotification(
    sub,
    {
      title,
      body,
      icon: '/meal-prep/icons/icon-192x192.png',
      badge: '/meal-prep/icons/icon-72x72.png',
      tag: `issue-${rec.number}`,
      data: { url: `/meal-prep/issue/${rec.number}` },
      actions: [{ action: 'view', title: 'Pogledaj' }],
    },
    { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
    env.VAPID_SUBJECT,
  );
}

interface WebhookPayload {
  action: string;
  issue?: {
    number: number;
    state: 'open' | 'closed';
    state_reason: string | null;
    labels: { name: string }[];
    updated_at: string;
  };
  comment?: { body: string; user: { login: string } };
  sender?: { login: string };
}

export async function handleWebhook(
  env: IssuesEnv,
  event: string,
  payload: WebhookPayload,
): Promise<void> {
  const issueNumber = payload.issue?.number;
  if (!issueNumber) return;

  const rec = await getJSON<IssueRecord>(env.KV, `issue:${issueNumber}`);
  if (!rec) return;

  if (event === 'issues') {
    const issue = payload.issue!;
    let newState: IssueState = 'open';
    if (issue.state === 'closed') {
      newState = issue.state_reason === 'not_planned' ? 'rejected' : 'resolved';
    } else if (issue.labels.some((l) => l.name === 'in-progress')) {
      newState = 'in_progress';
    }

    if (newState !== rec.state) {
      rec.state = newState;
      rec.updatedAt = issue.updated_at;
      await putJSON(env.KV, `issue:${issueNumber}`, rec);

      if (payload.action === 'closed' || payload.action === 'reopened' || payload.action === 'labeled') {
        await notifyReporter(
          env,
          rec,
          `Tvoja prijava #${rec.number}`,
          `Status: ${STATE_LABELS_SR[newState]}`,
        );
      }
    }
  } else if (event === 'issue_comment' && payload.action === 'created' && payload.comment) {
    rec.updatedAt = new Date().toISOString();
    await putJSON(env.KV, `issue:${issueNumber}`, rec);
    const snippet = payload.comment.body.slice(0, 80);
    await notifyReporter(
      env,
      rec,
      `Razvijač je odgovorio na #${rec.number}`,
      snippet,
    );
  }
}

export async function refreshIssueStateFromGithub(
  env: IssuesEnv,
  number: number,
): Promise<void> {
  const rec = await getJSON<IssueRecord>(env.KV, `issue:${number}`);
  if (!rec) return;
  const fresh = await deriveStateFromGithub(env, number);
  if (!fresh) return;
  if (fresh.state !== rec.state || fresh.updatedAt !== rec.updatedAt) {
    rec.state = fresh.state;
    rec.updatedAt = fresh.updatedAt;
    await putJSON(env.KV, `issue:${number}`, rec);
  }
}

export const ATTACHMENT_LIMITS = {
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_SIZE,
  ALLOWED_MIME,
};

export { sniffMime };
