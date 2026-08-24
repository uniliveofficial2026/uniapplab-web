import net from "node:net";
import { listProjectApps } from "./projectRegistryService";

export type WorkspacePort = {
  id: string;
  name: string;
  port: number;
  url: string;
  listening: boolean;
  kind: string;
  path?: string;
};

function probePort(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(400);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

export async function listWorkspacePorts(): Promise<WorkspacePort[]> {
  const apps = listProjectApps().filter((a) => typeof a.devPort === "number" && a.devPort > 0);
  const seen = new Set<number>();
  const rows: Array<Omit<WorkspacePort, "listening">> = [];

  for (const app of apps) {
    const port = app.devPort!;
    if (seen.has(port)) continue;
    seen.add(port);
    rows.push({
      id: app.id,
      name: app.name,
      port,
      url: `http://127.0.0.1:${port}${app.previewPath || ""}`,
      kind: app.kind,
      path: app.path,
    });
  }

  const extras: Array<Omit<WorkspacePort, "listening">> = [
    { id: "admin", name: "Admin studio", port: 5180, url: "http://127.0.0.1:5180/#/studio", kind: "react-vite" },
    { id: "app", name: "UniLive app", port: 5173, url: "http://127.0.0.1:5173", kind: "react-vite" },
    { id: "api", name: "API server", port: 5001, url: "http://127.0.0.1:5001/api/admin/me", kind: "node" },
  ];
  for (const extra of extras) {
    if (seen.has(extra.port)) continue;
    seen.add(extra.port);
    rows.push(extra);
  }

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      listening: await probePort(row.port),
    })),
  );
}
