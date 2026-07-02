import crypto from 'node:crypto';

const LINEAR_API = 'https://api.linear.app/graphql';

export function isLinearConfigured() {
  return Boolean(process.env.LINEAR_API_KEY?.trim());
}

export async function linearGraphql(query, variables = {}) {
  const key = process.env.LINEAR_API_KEY?.trim();
  if (!key) throw new Error('LINEAR_API_KEY not set');

  const res = await fetch(LINEAR_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: key,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20_000),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Linear HTTP ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  }
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  return json.data;
}

export async function getViewer() {
  if (!isLinearConfigured()) return null;
  const data = await linearGraphql(`
    query Viewer {
      viewer {
        id
        name
        email
      }
    }
  `);
  return data?.viewer ?? null;
}

export async function listTeams() {
  if (!isLinearConfigured()) return [];
  const data = await linearGraphql(`
    query Teams {
      teams {
        nodes {
          id
          key
          name
        }
      }
    }
  `);
  return data?.teams?.nodes ?? [];
}

export async function createIssue({ title, description, teamId, priority, labelIds }) {
  if (!isLinearConfigured()) return null;

  const resolvedTeamId = teamId?.trim() || process.env.LINEAR_TEAM_ID?.trim();
  if (!resolvedTeamId) {
    throw new Error('LINEAR_TEAM_ID required to create issues');
  }

  const data = await linearGraphql(
    `
      mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            url
            title
          }
        }
      }
    `,
    {
      input: {
        teamId: resolvedTeamId,
        title: title.slice(0, 255),
        description: description?.slice(0, 50_000) || undefined,
        priority: priority ?? undefined,
        labelIds: labelIds?.length ? labelIds : undefined,
      },
    },
  );

  if (!data?.issueCreate?.success) return null;
  return data.issueCreate.issue;
}

export function verifyLinearWebhook(rawBody, signature) {
  const secret = process.env.LINEAR_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;

  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const digest = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const expected = Buffer.from(digest, 'hex');
  const received = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}
