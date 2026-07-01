import { build } from "esbuild";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
await rm(path.join(dir, "dist"), { recursive: true, force: true });
await build({
  entryPoints: [path.join(dir, "src/index.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: path.join(dir, "dist/index.mjs"),
  external: ["ws"],
});
