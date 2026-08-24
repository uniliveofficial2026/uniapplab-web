import { deleteLiveKitRoom, getRoomService, isLiveKitConfigured, partyRoomName } from "../../lib/livekit.ts";
import { LIVEKIT_CLEANUP_MAX_ATTEMPTS } from "./policy.ts";
import type { LiveLifecycleService } from "./LiveLifecycleService.ts";

export async function removeLiveKitParticipant(roomName: string, identity: string): Promise<boolean> {
  const svc = getRoomService();
  if (!svc) return false;
  try {
    await svc.removeParticipant(roomName, identity);
    return true;
  } catch {
    return false;
  }
}

/**
 * Post-commit LiveKit cleanup. Never runs before the canonical DB/memory transition.
 * Bounded retries — does not reopen canonical writes.
 */
export async function processLiveLifecycleOutbox(service: LiveLifecycleService): Promise<{
  processed: number;
  failed: number;
}> {
  let processed = 0;
  let failed = 0;
  if (!isLiveKitConfigured()) {
    for (const job of service.listOutbox("pending")) {
      service.markOutboxDone(job.id);
      if (job.kind === "delete-livekit-room") service.completeEnding(job.roomId);
      processed += 1;
    }
    return { processed, failed };
  }

  for (const job of service.listOutbox("pending")) {
    try {
      if (job.kind === "delete-livekit-room") {
        const name = String(job.payload.livekitRoom || partyRoomName(job.roomId));
        await deleteLiveKitRoom(name);
        service.completeEnding(job.roomId);
      } else if (job.kind === "remove-participant") {
        const identity = String(job.payload.identity || "");
        if (identity) await removeLiveKitParticipant(partyRoomName(job.roomId), identity);
      }
      service.markOutboxDone(job.id);
      processed += 1;
    } catch (err) {
      service.markOutboxFailed(job.id, err instanceof Error ? err.message : String(err));
      if (job.attempts + 1 >= LIVEKIT_CLEANUP_MAX_ATTEMPTS) failed += 1;
    }
  }
  return { processed, failed };
}
