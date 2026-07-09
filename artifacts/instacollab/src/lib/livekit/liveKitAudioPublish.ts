import { LocalAudioTrack, type LocalParticipant, Track } from 'livekit-client';

/**
 * Publish (or replace) the local microphone track on a LiveKit room.
 * Accepts a user-provided processed track from the Web Audio voice changer pipeline.
 */
export async function updateLiveKitLocalAudioTrack(
  participant: LocalParticipant,
  mediaTrack: MediaStreamTrack | null,
): Promise<void> {
  for (const publication of participant.audioTrackPublications.values()) {
    const track = publication.track;
    if (track) {
      await participant.unpublishTrack(track);
      if (track instanceof LocalAudioTrack) {
        track.stop();
      }
    }
  }

  if (!mediaTrack || mediaTrack.readyState === 'ended') return;

  const localTrack = new LocalAudioTrack(mediaTrack, undefined, true);
  await participant.publishTrack(localTrack, { source: Track.Source.Microphone });
}
