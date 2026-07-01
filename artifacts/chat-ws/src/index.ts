import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { createClient } from "@supabase/supabase-js";

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Client = WebSocket & { userId?: string };

const wss = new WebSocketServer({ noServer: true });
const rooms = new Map<string, Set<Client>>();

function joinRoom(threadId: string, client: Client) {
  if (!rooms.has(threadId)) rooms.set(threadId, new Set());
  rooms.get(threadId)!.add(client);
}

function leaveAll(client: Client) {
  for (const set of rooms.values()) set.delete(client);
}

wss.on("connection", (socket, req) => {
  const client = socket as Client;
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const token = url.searchParams.get("token")?.trim();

  if (!token) {
    client.close(4401, "Missing token");
    return;
  }

  void supabase.auth.getUser(token).then(({ data, error }) => {
    if (error || !data.user) {
      client.close(4401, "Invalid token");
      return;
    }
    client.userId = data.user.id;
    client.send(JSON.stringify({ type: "connected", userId: data.user.id }));
  });

  client.on("message", (raw) => {
    try {
      const msg = JSON.parse(String(raw)) as {
        type?: string;
        threadId?: string;
        typing?: boolean;
      };
      if (msg.type === "join" && msg.threadId) {
        joinRoom(msg.threadId, client);
        return;
      }
      if (msg.type === "typing" && msg.threadId && client.userId) {
        const peers = rooms.get(msg.threadId);
        if (!peers) return;
        for (const peer of peers) {
          if (peer !== client && peer.readyState === peer.OPEN) {
            peer.send(
              JSON.stringify({
                type: "typing",
                threadId: msg.threadId,
                userId: client.userId,
                typing: !!msg.typing,
              }),
            );
          }
        }
      }
    } catch {
      // ignore malformed frames
    }
  });

  client.on("close", () => leaveAll(client));
});

const server = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "chat-ws" }));
});

server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`chat-ws listening on ${HOST}:${PORT}`);
});
