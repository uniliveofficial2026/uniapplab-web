import { MapPin } from 'lucide-react';
import type { ChatMessageLocation } from '../../types';
import {
  buildStaticMapPreviewUrl,
  formatCoordinates,
  getLocationPreviewLabel,
} from './messages/chatLocationUtils';
import { handleMediaError } from '../../lib/utils';

type MessageLocationCardProps = {
  location: ChatMessageLocation;
  isAuthor: boolean;
  onViewInApp: (location: ChatMessageLocation) => void;
};

export function MessageLocationCard({ location, isAuthor, onViewInApp }: MessageLocationCardProps) {
  const mapUrl = buildStaticMapPreviewUrl(location);
  const title = getLocationPreviewLabel(location);
  const coords = formatCoordinates(location);

  const shellClass = isAuthor
    ? 'border-primary-foreground/25'
    : 'border-zinc-200/80 dark:border-zinc-700/80';

  return (
    <div
      data-message-interactive="true"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className={`w-full min-w-[220px] max-w-[min(100%,300px)] rounded-2xl border overflow-hidden bg-background/40 ${shellClass}`}
    >
      <button
        type="button"
        onClick={() => onViewInApp(location)}
        className="w-full text-left group"
      >
        <div className="relative aspect-[2/1] w-full bg-zinc-800 overflow-hidden">
          <img
            src={mapUrl}
            alt={`Map near ${coords}`}
            className="w-full h-full object-cover transition-transform group-hover:scale-[1.02]"
            loading="lazy"
            onError={handleMediaError}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/55 backdrop-blur-sm text-white text-[10px] font-bold">
            <MapPin className="w-3 h-3 text-green-400" />
            Live location
          </div>
        </div>
        <div className={`px-3 py-2.5 ${isAuthor ? 'text-primary-foreground' : 'text-foreground'}`}>
          <p className="text-[13px] font-semibold leading-snug truncate">{title}</p>
          <p
            className={`text-[11px] mt-0.5 tabular-nums ${isAuthor ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}
          >
            {coords}
          </p>
          <p
            className={`text-[10px] mt-1 font-semibold ${isAuthor ? 'text-primary-foreground/85' : 'text-primary'}`}
          >
            Tap to view map in app
          </p>
        </div>
      </button>
      <button
        type="button"
        onClick={() => onViewInApp(location)}
        className={`w-full py-2.5 text-[12px] font-bold border-t transition-colors ${isAuthor ? 'border-primary-foreground/20 hover:bg-primary-foreground/10 text-primary-foreground' : 'border-zinc-200/80 dark:border-zinc-700/80 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60'}`}
      >
        View map
      </button>
    </div>
  );
}
