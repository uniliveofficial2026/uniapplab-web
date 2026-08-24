export function experienceId(routeKey: string): string {
  return routeKey.startsWith("experience.") ? routeKey : `experience.${routeKey}`;
}
