/**
 * MongoDB Atlas (Vercel Marketplace) — document / event store.
 * Keep auth, wallets, gifts settle, profiles, and realtime in Supabase.
 * Keep media bytes in object storage (R2 / Railway bucket).
 */
import { MongoClient, type Db, type Collection, type Document } from "mongodb";

let clientPromise: Promise<MongoClient> | null = null;

function env(name: string): string {
  return String(process.env[name] || "").trim();
}

export function isMongoConfigured(): boolean {
  const uri = env("MONGODB_URI");
  return uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://");
}

export function getMongoDbName(): string {
  return env("MONGODB_DB") || "uniapplab";
}

async function getClient(): Promise<MongoClient> {
  if (!isMongoConfigured()) {
    throw new Error("MONGODB_URI is not configured");
  }
  if (!clientPromise) {
    const client = new MongoClient(env("MONGODB_URI"), {
      maxPoolSize: 8,
      serverSelectionTimeoutMS: 5_000,
    });
    clientPromise = client.connect().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

export async function getMongoDb(): Promise<Db> {
  const client = await getClient();
  return client.db(getMongoDbName());
}

export async function getMongoCollection<T extends Document = Document>(
  name: string,
): Promise<Collection<T>> {
  const db = await getMongoDb();
  return db.collection<T>(name);
}

export async function pingMongo(): Promise<{
  ok: boolean;
  db?: string;
  reason?: string;
}> {
  if (!isMongoConfigured()) {
    return { ok: false, reason: "not_configured" };
  }
  try {
    const db = await getMongoDb();
    await db.command({ ping: 1 });
    return { ok: true, db: getMongoDbName() };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Fire-and-forget document insert for AI / analytics / audit logs. */
export async function insertMongoDoc(
  collection: string,
  doc: Record<string, unknown>,
): Promise<string | null> {
  if (!isMongoConfigured()) return null;
  try {
    const col = await getMongoCollection(collection);
    const result = await col.insertOne({
      ...doc,
      createdAt: doc.createdAt ?? new Date(),
    });
    return String(result.insertedId);
  } catch (err) {
    console.warn("[mongo] insert failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
