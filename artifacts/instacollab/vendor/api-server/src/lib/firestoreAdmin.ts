import { createSign } from "node:crypto";
import type { ProfileRecord } from "./supabase";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

function firebaseProjectId(): string | null {
  return (
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    process.env.VITE_FIREBASE_PROJECT_ID?.trim() ||
    null
  );
}

function parseServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    return null;
  }
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function getFirestoreAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const sa = parseServiceAccount();
  if (!sa?.client_email || !sa.private_key) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/datastore",
    }),
  );
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(sa.private_key.replace(/\\n/g, "\n"));
  const jwt = `${unsigned}.${base64Url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) return null;

  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) return null;

  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return body.access_token;
}

function parseFirestoreValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if ("stringValue" in record) return record.stringValue;
  if ("integerValue" in record) return Number(record.integerValue);
  if ("doubleValue" in record) return Number(record.doubleValue);
  if ("booleanValue" in record) return record.booleanValue;
  if ("nullValue" in record) return null;
  if ("timestampValue" in record) return record.timestampValue;
  if ("arrayValue" in record) {
    const values = (record.arrayValue as { values?: unknown[] })?.values ?? [];
    return values.map((entry) => parseFirestoreValue(entry));
  }
  if ("mapValue" in record) {
    const fields = (record.mapValue as { fields?: Record<string, unknown> })?.fields ?? {};
    return parseFirestoreFields(fields);
  }
  return null;
}

function parseFirestoreFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = parseFirestoreValue(value);
  }
  return out;
}

export async function fetchFirestoreDocument(
  collectionPath: string,
  docId: string,
): Promise<Record<string, unknown> | null> {
  const projectId = firebaseProjectId() || parseServiceAccount()?.project_id || null;
  const token = await getFirestoreAccessToken();
  if (!projectId || !token) return null;

  const path = `${collectionPath}/${docId}`;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;

  const body = (await res.json()) as { fields?: Record<string, unknown> };
  if (!body.fields) return null;
  return parseFirestoreFields(body.fields);
}

export async function fetchFirebaseProfileRecord(userId: string): Promise<ProfileRecord | null> {
  const data = await fetchFirestoreDocument("profiles", userId);
  if (!data) return null;
  return {
    id: userId,
    username: String(data.username ?? ""),
    display_name: String(data.display_name ?? ""),
    avatar_url: (data.avatar_url as string | null) ?? null,
    bio: (data.bio as string | null) ?? null,
    role: String(data.role ?? "user"),
    banned_at: (data.banned_at as string | null) ?? null,
    ban_reason: (data.ban_reason as string | null) ?? null,
    muted_until: (data.muted_until as string | null) ?? null,
    profile_setup_complete: Boolean(data.profile_setup_complete),
    public_user_id: (data.public_user_id as string | null) ?? null,
  };
}

export type FirestorePartyRoomRecord = {
  id: string;
  owner_id: string;
  status: string;
  privacy: string;
};

export async function fetchFirestorePartyRoom(
  roomId: string,
): Promise<FirestorePartyRoomRecord | null> {
  const data = await fetchFirestoreDocument("party_rooms", roomId);
  if (!data) return null;
  return {
    id: roomId,
    owner_id: String(data.owner_id ?? ""),
    status: String(data.status ?? "active"),
    privacy: String(data.privacy ?? "Public"),
  };
}

export function isFirestoreAdminAvailable(): boolean {
  return Boolean(parseServiceAccount() && (firebaseProjectId() || parseServiceAccount()?.project_id));
}

export async function upsertFirestoreDocument(
  collectionPath: string,
  docId: string,
  fields: Record<string, string | null>,
): Promise<boolean> {
  const projectId = firebaseProjectId() || parseServiceAccount()?.project_id || null;
  const token = await getFirestoreAccessToken();
  if (!projectId || !token) return false;

  const firestoreFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    firestoreFields[key] =
      value === null ? { nullValue: null } : { stringValue: String(value) };
  }

  const path = `${collectionPath}/${docId}`;
  const mask = Object.keys(fields)
    .map((field) => `updateMask.fieldPaths=${field}`)
    .join("&");
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}?${mask}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: firestoreFields }),
  });
  if (res.ok) return true;

  const createUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}?documentId=${docId}`;
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: firestoreFields }),
  });
  return createRes.ok;
}
