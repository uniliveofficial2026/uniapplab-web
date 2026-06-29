import type { LocalGameBundle, LocalGameBundleFile, LocalGameRecord } from './types';
import { extractBundleCover, extractHtmlInlineCover } from './cover';
import { gradientForGameName } from './format';
import { saveLocalGameBundle } from './vault';
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

function pickWebEntryPath(files: LocalGameBundleFile[]): string {
  const normalized = new Map(files.map((f) => [f.path.replace(/^\.?\//, ''), f]));
  for (const candidate of WEB_ENTRY_CANDIDATES) {
    if (normalized.has(candidate)) return candidate;
  }
  const html = files.find((f) => /\.html?$/i.test(f.path));
  if (html) return html.path.replace(/^\.?\//, '');
  throw new Error('No HTML entry point found. Include index.html or upload a single .html game.');
}

async function fileToBundleFile(file: File, path?: string): Promise<LocalGameBundleFile> {
  return {
    path: (path ?? file.name).replace(/^\.?\//, ''),
    mime: file.type || mimeForPath(file.name),
    data: await file.arrayBuffer(),
  };
}

export async function importGameFile(file: File): Promise<LocalGameRecord> {
  const ext = extensionOf(file.name);
  const id = `l_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let bundle: LocalGameBundle;

  if (ext === 'zip') {
    const files = await extractZipArchive(await file.arrayBuffer());
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
      'Unsupported file type. Upload .html, .zip (web game), or a desktop executable (.exe, .app).'
    );
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
  };
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

  const entryPath = pickWebEntryPath(bundleFiles);
  const id = `l_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const rootName = entryPath.split('/')[0] ?? stripExtension(entryPath);
  const totalBytes = bundleFiles.reduce((sum, f) => sum + f.data.byteLength, 0);

  const bundle: LocalGameBundle = {
    id,
    playKind: 'web',
    entryPath,
    files: bundleFiles,
  };
  await saveLocalGameBundle(bundle);

  const coverUrl = (await extractBundleCover(bundleFiles)) ?? undefined;
  const displayName = stripExtension(rootName.includes('/') ? rootName.split('/')[0] : entryPath);

  return {
    id,
    name: displayName,
    status: 'Ready',
    playtime: '0m',
    image: gradientForGameName(displayName),
    coverUrl,
    fileName: `${displayName} (folder)`,
    sizeBytes: totalBytes,
    playKind: 'web',
    entryPath,
    totalPlayMs: 0,
    importedAt: Date.now(),
  };
}
