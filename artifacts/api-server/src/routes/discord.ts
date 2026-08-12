/**
 * Discord Interactions Endpoint
 * Public URL: https://app.uniapplab.com/api/discord/interactions
 *
 * Set DISCORD_PUBLIC_KEY from Discord Developer Portal → Application → General → Public Key.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from "discord-interactions";

const router: IRouter = Router();

type DiscordInteraction = {
  type?: number;
  data?: { name?: string };
};

function rawBodyString(req: Request): string {
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  if (raw instanceof Buffer) return raw.toString("utf8");
  if (typeof req.body === "string") return req.body;
  return JSON.stringify(req.body ?? {});
}

function parseInteraction(req: Request, body: string): DiscordInteraction {
  if (typeof req.body === "object" && req.body) return req.body as DiscordInteraction;
  try {
    return JSON.parse(body) as DiscordInteraction;
  } catch {
    return {};
  }
}

function commandReply(content: string) {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content },
  };
}

router.post("/discord/interactions", async (req: Request, res: Response) => {
  const publicKey = String(process.env.DISCORD_PUBLIC_KEY || "").trim();
  if (!publicKey) {
    res.status(503).json({ error: "DISCORD_PUBLIC_KEY not configured" });
    return;
  }

  const signature = req.get("X-Signature-Ed25519");
  const timestamp = req.get("X-Signature-Timestamp");
  if (!signature || !timestamp) {
    res.status(401).end("Bad request signature");
    return;
  }

  const body = rawBodyString(req);
  const valid = await verifyKey(body, signature, timestamp, publicKey);
  if (!valid) {
    res.status(401).end("Bad request signature");
    return;
  }

  const interaction = parseInteraction(req, body);

  // Discord endpoint verification + keep-alive pings.
  if (interaction.type === InteractionType.PING) {
    res.json({ type: InteractionResponseType.PONG });
    return;
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const name = String(interaction.data?.name || "").trim().toLowerCase();
    if (name === "hello") {
      res.json(commandReply("Hello from UniLive's 👋"));
      return;
    }
    res.json(
      commandReply(
        name
          ? `Received \`/${name}\` — UniLive's Discord endpoint is live.`
          : "UniLive's Discord endpoint is live.",
      ),
    );
    return;
  }

  // Acknowledge other interaction types so Discord does not show "failed".
  if (
    interaction.type === InteractionType.MESSAGE_COMPONENT ||
    interaction.type === InteractionType.MODAL_SUBMIT
  ) {
    res.json({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });
    return;
  }

  res.status(400).json({ error: "unsupported_interaction_type" });
});

export default router;
