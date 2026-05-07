export type IssueType = 'bug' | 'suggestion' | 'question';

export interface IssueAttachment {
  url: string;
  name: string;
}

export interface IssueDraft {
  type: IssueType;
  title: string;
  description: string;
  attachments: IssueAttachment[];
  context: IssueContext;
}

export interface IssueContext {
  route: string;
  appVersion: string;
  appCommit: string;
  userAgent: string;
  viewport: string;
  timestamp: string;
}

export type IssueState = 'open' | 'in_progress' | 'resolved' | 'rejected';

export interface IssueRecord {
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

export interface IssueDetail {
  issue: IssueRecord;
  description: string;
  attachments: IssueAttachment[];
  comments: IssueComment[];
}

export interface IssueComment {
  author: 'developer' | 'user';
  authorName?: string;
  body: string;
  createdAt: string;
}

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  bug: 'Greška',
  suggestion: 'Predlog',
  question: 'Pitanje',
};

export const ISSUE_STATE_LABELS: Record<IssueState, string> = {
  open: 'Otvoreno',
  in_progress: 'U obradi',
  resolved: 'Rešeno',
  rejected: 'Odbačeno',
};
