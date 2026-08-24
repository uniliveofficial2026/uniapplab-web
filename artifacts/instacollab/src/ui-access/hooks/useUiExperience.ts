import { resolveExperience, type UiExperienceHandle } from '../experienceResolver';

export function useUiExperience(id: string): UiExperienceHandle {
  return resolveExperience(id);
}
