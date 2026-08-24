export function nodeId(experienceKey: string, localId: string): string {
  if (localId.startsWith("node.")) return localId;
  if (localId.startsWith(experienceKey)) return `node.${localId}`;
  return `node.${experienceKey}.${localId}`;
}
