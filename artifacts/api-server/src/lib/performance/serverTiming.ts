export function formatServerTiming(parts: Array<{ name: string; durMs: number }>): string {
  return parts
    .filter((p) => Number.isFinite(p.durMs))
    .map((p) => `${p.name};dur=${p.durMs.toFixed(1)}`)
    .join(", ");
}
