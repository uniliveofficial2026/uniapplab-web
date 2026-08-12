export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/** Path segments after /functions/v1/<fn>. e.g. /functions/v1/wallet/transfer → ["transfer"]. */
export function subPath(url: URL, fnName: string): string[] {
  const marker = `/${fnName}`;
  const idx = url.pathname.indexOf(marker);
  const rest =
    idx >= 0 ? url.pathname.slice(idx + marker.length) : url.pathname;
  return rest.split("/").map((s) => s.trim()).filter(Boolean);
}
