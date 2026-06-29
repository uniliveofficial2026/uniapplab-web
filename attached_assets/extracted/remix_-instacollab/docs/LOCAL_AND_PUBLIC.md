# Run locally and over the internet

## One command (recommended)

```bash
npm run dev:public
```

This starts:

| URL | Who can open it |
|-----|------------------|
| http://localhost:3000 | You on this Mac |
| http://192.168.x.x:3000 | Phones/laptops on the same Wi‑Fi |
| `https://….trycloudflare.com` | Anyone on the internet (printed in the terminal) |

Stop both with **Ctrl+C** in that terminal.

**Port 3000 must be free.** If something else uses it:

```bash
lsof -ti :3000 | xargs kill
npm run dev:public
```

## Local only

```bash
npm run dev
```

Open http://localhost:3000

## Auth when using the public URL

Cloud sign-in uses **Supabase** (Google / Apple / email). See **`docs/CLOUD_AUTH.md`** for migrations, providers, and Google Cloud setup.

**Use the tunnel URL in the browser** (`https://….trycloudflare.com` from the terminal). Opening `localhost` while testing OAuth on a tunnel often fails.

Each time you start `dev:public`, Cloudflare may give a **new** hostname. Update:

1. **Supabase → Authentication → URL Configuration** — Site URL + Redirect URLs (`tunnel/**`).
2. **Google Cloud → Web client → Authorized JavaScript origins** — the tunnel origin only.
3. **Google redirect URI** stays the Supabase callback (not the tunnel).

```bash
npm run oauth:setup -- https://YOUR-SUBDOMAIN.trycloudflare.com
```

### Stable tunnel (configure once)

Use a [named Cloudflare tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) with a fixed hostname, point it at `http://localhost:3000`, then set that URL in Supabase and Google once.

### Local-only OAuth testing

Use `http://localhost:3000` and add it to Supabase redirect URLs and Google JavaScript origins.

Restart the app after `.env` changes: stop terminal → `npm run dev:public` again.

## Separate terminals (optional)

**Terminal 1:**

```bash
npm run dev
```

**Terminal 2:**

```bash
npm run tunnel
```

`npm run tunnel` only starts Cloudflare pointed at http://localhost:3000 (Vite must already be running).
