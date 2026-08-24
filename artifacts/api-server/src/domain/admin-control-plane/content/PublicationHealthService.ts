import { nowIso, store } from "../repositories/memoryStore";

export function recordHealthEvent(publicationId: string, input: Record<string, unknown>) {
  const event = {
    id: `${publicationId}:${Date.now()}`,
    publicationId,
    createdAt: nowIso(),
    errorRatePct: Number(input.errorRatePct || 0),
    fallbackRatePct: Number(input.fallbackRatePct || 0),
    bundleLoadFailures: Number(input.bundleLoadFailures || 0),
    assetFailures: Number(input.assetFailures || 0),
    frameBudgetOk: input.frameBudgetOk !== false,
    interactionLatencyMs: Number(input.interactionLatencyMs || 0),
    cleanupOk: input.cleanupOk !== false,
    apiLatencyMs: Number(input.apiLatencyMs || 0),
  };
  store.healthEvents.push(event);
  return event;
}

export function getPublicationHealth(publicationId: string) {
  const events = store.healthEvents.filter((e) => e.publicationId === publicationId);
  const latest = events[events.length - 1] || null;
  const failing = latest
    ? Number(latest.errorRatePct) > 0.5 || Number(latest.fallbackRatePct) > 2 || latest.cleanupOk === false
    : false;
  return { publicationId, latest, events: events.slice(-20), failing };
}
