import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { MessageMediaAttachment } from './messages/types';
import {
  createChatFileObjectUrl,
  getChatFileKind,
  type ChatFileKind,
} from './messages/chatFileUtils';

const TEXT_PREVIEW_MAX_CHARS = 512_000;

type ChatFileInAppViewerProps = {
  media: MessageMediaAttachment;
};

function ChatTextFileViewer({ src }: { src: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error('fetch failed');
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        const trimmed =
          text.length > TEXT_PREVIEW_MAX_CHARS
            ? `${text.slice(0, TEXT_PREVIEW_MAX_CHARS)}\n\n… (truncated)`
            : text;
        setContent(trimmed);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] text-white/70">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }
  if (error || content === null) {
    return (
      <p className="text-white/70 text-sm text-center px-6">Could not load text preview.</p>
    );
  }
  return (
    <pre className="w-full h-full max-w-4xl mx-auto overflow-auto rounded-lg bg-zinc-900/90 border border-white/10 p-4 text-[13px] leading-relaxed text-zinc-100 font-mono whitespace-pre-wrap break-words">
      {content}
    </pre>
  );
}

function ViewerBody({ kind, src, name }: { kind: ChatFileKind; src: string; name: string }) {
  switch (kind) {
    case 'image':
      return (
        <img
          src={src}
          alt={name}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        />
      );
    case 'pdf':
    case 'document':
    case 'spreadsheet':
      return (
        <iframe
          title={name}
          src={src}
          className="w-full h-full min-h-[50vh] max-w-5xl rounded-lg bg-white shadow-2xl border-0"
        />
      );
    case 'video':
      return (
        <video
          src={src}
          controls
          playsInline
          className="max-w-full max-h-full w-full max-w-4xl rounded-lg bg-black shadow-2xl"
        />
      );
    case 'audio':
      return (
        <div className="w-full max-w-md px-6">
          <audio src={src} controls className="w-full" />
        </div>
      );
    case 'text': {
      const isHtml = /\.html?$/i.test(name);
      if (isHtml) {
        return (
          <iframe
            title={name}
            src={src}
            sandbox="allow-same-origin"
            className="w-full h-full min-h-[50vh] max-w-5xl rounded-lg bg-white shadow-2xl border-0"
          />
        );
      }
      return <ChatTextFileViewer src={src} />;
    }
    default:
      return (
        <iframe
          title={name}
          src={src}
          className="w-full h-full min-h-[40vh] max-w-5xl rounded-lg bg-white shadow-2xl border-0"
        />
      );
  }
}

export function ChatFileInAppViewer({ media }: ChatFileInAppViewerProps) {
  const [src, setSrc] = useState<string | null>(null);
  const kind = getChatFileKind(media);
  const name = media.name || 'File';

  useEffect(() => {
    const objectUrl = createChatFileObjectUrl(media);
    if (!objectUrl) {
      setSrc(null);
      return undefined;
    }
    setSrc(objectUrl.src);
    return () => objectUrl.revoke();
  }, [media.url, media.mimeType, media.name]);

  if (!src) {
    return (
      <p className="text-white/70 text-sm text-center px-6">
        File data is missing or could not be loaded.
      </p>
    );
  }

  return (
    <div className="w-full h-full min-h-0 flex items-center justify-center">
      <ViewerBody kind={kind} src={src} name={name} />
    </div>
  );
}
