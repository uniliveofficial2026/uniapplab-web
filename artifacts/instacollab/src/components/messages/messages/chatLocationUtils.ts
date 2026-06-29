import type { ChatMessage, ChatMessageLocation } from '../../../types';

const LEGACY_LOCATION_RE =
  /📍\s*Shared location:\s*https?:\/\/(?:www\.)?google\.com\/maps\?q=([-\d.]+),([-\d.]+)/i;

export function isValidChatLocation(loc: ChatMessageLocation | null | undefined): loc is ChatMessageLocation {
  if (!loc || typeof loc !== 'object') return false;
  return Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude);
}

export function parseLegacyLocationMessageText(text: string | undefined): ChatMessageLocation | null {
  if (!text?.trim()) return null;
  const match = text.trim().match(LEGACY_LOCATION_RE);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export function getMessageLocation(message: ChatMessage | null | undefined): ChatMessageLocation | null {
  if (!message) return null;
  const raw = message.location;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const latitude = Number((raw as ChatMessageLocation).latitude);
    const longitude = Number((raw as ChatMessageLocation).longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      const label = (raw as ChatMessageLocation).label;
      const accuracyMeters = (raw as ChatMessageLocation).accuracyMeters;
      return {
        latitude,
        longitude,
        label: typeof label === 'string' && label.trim() ? label.trim() : undefined,
        accuracyMeters:
          typeof accuracyMeters === 'number' && Number.isFinite(accuracyMeters)
            ? accuracyMeters
            : undefined,
      };
    }
  }
  return parseLegacyLocationMessageText(typeof message.text === 'string' ? message.text : undefined);
}

export function formatCoordinates(location: ChatMessageLocation): string {
  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
}

export function buildGoogleMapsUrl(location: ChatMessageLocation): string {
  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
}

export function buildOsmEmbedUrl(location: ChatMessageLocation, zoom = 15): string {
  const { latitude, longitude } = location;
  const delta = 0.02 / Math.max(zoom / 15, 0.5);
  const bbox = `${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

/** Static map tile preview (no API key). */
export function buildStaticMapPreviewUrl(
  location: ChatMessageLocation,
  width = 560,
  height = 280
): string {
  const { latitude, longitude } = location;
  const params = new URLSearchParams({
    center: `${latitude},${longitude}`,
    zoom: '15',
    size: `${width}x${height}`,
    markers: `${latitude},${longitude},red-pushpin`,
  });
  return `https://staticmap.openstreetmap.de/staticmap.php?${params.toString()}`;
}

export function getLocationPreviewLabel(location: ChatMessageLocation): string {
  if (location.label?.trim()) return location.label.trim();
  return formatCoordinates(location);
}

export function getChatMessageLocationPreview(
  message: ChatMessage | null | undefined
): string | null {
  const loc = getMessageLocation(message);
  if (loc) return `📍 ${getLocationPreviewLabel(loc)}`;
  return null;
}

export function geolocationErrorMessage(code: number): string {
  if (code === 1) {
    return 'Location permission denied. Enable location access in browser settings.';
  }
  if (code === 2) {
    return 'Location unavailable. Try again or check device settings.';
  }
  if (code === 3) {
    return 'Location request timed out. Try again.';
  }
  return 'Unable to get your location.';
}
