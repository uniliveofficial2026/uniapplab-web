import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { isStudioEnabled, workspacePersistDir } from "./workspaceRuntimeService";

export type LocalMediaMeta = {
  mimeType: string;
  fileName: string;
  byteSize: number;
  checksumSha256: string;
  assetId?: string;
  status?: string;
  createdAt?: string;
};

export function assetContentPath(id: string): string {
  return `/api/admin/assets/${id}/content`;
}

function mediaDir(): string {
  return workspacePersistDir("media");
}

function localMediaEnabled(): boolean {
  return isStudioEnabled();
}

function mediaFilePath(id: string): string {
  return path.join(mediaDir(), id);
}

function metaFilePath(id: string): string {
  return path.join(mediaDir(), `${id}.meta.json`);
}

export function persistLocalMediaBytes(
  id: string,
  bytes: Buffer,
  mimeType: string,
  fileName: string,
  extra?: Partial<LocalMediaMeta>,
): void {
  if (!localMediaEnabled()) return;
  mkdirSync(mediaDir(), { recursive: true });
  writeFileSync(mediaFilePath(id), bytes);
  writeFileSync(
    metaFilePath(id),
    JSON.stringify({
      mimeType,
      fileName,
      byteSize: bytes.length,
      checksumSha256: createHash("sha256").update(bytes).digest("hex"),
      ...extra,
    }),
  );
}

export function readLocalMediaMeta(id: string): LocalMediaMeta | null {
  if (!localMediaEnabled()) return null;
  const metaPath = metaFilePath(id);
  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(readFileSync(metaPath, "utf8")) as LocalMediaMeta;
  } catch {
    return null;
  }
}

export function readLocalMediaBytes(id: string): Buffer | null {
  if (!localMediaEnabled()) return null;
  const file = mediaFilePath(id);
  if (!existsSync(file)) return null;
  return readFileSync(file);
}

export function hasLocalMediaBytes(id: string): boolean {
  if (!localMediaEnabled()) return false;
  return existsSync(mediaFilePath(id));
}

export function listPersistedMediaIds(): string[] {
  const dir = mediaDir();
  if (!localMediaEnabled() || !existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".meta.json"))
    .map((name) => name.replace(/\.meta\.json$/, ""));
}
