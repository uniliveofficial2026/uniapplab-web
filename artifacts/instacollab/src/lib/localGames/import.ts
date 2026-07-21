import type { LocalGameCatalogEntry } from './catalog';
import type { LocalGameBundle, LocalGameBundleFile, LocalGameRecord } from './types';
import { extractBundleCover, extractHtmlInlineCover } from './cover';
import { gradientForGameName } from './format';
import { deleteLocalGameBundle, saveLocalGameBundle } from './vault';
import { normalizeBundleFiles } from './vfs';
import { extractZipArchive } from './zip';

const WEB_ENTRY_CANDIDATES = [
  'index.html',
  'Index.html',
  'game.html',
  'main.html',
  'play.html',
];

const NATIVE_EXTENSIONS = new Set(['exe', 'app', 'dmg', 'deb', 'rpm', 'msi', 'bat', 'cmd']);

function mimeForPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html';
  if (lower.endsWith('.js') || lower.endsWith('.mjs')) return 'text/javascript';
  if (lower.endsWith('.css')) return 'text/css';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.wasm')) return 'application/wasm';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, '') || fileName;
}

function extensionOf(fileName: string): string {
  const match = fileName.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

function fileNameFromPath(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

function pickWebEntryPath(files: LocalGameBundleFile[]): string {
  const normalized = new Map(files.map((f) => [f.path.replace(/^\.?\//, ''), f]));
  for (const candidate of WEB_ENTRY_CANDIDATES) {
    if (normalized.has(candidate)) return candidate;
  }
  const htmlFiles = files
    .filter((f) => /\.html?$/i.test(f.path))
    .map((f) => f.path.replace(/^\.?\//, ''))
    .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
  if (htmlFiles[0]) return htmlFiles[0];
  throw new Error('No HTML entry point found. Include index.html or upload a single .html game.');
}

async function fileToBundleFile(file: File, path?: string): Promise<LocalGameBundleFile> {
  return {
    path: (path ?? file.name).replace(/^\.?\//, ''),
    mime: file.type || mimeForPath(file.name),
    data: await file.arrayBuffer(),
  };
}

type ImportFileOptions = {
  id?: string;
  catalogId?: string;
  catalogZipRevision?: string;
  productionAppUrl?: string;
  embeddedAppUrl?: string;
};

export async function importGameFile(
  file: File,
  options: ImportFileOptions = {},
): Promise<LocalGameRecord> {
  const ext = extensionOf(file.name);
  const id = options.id ?? `l_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let bundle: LocalGameBundle;

  if (ext === 'zip') {
    const extracted = await extractZipArchive(await file.arrayBuffer());
    const files = normalizeBundleFiles(extracted);
    if (files.length === 0) {
      throw new Error('ZIP archive contains no playable files after cleanup.');
    }
    const entryPath = pickWebEntryPath(files);
    bundle = { id, playKind: 'web', entryPath, files };
  } else if (ext === 'html' || ext === 'htm') {
    const bundleFile = await fileToBundleFile(file);
    bundle = {
      id,
      playKind: 'web',
      entryPath: bundleFile.path,
      files: [bundleFile],
    };
  } else if (NATIVE_EXTENSIONS.has(ext)) {
    const bundleFile = await fileToBundleFile(file);
    bundle = {
      id,
      playKind: 'native',
      entryPath: bundleFile.path,
      files: [bundleFile],
    };
  } else {
    throw new Error(
      'Unsupported file type. Upload .html, .zip (web game), or a desktop executable (.exe, .app).',
    );
  }

  // Replacing a catalog seed with the same id — clear previous bundle first.
  if (options.id) {
    await deleteLocalGameBundle(options.id).catch(() => undefined);
  }
  await saveLocalGameBundle(bundle);

  let coverUrl = (await extractBundleCover(bundle.files)) ?? undefined;
  if (!coverUrl && (ext === 'html' || ext === 'htm')) {
    const html = new TextDecoder().decode(bundle.files[0].data);
    coverUrl = (await extractHtmlInlineCover(html)) ?? undefined;
  }

  const name = stripExtension(file.name);
  return {
    id,
    name,
    status: bundle.playKind === 'web' ? 'Ready' : 'Installed',
    playtime: '0m',
    image: gradientForGameName(name),
    coverUrl,
    fileName: file.name,
    sizeBytes: file.size,
    playKind: bundle.playKind,
    entryPath: bundle.entryPath,
    totalPlayMs: 0,
    importedAt: Date.now(),
    catalogId: options.catalogId,
    catalogZipRevision: options.catalogZipRevision,
    productionAppUrl: options.productionAppUrl,
    embeddedAppUrl: options.embeddedAppUrl,
  };
}

/** Fetch the shipped production ZIP and import it exactly like a manual upload. */
export async function importCatalogGame(entry: LocalGameCatalogEntry): Promise<LocalGameRecord> {
  const res = await fetch(entry.zipUrl, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Could not download ${entry.zipFileName} (${res.status}).`);
  }
  const blob = await res.blob();
  const file = new File([blob], entry.zipFileName, {
    type: blob.type || 'application/zip',
  });
  // ZIP bytes untouched — same importGameFile path as the file picker.
  // Prefer :3000 fixed UI; fall back to UniLive embed built from the same package.
  return importGameFile(file, {
    id: entry.id,
    catalogId: entry.id,
    catalogZipRevision: entry.zipRevision,
    productionAppUrl: entry.productionAppUrl,
    embeddedAppUrl: entry.embeddedAppUrl,
  });
}

export async function importGameFolder(files: FileList | File[]): Promise<LocalGameRecord> {
  const list = Array.from(files).filter((f) => f.size > 0);
  if (list.length === 0) {
    throw new Error('No files selected from folder.');
  }

  const bundleFiles: LocalGameBundleFile[] = [];
  for (const file of list) {
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    bundleFiles.push(await fileToBundleFile(file, relative));
  }

  const normalized = normalizeBundleFiles(bundleFiles);
  const entryPath = pickWebEntryPath(normalized);
  const id = `l_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const displayRoot = stripExtension(fileNameFromPath(entryPath));
  const totalBytes = normalized.reduce((sum, f) => sum + f.data.byteLength, 0);

  const bundle: LocalGameBundle = {
    id,
    playKind: 'web',
    entryPath,
    files: normalized,
  };
  await saveLocalGameBundle(bundle);

  const coverUrl = (await extractBundleCover(normalized)) ?? undefined;

  return {
    id,
    name: displayRoot,
    status: 'Ready',
    playtime: '0m',
    image: gradientForGameName(displayRoot),
    coverUrl,
    fileName: `${displayRoot} (folder)`,
    sizeBytes: totalBytes,
    playKind: 'web',
    entryPath,
    totalPlayMs: 0,
    importedAt: Date.now(),
  };
}
