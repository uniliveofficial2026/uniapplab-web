import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

type DbSchema = typeof schema;

let poolInstance: pg.Pool | null = null;
let dbInstance: NodePgDatabase<DbSchema> | null = null;

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  return url;
}

export function getPool(): pg.Pool {
  if (!poolInstance) {
    poolInstance = new Pool({ connectionString: requireDatabaseUrl() });
  }
  return poolInstance;
}

export function getDb(): NodePgDatabase<DbSchema> {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
}

/** Lazy pool — does not connect until first use. */
export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_target, prop, receiver) {
    return Reflect.get(getPool(), prop, receiver);
  },
});

/** Lazy db — does not require DATABASE_URL until first query. */
export const db: NodePgDatabase<DbSchema> = new Proxy({} as NodePgDatabase<DbSchema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export async function closeDb(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
    dbInstance = null;
  }
}

export * from "./schema";
