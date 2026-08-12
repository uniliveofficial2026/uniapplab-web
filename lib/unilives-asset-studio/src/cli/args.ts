export function parseArgs(argv: string[]): { _: string[]; flags: Record<string, string | boolean> } {
  const out: { _: string[]; flags: Record<string, string | boolean> } = { _: [], flags: {} };
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        out.flags[key] = true;
      } else {
        out.flags[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

export function requireFlag(flags: Record<string, string | boolean>, name: string): string {
  const v = flags[name];
  if (typeof v !== 'string' || !v) {
    throw new Error(`Missing required --${name}`);
  }
  return v;
}
