# CLI Architecture

`@unilives/cli` — `createUniLiveCli()` and `bin.mjs` entry.

## Commands

| Command | Behavior |
|---|---|
| `login` | Local dev status (no cloud required) |
| `init` | Create org, project, developer credential → `.unilive.json` |
| `doctor` | Config presence, provider registry, package checks |
| `rtc status` | Fake provider join probe |
| `db status` | Database provider info |
| `db migrate` | Delegates to repo Supabase migration workflow |
| `build` | Delegates to instacollab build |
| `test` | Delegates to repo test scripts |
| `deploy` | Delegates to Vercel/GitHub deploy path |
| `logs` | SDK observe.getLogs() |
| `dev` | Documents local stack (foundation) |
| `mcp list` | Lists MCP tools |

## Local config

Reads `.unilive.json` from cwd:

- `projectId`, `organizationId`, `credentialPublicId`, `secretRef`

## Design

Same contracts as API and MCP — no parallel business logic. Delegates heavy work to existing repo scripts (`pnpm --filter ...`).

## Package

`lib/unilives-cli/package.json` — bin points to `bin.mjs`.

## Future

`unilive start` — orchestrate local postgres + api + rtc-fake + mcp (not complete).

## Doctor output

```json
{
  "checks": {
    "platformCore": true,
    "rtcFake": true,
    "livekitOptional": true
  }
}
```

LiveKit optional — tests run without it via fake provider.
