import { liveNodesForExperience } from "../../../../ui-access/live/liveNodeRegistry";
import type { LiveExperienceId } from "../../../../ui-access/live/contracts";

export function ExperienceTree({ experienceId }: { experienceId: LiveExperienceId }) {
  const nodes = liveNodesForExperience(experienceId);
  return (
    <ul data-live-tree={experienceId}>
      {nodes.map((n) => (
        <li key={n.nodeId}>{n.nodeId} · {n.displayName}</li>
      ))}
    </ul>
  );
}
