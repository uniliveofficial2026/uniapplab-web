import { createHash } from "node:crypto";
import { assetUploadIntentSchema } from "@workspace/api-zod";
import { newId, nowIso, store, type AssetQuarantineRow } from "./repositories/memoryStore";
import { assetContentPath, hasLocalMediaBytes, listPersistedMediaIds, persistLocalMediaBytes, readLocalMediaBytes, readLocalMediaMeta } from "./localMediaStorage";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/aac",
  "audio/mp4",
  "audio/ogg",
  "application/json",
  "application/octet-stream",
]);

export function createUploadIntent(input: unknown, actorId: string): AssetQuarantineRow {
  const body = assetUploadIntentSchema.parse(input);
  if (!ALLOWED_MIME.has(body.mimeType)) {
    throw Object.assign(new Error("invalid MIME"), { status: 400, code: "asset.mime" });
  }
  const ext = body.fileName.split(".").pop()?.toLowerCase() || "";
  if (body.mimeType === "application/octet-stream" && ext !== "svga") {
    throw Object.assign(new Error("invalid binary MIME"), { status: 400, code: "asset.mime" });
  }
  if (body.mimeType === "image/svg+xml" && /<script|onload=|javascript:/i.test(body.fileName)) {
    throw Object.assign(new Error("malicious SVG rejected"), { status: 400, code: "asset.svg" });
  }
  const row: AssetQuarantineRow = {
    id: newId(),
    assetId: body.assetId,
    fileName: body.fileName,
    mimeType: body.mimeType,
    byteSize: body.byteSize,
    checksumSha256: body.checksumSha256,
    status: "quarantined",
    createdBy: actorId,
    createdAt: nowIso(),
    approvedAt: null,
    publicUrl: null,
  };
  store.assets.set(row.id, row);
  return row;
}

export function validateAsset(id: string): AssetQuarantineRow {
  const rec = store.assets.get(id);
  if (!rec) throw Object.assign(new Error("not found"), { status: 404, code: "error.notFound" });
  if (rec.mimeType === "image/svg+xml" && rec.fileName.toLowerCase().includes(".svg") === false) {
    rec.status = "rejected";
    throw Object.assign(new Error("invalid SVG"), { status: 400, code: "asset.svg" });
  }
  return rec;
}

export function approveAsset(id: string): AssetQuarantineRow {
  const rec = validateAsset(id);
  if (rec.status === "published") return rec;
  rec.status = "approved";
  rec.approvedAt = nowIso();
  if (store.assetBytes.has(id) || hasLocalMediaBytes(id)) {
    rec.publicUrl = assetContentPath(id);
  }
  store.assets.set(id, rec);
  return rec;
}

export function listAssets(): AssetQuarantineRow[] {
  const byId = new Map<string, AssetQuarantineRow>();
  for (const row of store.assets.values()) {
    byId.set(row.id, { ...row, publicUrl: assetHasContent(row.id) ? assetContentPath(row.id) : row.publicUrl });
  }
  for (const id of listPersistedMediaIds()) {
    if (byId.has(id)) continue;
    const meta = readLocalMediaMeta(id);
    if (!meta) continue;
    byId.set(id, {
      id,
      assetId: meta.assetId || `asset.local.${id.slice(0, 8)}`,
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      byteSize: meta.byteSize,
      checksumSha256: meta.checksumSha256,
      status: (meta.status as AssetQuarantineRow["status"]) || "approved",
      createdBy: "local-media",
      createdAt: meta.createdAt || new Date(0).toISOString(),
      approvedAt: meta.createdAt || null,
      publicUrl: assetContentPath(id),
    });
  }
  return [...byId.values()];
}

export function uploadLocalAsset(
  input: { assetId: string; fileName: string; mimeType: string; dataBase64: string },
  actorId: string,
): AssetQuarantineRow {
  const buf = Buffer.from(input.dataBase64, "base64");
  const checksumSha256 = createHash("sha256").update(buf).digest("hex");
  const row = createUploadIntent(
    {
      assetId: input.assetId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      byteSize: buf.length,
      checksumSha256,
    },
    actorId,
  );
  store.assetBytes.set(row.id, buf);
  persistLocalMediaBytes(row.id, buf, row.mimeType, row.fileName, {
    assetId: row.assetId,
    status: row.status,
    createdAt: row.createdAt,
  });
  row.publicUrl = assetContentPath(row.id);
  store.assets.set(row.id, row);
  return row;
}

export function getAssetBytes(id: string): { row: AssetQuarantineRow; bytes: Buffer } {
  let row = store.assets.get(id);
  if (!row) {
    const meta = readLocalMediaMeta(id);
    if (meta) {
      row = {
        id,
        assetId: meta.assetId || `asset.local.${id.slice(0, 8)}`,
        fileName: meta.fileName,
        mimeType: meta.mimeType,
        byteSize: meta.byteSize,
        checksumSha256: meta.checksumSha256,
        status: (meta.status as AssetQuarantineRow["status"]) || "approved",
        createdBy: "local-media",
        createdAt: meta.createdAt || new Date(0).toISOString(),
        approvedAt: meta.createdAt || null,
        publicUrl: assetContentPath(id),
      };
      store.assets.set(id, row);
    }
  }
  if (!row) throw Object.assign(new Error("not found"), { status: 404, code: "error.notFound" });
  let bytes = store.assetBytes.get(id);
  if (!bytes) {
    bytes = readLocalMediaBytes(id) ?? undefined;
    if (bytes) store.assetBytes.set(id, bytes);
  }
  if (!bytes) throw Object.assign(new Error("no content"), { status: 404, code: "asset.noContent" });
  return { row, bytes };
}

export function assetHasContent(id: string): boolean {
  return store.assetBytes.has(id) || hasLocalMediaBytes(id);
}
