export type LinearIssueInput = {
  title: string;
  description?: string;
  teamId?: string;
  priority?: number;
  labelIds?: string[];
};

export type LinearIssue = {
  id: string;
  identifier: string;
  url: string;
  title: string;
};

export type LinearViewer = {
  id: string;
  name: string;
  email: string;
};

export type LinearTeam = {
  id: string;
  key: string;
  name: string;
};

export function isLinearConfigured(): boolean;

export function linearGraphql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T>;

export function getViewer(): Promise<LinearViewer | null>;

export function listTeams(): Promise<LinearTeam[]>;

export function createIssue(input: LinearIssueInput): Promise<LinearIssue | null>;

export function verifyLinearWebhook(
  rawBody: string | Buffer,
  signature: string | undefined,
): boolean;
