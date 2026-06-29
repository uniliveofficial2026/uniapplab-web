import type { LocalGameBundleFile } from './types';

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

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
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  return 'application/octet-stream';
}

async function inflateRawDeflate(compressed: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(compressed);
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

function findEndOfCentralDirectory(view: DataView): number {
  const maxComment = 0xffff;
  const start = Math.max(0, view.byteLength - (22 + maxComment));
  for (let i = view.byteLength - 22; i >= start; i -= 1) {
    if (view.getUint32(i, true) === EOCD_SIG) return i;
  }
  return -1;
}

/** Extract ZIP entries (store + deflate) into vault-ready file records. */
export async function extractZipArchive(buffer: ArrayBuffer): Promise<LocalGameBundleFile[]> {
  const view = new DataView(buffer);
  const eocdOffset = findEndOfCentralDirectory(view);
  if (eocdOffset < 0) {
    throw new Error('Invalid ZIP archive (missing end record).');
  }

  const centralDirOffset = view.getUint32(eocdOffset + 16, true);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const files: LocalGameBundleFile[] = [];
  let offset = centralDirOffset;

  for (let i = 0; i < entryCount; i += 1) {
    if (view.getUint32(offset, true) !== CEN_SIG) break;

    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);

    const nameBytes = new Uint8Array(buffer, offset + 46, fileNameLength);
    const path = new TextDecoder().decode(nameBytes).replace(/\\/g, '/');
    offset += 46 + fileNameLength + extraLength + commentLength;

    if (!path || path.endsWith('/')) continue;

    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = new Uint8Array(buffer, dataStart, compressedSize);

    let data: Uint8Array;
    if (compression === 0) {
      data = compressed;
    } else if (compression === 8) {
      data = await inflateRawDeflate(compressed);
      if (uncompressedSize > 0 && data.byteLength !== uncompressedSize) {
        // Some archives pad differently; keep inflated payload if non-empty.
        if (data.byteLength === 0) {
          throw new Error(`Failed to decompress ${path}`);
        }
      }
    } else {
      throw new Error(`Unsupported ZIP compression for ${path} (method ${compression}).`);
    }

    const copy = data.slice();
    files.push({
      path,
      mime: mimeForPath(path),
      data: copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength),
    });
  }

  if (files.length === 0) {
    throw new Error('ZIP archive contains no playable files.');
  }

  return files;
}
