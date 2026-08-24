import type { ReactNode } from "react";
import type { ResolvedLiveExperienceSnapshot } from "./contracts";
import { LiveRoomKernel } from "./LiveRoomKernel";
import { getLiveExperience } from "./liveExperienceRegistry";

/**
 * Replaceable presentation host. Does not own LiveKit connect/disconnect.
 * Default customer Room.tsx is unchanged; admin preview + tests mount this.
 */
export type LiveExperienceHostProps = {
  snapshot: ResolvedLiveExperienceSnapshot;
  children?: ReactNode;
};

export function LiveExperienceHost({ snapshot, children }: LiveExperienceHostProps) {
  const rec = getLiveExperience(snapshot.experienceId);
  return (
    <section
      data-live-experience={snapshot.experienceId}
      data-layout-version={snapshot.layoutVersionId}
      data-assignment={snapshot.assignmentReason}
      data-backend-status={rec?.backendStatus || "unsupported"}
    >
      {children}
    </section>
  );
}

export function LiveRoomPresentationTree({
  snapshot,
  children,
}: {
  snapshot: ResolvedLiveExperienceSnapshot;
  children: ReactNode;
}) {
  return (
    <LiveRoomKernel
      roomId={snapshot.roomId}
      canonicalRoomType={snapshot.canonicalRoomType}
      snapshot={snapshot}
    >
      <LiveExperienceHost snapshot={snapshot}>{children}</LiveExperienceHost>
    </LiveRoomKernel>
  );
}
