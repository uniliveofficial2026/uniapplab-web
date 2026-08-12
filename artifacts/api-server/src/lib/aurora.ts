/**
 * Amazon Aurora PostgreSQL (Vercel Marketplace aws-apg).
 * Auth / wallets / gifts / realtime stay on Supabase.
 * Media stays on object storage. Mongo stays for flexible docs.
 * Aurora = secondary SQL analytics / metrics warehouse (OIDC + RDS IAM).
 */
import { Signer } from "@aws-sdk/rds-signer";
import { Pool, type QueryResult, type QueryResultRow } from "pg";

function env(name: string): string {
  return String(process.env[name] || "").trim();
}

export function isAuroraConfigured(): boolean {
  return Boolean(
    env("PGHOST") &&
      env("PGUSER") &&
      env("AWS_ROLE_ARN") &&
      env("AWS_REGION") &&
      (env("PGDATABASE") || "postgres"),
  );
}

let poolPromise: Promise<Pool> | null = null;
let schemaReady = false;

async function loadOidcCredentialsProvider() {
  // Dynamic import so local builds without Vercel runtime still typecheck/bundle.
  const mod = await import("@vercel/functions/oidc");
  return mod.awsCredentialsProvider;
}

async function createPool(): Promise<Pool> {
  if (!isAuroraConfigured()) {
    throw new Error("Aurora is not configured (PGHOST / AWS_ROLE_ARN / …)");
  }

  const hostname = env("PGHOST");
  const port = Number(env("PGPORT") || "5432");
  const username = env("PGUSER");
  const region = env("AWS_REGION");
  const database = env("PGDATABASE") || "postgres";
  const roleArn = env("AWS_ROLE_ARN");

  const awsCredentialsProvider = await loadOidcCredentialsProvider();
  const signer = new Signer({
    hostname,
    port,
    username,
    region,
    credentials: awsCredentialsProvider({
      roleArn,
      clientConfig: { region },
    }),
  });

  const pool = new Pool({
    host: hostname,
    user: username,
    database,
    password: async () => signer.getAuthToken(),
    port,
    ssl: { rejectUnauthorized: false },
    // Aurora Serverless can cold-start; keep this generous on Vercel.
    max: 4,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 25_000,
  });

  try {
    const { attachDatabasePool } = await import("@vercel/functions");
    attachDatabasePool(pool);
  } catch {
    // Local / non-Vercel — pool still works without attachDatabasePool.
  }

  return pool;
}

export async function getAuroraPool(): Promise<Pool> {
  if (!poolPromise) {
    poolPromise = createPool().catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_metrics (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT,
      event_type TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS app_metrics_created_at_idx ON app_metrics (created_at DESC);
    CREATE INDEX IF NOT EXISTS app_metrics_event_type_idx ON app_metrics (event_type);
  `);
  schemaReady = true;
}

export async function pingAurora(): Promise<{
  ok: boolean;
  db?: string;
  host?: string;
  reason?: string;
}> {
  if (!isAuroraConfigured()) {
    return { ok: false, reason: "not_configured" };
  }
  try {
    const pool = await getAuroraPool();
    const result = await pool.query<{ db: string; now: Date }>(
      "SELECT current_database() AS db, NOW() AS now",
    );
    await ensureSchema(pool);
    return {
      ok: true,
      db: result.rows[0]?.db,
      host: env("PGHOST").split(".")[0] || undefined,
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function auroraQuery<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  const pool = await getAuroraPool();
  await ensureSchema(pool);
  return pool.query<T>(sql, params);
}

/** Fire-and-forget structured metric row (SQL analytics lane). */
export async function insertAuroraMetric(input: {
  userId?: string | null;
  type: string;
  payload?: Record<string, unknown>;
}): Promise<string | null> {
  if (!isAuroraConfigured()) return null;
  try {
    const result = await auroraQuery<{ id: string }>(
      `INSERT INTO app_metrics (user_id, event_type, payload)
       VALUES ($1, $2, $3::jsonb)
       RETURNING id::text`,
      [
        input.userId ?? null,
        String(input.type).slice(0, 120),
        JSON.stringify(input.payload ?? {}),
      ],
    );
    return result.rows[0]?.id ?? null;
  } catch (err) {
    console.warn("[aurora] insert failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
