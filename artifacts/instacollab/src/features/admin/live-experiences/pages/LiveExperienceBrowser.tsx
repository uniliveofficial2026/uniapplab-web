import { listLiveExperiences } from "../../../../ui-access/live/liveExperienceRegistry";
import { livePreviewFixtures } from "../previews/fixtures";

export function LiveExperienceBrowser() {
  const experiences = listLiveExperiences();
  return (
    <div data-admin-live-experiences="">
      <h1>UniLive’s Live Experiences</h1>
      <p>Published registry only. Canonical room types are not edited here.</p>
      <ul>
        {experiences.map((e) => (
          <li key={e.experienceId}>
            {e.displayName} · {e.canonicalRoomTypes.join(", ")} · {e.backendStatus}
          </li>
        ))}
      </ul>
      <h2>Preview fixtures</h2>
      <ul>
        {livePreviewFixtures.map((f) => (
          <li key={f.id}>{f.id} · {f.experienceId} · {f.role}</li>
        ))}
      </ul>
    </div>
  );
}
