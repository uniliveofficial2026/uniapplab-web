import type { ChatMessageLocation } from '../../../types';

const CACHE_KEY = 'instacollab:lastChatLocation';

/** https://operations.osmfoundation.org/policies/nominatim/ — identify app + contact */
const NOMINATIM_USER_AGENT =
  'InstaCollab/1.0 (+https://github.com/instacollab; chat-location-search)';
const NOMINATIM_CONTACT_EMAIL = 'support@instacollab.app';
const NOMINATIM_MIN_INTERVAL_MS = 1100;

let lastNominatimRequestAt = 0;

async function waitForNominatimSlot(): Promise<void> {
  const elapsed = Date.now() - lastNominatimRequestAt;
  if (elapsed < NOMINATIM_MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, NOMINATIM_MIN_INTERVAL_MS - elapsed));
  }
  lastNominatimRequestAt = Date.now();
}

function buildApproximateLocation(
  latitude: number,
  longitude: number,
  placeParts: Array<string | undefined>,
  fallbackLabel: string
): ChatMessageLocation | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const place = placeParts.filter(Boolean).join(', ');
  return {
    latitude,
    longitude,
    label: place || fallbackLabel,
    accuracyMeters: 10_000,
  };
}

export type PlaceSearchResult = {
  label: string;
  location: ChatMessageLocation;
};

function positionToLocation(position: GeolocationPosition): ChatMessageLocation {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: position.coords.accuracy,
  };
}

function getCurrentPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export function readCachedDeviceLocation(): ChatMessageLocation | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatMessageLocation;
    if (!Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedDeviceLocation(location: ChatMessageLocation): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(location));
  } catch {
    /* ignore quota */
  }
}

/** Try fast/cached fix first, then high accuracy, then low accuracy. */
export async function requestDeviceLocation(): Promise<ChatMessageLocation> {
  const attempts: PositionOptions[] = [
    { enableHighAccuracy: false, timeout: 15_000, maximumAge: 600_000 },
    { enableHighAccuracy: false, timeout: 20_000, maximumAge: 120_000 },
    { enableHighAccuracy: true, timeout: 30_000, maximumAge: 0 },
    { enableHighAccuracy: false, timeout: 25_000, maximumAge: 0 },
  ];

  let lastCode = 0;
  for (const options of attempts) {
    try {
      const position = await getCurrentPosition(options);
      const location = positionToLocation(position);
      writeCachedDeviceLocation(location);
      return location;
    } catch (error) {
      const geo = error as GeolocationPositionError;
      if (typeof geo?.code === 'number') lastCode = geo.code;
    }
  }

  const err = new Error('Geolocation failed') as Error & { code?: number };
  err.code = lastCode || 3;
  throw err;
}

async function fetchApproximateFromIpWho(): Promise<ChatMessageLocation | null> {
  try {
    const res = await fetch('https://ipwho.is/', {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      success?: boolean;
      latitude?: number;
      longitude?: number;
      city?: string;
      region?: string;
      country?: string;
    };
    if (!data.success) return null;
    return buildApproximateLocation(
      Number(data.latitude),
      Number(data.longitude),
      [data.city, data.region, data.country],
      'Approximate location'
    );
  } catch {
    return null;
  }
}

/** CORS-friendly fallback when ipwho.is is blocked or rate-limited. */
async function fetchApproximateFromGeoJs(): Promise<ChatMessageLocation | null> {
  try {
    const res = await fetch('https://get.geojs.io/v1/ip/geo.json', {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      latitude?: string | number;
      longitude?: string | number;
      city?: string;
      region?: string;
      country?: string;
    };
    return buildApproximateLocation(
      Number(data.latitude),
      Number(data.longitude),
      [data.city, data.region, data.country],
      'Approximate location (network)'
    );
  } catch {
    return null;
  }
}

/** City-level fix from IP; tries multiple providers in parallel. */
export async function fetchApproximateLocationByIp(): Promise<ChatMessageLocation | null> {
  const outcomes = await Promise.allSettled([
    fetchApproximateFromIpWho(),
    fetchApproximateFromGeoJs(),
  ]);
  for (const outcome of outcomes) {
    if (outcome.status === 'fulfilled' && outcome.value) {
      return outcome.value;
    }
  }
  return null;
}

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  await waitForNominatimSlot();

  const params = new URLSearchParams({
    format: 'json',
    q: trimmed,
    limit: '6',
    addressdetails: '0',
    email: NOMINATIM_CONTACT_EMAIL,
  });

  const nominatimHeaders: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': 'en',
    'User-Agent': NOMINATIM_USER_AGENT,
  };
  if (typeof window !== 'undefined' && window.location?.origin) {
    nominatimHeaders.Referer = window.location.origin;
  }

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: nominatimHeaders,
    signal: AbortSignal.timeout(12_000),
  });

  if (res.status === 429) return [];
  if (!res.ok) return [];

  const rows = (await res.json()) as Array<{
    lat?: string;
    lon?: string;
    display_name?: string;
  }>;

  const results: PlaceSearchResult[] = [];
  for (const row of rows) {
    const latitude = Number(row.lat);
    const longitude = Number(row.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const label = typeof row.display_name === 'string' ? row.display_name : trimmed;
    results.push({
      label,
      location: { latitude, longitude, label },
    });
  }
  return results;
}

export function parseManualCoordinates(lat: string, lng: string): ChatMessageLocation | null {
  const latitude = Number(lat.trim());
  const longitude = Number(lng.trim());
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

export function nudgeLocation(
  location: ChatMessageLocation,
  deltaLat: number,
  deltaLng: number
): ChatMessageLocation {
  return {
    ...location,
    latitude: Math.max(-90, Math.min(90, location.latitude + deltaLat)),
    longitude: location.longitude + deltaLng,
  };
}
