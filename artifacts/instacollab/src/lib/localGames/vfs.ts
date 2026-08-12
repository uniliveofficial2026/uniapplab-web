import type { LocalGameBundle, LocalGameBundleFile } from './types';

/** Normalize archive paths and drop junk / shared root folders. */
export function normalizeBundleFiles(files: LocalGameBundleFile[]): LocalGameBundleFile[] {
  const cleaned = files
    .map((file) => ({
      ...file,
      path: file.path.replace(/\\/g, '/').replace(/^\.?\//, ''),
    }))
    .filter((file) => {
      if (!file.path || file.path.endsWith('/')) return false;
      if (file.path.startsWith('__MACOSX/')) return false;
      if (file.path.split('/').some((part) => part.startsWith('._'))) return false;
      return true;
    });

  if (cleaned.length === 0) return cleaned;

  const first = cleaned[0].path;
  const slash = first.indexOf('/');
  if (slash <= 0) return cleaned;
  const root = first.slice(0, slash + 1);
  if (!cleaned.every((file) => file.path.startsWith(root))) return cleaned;

  return cleaned.map((file) => ({
    ...file,
    path: file.path.slice(root.length),
  }));
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.?\//, '');
}

export function dirnamePath(path: string): string {
  const normalized = normalizePath(path);
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(0, idx + 1) : '';
}

export function joinPath(baseDir: string, relative: string): string {
  const stack = baseDir ? baseDir.replace(/\/$/, '').split('/').filter(Boolean) : [];
  for (const part of relative.replace(/^\.?\//, '').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function rewriteHtmlForLocalPlay(html: string, baseHref: string): string {
  let out = html;
  const hasBase = /<base\b/i.test(out);
  const baseTag = `<base href="${escapeHtmlAttr(baseHref)}">`;
  if (!hasBase) {
    if (/<head[^>]*>/i.test(out)) {
      out = out.replace(/<head[^>]*>/i, (match) => `${match}\n    ${baseTag}`);
    } else if (/<html[^>]*>/i.test(out)) {
      out = out.replace(/<html[^>]*>/i, (match) => `${match}\n<head>${baseTag}</head>`);
    } else {
      out = `<!DOCTYPE html><html><head>${baseTag}</head><body>${out}</body></html>`;
    }
  }
  return out;
}

function mapBundlePath(
  path: string,
  entryDir: string,
  blobUrls: Map<string, string>,
): string | null {
  const cleaned = normalizePath(path.split('?')[0].split('#')[0]);
  if (!cleaned) return null;
  if (blobUrls.has(cleaned)) return blobUrls.get(cleaned)!;
  const joined = joinPath(entryDir, cleaned);
  if (blobUrls.has(joined)) return blobUrls.get(joined)!;
  const abs = cleaned.replace(/^\//, '');
  if (blobUrls.has(abs)) return blobUrls.get(abs)!;
  const absJoined = joinPath(entryDir, abs);
  if (blobUrls.has(absJoined)) return blobUrls.get(absJoined)!;
  return null;
}

function rewriteCssUrls(css: string, fileDir: string, blobUrls: Map<string, string>): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, _q: string, path: string) => {
    if (/^(blob:|data:|https?:|\/\/)/i.test(path)) return full;
    const mapped = mapBundlePath(path, fileDir, blobUrls);
    return mapped ? `url("${mapped}")` : full;
  });
}

function buildVfsPatch(vfsJson: string, entryDir: string): string {
  return `<script data-local-game-vfs="1">
(function(){
  var vfs = ${vfsJson};
  var entryDir = ${JSON.stringify(entryDir)};
  function normalize(path){
    return String(path||'').replace(/^\\.\\//,'').replace(/^\\//,'');
  }
  function join(baseDir, rel){
    var stack = baseDir ? baseDir.replace(/\\/$/,'').split('/').filter(Boolean) : [];
    String(rel||'').replace(/^\\.\\//,'').split('/').forEach(function(part){
      if(!part || part==='.') return;
      if(part==='..') stack.pop();
      else stack.push(part);
    });
    return stack.join('/');
  }
  function resolve(url){
    try{
      if(!url) return null;
      if(/^blob:|^data:/i.test(url)) return null;
      if(/^https?:|^\\/\\//i.test(url)){
        try{
          var u = new URL(url, location.href);
          var abs = u.pathname.replace(/^\\//,'');
          if(vfs[abs]) return vfs[abs];
          var j = join(entryDir, abs);
          if(vfs[j]) return vfs[j];
        }catch(e){}
        return null;
      }
      var cleaned = normalize(String(url).split('?')[0].split('#')[0]);
      if(vfs[cleaned]) return vfs[cleaned];
      var fromEntry = join(entryDir, cleaned);
      if(vfs[fromEntry]) return vfs[fromEntry];
      return null;
    }catch(e){ return null; }
  }
  var origFetch = window.fetch.bind(window);
  window.fetch = function(input, init){
    var raw = typeof input === 'string' ? input : (input && input.url) || '';
    var mapped = resolve(raw);
    if(mapped) return origFetch(mapped, init);
    return origFetch(input, init);
  };
  var XO = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url){
    var mapped = typeof url === 'string' ? resolve(url) : null;
    var args = Array.prototype.slice.call(arguments);
    if(mapped) args[1] = mapped;
    return XO.apply(this, args);
  };
  // Help module / dynamic script loaders that set script.src
  try {
    var desc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
    if (desc && desc.set) {
      Object.defineProperty(HTMLScriptElement.prototype, 'src', {
        configurable: true,
        enumerable: true,
        get: desc.get,
        set: function(value) {
          var mapped = typeof value === 'string' ? resolve(value) : null;
          desc.set.call(this, mapped || value);
        }
      });
    }
  } catch (e) {}
  try {
    ['HTMLImageElement','HTMLAudioElement','HTMLSourceElement','HTMLVideoElement'].forEach(function(name){
      var proto = window[name] && window[name].prototype;
      if(!proto) return;
      var d = Object.getOwnPropertyDescriptor(proto, 'src');
      if(!d || !d.set) return;
      Object.defineProperty(proto, 'src', {
        configurable: true,
        enumerable: true,
        get: d.get,
        set: function(value){
          var mapped = typeof value === 'string' ? resolve(value) : null;
          d.set.call(this, mapped || value);
        }
      });
    });
  } catch (e) {}
})();
</script>`;
}

function rewriteHtmlAssets(
  html: string,
  entryDir: string,
  blobUrls: Map<string, string>,
  vfsJson: string,
): string {
  let out = html.replace(
    /\b(src|href|data-src|poster)=["']([^"']+)["']/gi,
    (full, attr: string, path: string) => {
      if (/^(blob:|data:|https?:|\/\/|#|mailto:|javascript:)/i.test(path)) return full;
      const mapped = mapBundlePath(path, entryDir, blobUrls);
      return mapped ? `${attr}="${mapped}"` : full;
    },
  );

  out = out.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, _q: string, path: string) => {
    if (/^(blob:|data:|https?:|\/\/)/i.test(path)) return full;
    const mapped = mapBundlePath(path, entryDir, blobUrls);
    return mapped ? `url("${mapped}")` : full;
  });

  const patch = buildVfsPatch(vfsJson, entryDir);
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (match) => `${match}\n${patch}`);
  } else {
    out = `${patch}${out}`;
  }
  return out;
}

export type VfsLaunch = {
  /** Prefer srcDoc — avoids blob: navigation quirks and keeps asset blobs alive. */
  srcDoc: string;
  revoke: () => void;
};

/** Build playable HTML (srcDoc) for multi-file web games without a service worker. */
export async function createVfsPlayLaunch(bundle: LocalGameBundle): Promise<VfsLaunch> {
  const files = new Map<string, LocalGameBundleFile>();
  for (const file of bundle.files) {
    files.set(normalizePath(file.path), file);
  }

  let entryPath = normalizePath(bundle.entryPath);
  let entry = files.get(entryPath);
  if (!entry) {
    // Older imports may store a nested entryPath after we later strip roots inconsistently.
    const fallback =
      files.get('index.html') ||
      files.get('Index.html') ||
      [...files.values()].find((f) => /\.html?$/i.test(f.path));
    if (!fallback) {
      throw new Error(`Game entry "${bundle.entryPath}" is missing from storage. Re-import the game.`);
    }
    entry = fallback;
    entryPath = normalizePath(fallback.path);
  }

  const blobUrls = new Map<string, string>();
  const created: string[] = [];
  const revokeAll = () => {
    for (const url of created) URL.revokeObjectURL(url);
    created.length = 0;
    blobUrls.clear();
  };

  try {
    // First pass: binary / non-rewritten blobs
    for (const [path, file] of files) {
      if (/\.(css)$/i.test(path)) continue;
      if (/\.html?$/i.test(path) && path === entryPath) continue;
      const url = URL.createObjectURL(
        new Blob([file.data], { type: file.mime || 'application/octet-stream' }),
      );
      blobUrls.set(path, url);
      created.push(url);
    }

    // CSS needs url() rewritten against its own directory.
    for (const [path, file] of files) {
      if (!/\.(css)$/i.test(path)) continue;
      const fileDir = dirnamePath(path);
      const css = rewriteCssUrls(new TextDecoder().decode(file.data), fileDir, blobUrls);
      const url = URL.createObjectURL(new Blob([css], { type: 'text/css' }));
      blobUrls.set(path, url);
      created.push(url);
    }

    const entryDir = dirnamePath(entryPath);
    const html = new TextDecoder().decode(entry.data);
    const vfsJson = JSON.stringify(Object.fromEntries(blobUrls));
    const srcDoc = rewriteHtmlAssets(html, entryDir, blobUrls, vfsJson);
    return { srcDoc, revoke: revokeAll };
  } catch (err) {
    revokeAll();
    throw err;
  }
}

/** @deprecated use createVfsPlayLaunch */
export async function createVfsPlayUrl(
  bundle: LocalGameBundle,
): Promise<{ url: string; revoke: () => void }> {
  const launch = await createVfsPlayLaunch(bundle);
  const url = URL.createObjectURL(new Blob([launch.srcDoc], { type: 'text/html' }));
  return {
    url,
    revoke: () => {
      URL.revokeObjectURL(url);
      launch.revoke();
    },
  };
}
