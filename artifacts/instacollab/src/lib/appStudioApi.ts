/**
 * Studio API — edits the real app via local control plane (not the admin panel UI).
 * Uses same-origin /api/admin/* proxied to api-server in dev.
 */

const TOKEN_KEY = 'unilives_studio_admin_token';

function studioApiUrl(path: string): string {
  const normalized = path.startsWith('/api/admin') ? path : `/api/admin${path.startsWith('/') ? path : `/${path}`}`;
  return normalized;
}

export function readStudioToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeStudioToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* private mode */
  }
}

async function studioRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  let token = readStudioToken();
  if (!token) {
    token = await mintStudioToken();
    if (token) writeStudioToken(token);
  }
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(studioApiUrl(path), { ...init, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String((json as { error?: string; code?: string }).error || (json as { code?: string }).code || res.statusText));
  }
  return json as T;
}

export async function mintStudioToken(): Promise<string | null> {
  try {
    const res = await fetch(studioApiUrl('/dev/handoff/mint-local'), {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { token?: string };
    const token = body.token?.trim();
    return token && (token.startsWith('eyJ') || token.startsWith('dev-local.')) ? token : null;
  } catch {
    return null;
  }
}

export type StudioResourceDetail = {
  resourceId: string;
  name: string;
  type: string;
  domain: string;
  status: string;
  componentId?: string | null;
  sourcePath?: string | null;
  routeKey?: string | null;
};

export async function studioResourceDetail(resourceId: string): Promise<StudioResourceDetail> {
  return studioRequest(`/ui/clone-catalog/${encodeURIComponent(resourceId)}`);
}

export async function studioResourceSearch(q: string): Promise<Array<{ resourceId: string; name: string; type: string }>> {
  const res = await studioRequest<{ items?: Array<{ resourceId: string; name: string; type: string }> }>(
    `/ui/clone-catalog?q=${encodeURIComponent(q)}&limit=16&offset=0`,
  );
  return res.items || [];
}

export async function studioCreateDraft(resourceId: string, patch: Record<string, unknown>): Promise<unknown> {
  return studioRequest(`/access/resources/${encodeURIComponent(resourceId)}/drafts`, {
    method: 'POST',
    body: JSON.stringify({ patch }),
  });
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

export async function studioUploadMedia(file: File, assetId?: string): Promise<{ id: string; publicUrl?: string | null }> {
  const slug = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const id = assetId || `asset.studio.${slug || 'file'}.${Date.now()}`;
  const rec = await studioRequest<{ id: string; publicUrl?: string | null }>('/assets/upload-local', {
    method: 'POST',
    body: JSON.stringify({
      assetId: id,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      dataBase64: await fileToBase64(file),
    }),
  });
  return rec;
}

export function resourceIdCandidatesFromPick(pick: {
  resourceId?: string | null;
  nodeId?: string | null;
  componentId?: string | null;
  unilivesAttr?: string | null;
}): string[] {
  const out: string[] = [];
  const push = (id?: string | null) => {
    const trimmed = String(id || '').trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
  };
  push(pick.resourceId);
  push(pick.nodeId);
  if (pick.componentId) {
    const raw = pick.componentId.trim();
    push(raw);
    push(`component.${raw}`);
    const noVersion = raw.replace(/\.v\d+(\.\d+)*$/i, '');
    push(noVersion);
    push(`component.${noVersion}`);
  }
  if (pick.unilivesAttr) {
    const slug = pick.unilivesAttr.replace(/^data-unilives-/, '').replace(/-/g, '.');
    push(`element.${slug}`);
    push(`component.${slug}`);
  }
  return out;
}

export async function resolveStudioResource(pick: {
  resourceId?: string | null;
  nodeId?: string | null;
  componentId?: string | null;
  unilivesAttr?: string | null;
  label?: string;
  domPath?: string;
}): Promise<{ detail: StudioResourceDetail | null; candidates: string[]; hits: Array<{ resourceId: string; name: string; type: string }> }> {
  const candidates = resourceIdCandidatesFromPick(pick);
  for (const id of candidates) {
    try {
      const detail = await studioResourceDetail(id);
      return { detail, candidates, hits: [] };
    } catch {
      /* next */
    }
  }
  const q = candidates[0] || pick.label || pick.domPath || '';
  const hits = q ? await studioResourceSearch(q).catch(() => []) : [];
  return { detail: null, candidates, hits };
}
