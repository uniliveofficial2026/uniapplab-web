export type GraphEdge = { from: string; to: string; type?: string };

export function detectCycles(edges: GraphEdge[]): string[][] {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.from) || [];
    list.push(e.to);
    adj.set(e.from, list);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles: string[][] = [];
  function walk(id: string, stack: string[]) {
    if (visiting.has(id)) {
      cycles.push([...stack.slice(stack.indexOf(id)), id]);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of adj.get(id) || []) walk(next, [...stack, id]);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of adj.keys()) walk(id, []);
  return cycles;
}
