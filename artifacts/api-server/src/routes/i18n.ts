import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { getSupabaseService } from "../lib/supabase";
import { apiError } from "../lib/apiError";

const router: IRouter = Router();

const TARGET_LOCALES = new Set([
  "en",
  "es",
  "my",
  "ar",
  "hi",
  "zh-Hans",
  "zh-Hant",
  "ja",
  "ko",
  "th",
  "fr",
  "de",
  "pt",
  "he",
  "en-XA",
  "ar-XB",
]);

function hashSource(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function isProtected(text: string): boolean {
  const t = text.trim();
  return (
    /^[@#]/.test(t) ||
    /^https?:\/\//i.test(t) ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ||
    /^\d+$/.test(t)
  );
}

async function translateOnServer(text: string, locale: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
  if (!key || locale === "en") return text;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Translate the user-generated text into locale ${locale}. Return ONLY the translation. Do not translate @mentions, #hashtags, URLs, emoji, IDs, or numbers.\n\n${text}`,
                },
              ],
            },
          ],
        }),
      },
    );
    if (!res.ok) return text;
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const out = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return out || text;
  } catch {
    return text;
  }
}

router.post("/translate", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const {
      entityType,
      entityId,
      field,
      original,
      sourceHash,
      targetLocale,
      threadId,
    } = req.body as {
      entityType?: string;
      entityId?: string;
      field?: string;
      original?: string;
      sourceHash?: string;
      targetLocale?: string;
      threadId?: string;
    };

    const locale = String(targetLocale || "").trim();
    const text = String(original || "").trim();
    const eid = String(entityId || "").trim();
    const fld = String(field || "body").trim();
    if (!eid || !text || !TARGET_LOCALES.has(locale)) {
      apiError(res, 400, "common.unknownError");
      return;
    }
    if (isProtected(text)) {
      res.json({ translated: text, sourceLocale: "und", original: text, cached: true });
      return;
    }

    if (String(entityType || "") === "message") {
      const tid = String(threadId || eid).trim();
      if (tid) {
        const { data: member } = await getSupabaseService()
          .from("chat_thread_members")
          .select("user_id")
          .eq("thread_id", tid)
          .eq("user_id", userId)
          .maybeSingle();
        if (!member) {
          apiError(res, 403, "error.notThreadMember");
          return;
        }
      }
    }

    const hash = String(sourceHash || hashSource(text));
    const sb = getSupabaseService();

    try {
      const { data: cached } = await sb
        .from("ugc_translations")
        .select("translated_text, source_locale")
        .eq("entity_id", eid)
        .eq("field", fld)
        .eq("target_locale", locale)
        .eq("source_hash", hash)
        .maybeSingle();
      if (cached?.translated_text) {
        res.json({
          translated: cached.translated_text,
          sourceLocale: cached.source_locale || "und",
          original: text,
          cached: true,
        });
        return;
      }
    } catch {
      /* table may not exist yet */
    }

    const translated = await translateOnServer(text, locale);

    try {
      await sb.from("ugc_translations").upsert(
        {
          entity_id: eid,
          entity_type: String(entityType || "post"),
          field: fld,
          source_hash: hash,
          source_locale: "und",
          target_locale: locale,
          original_text: text,
          translated_text: translated,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "entity_id,field,target_locale,source_hash" },
      );
    } catch {
      /* cache write is best-effort */
    }

    res.json({
      translated,
      sourceLocale: "und",
      original: text,
      cached: false,
      machineTranslated: translated !== text,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
