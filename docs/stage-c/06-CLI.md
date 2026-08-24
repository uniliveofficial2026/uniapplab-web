# 06 — CLI (`@unilives/cli`)

Developer command surface: `createUniLiveCli()` and `bin.mjs`.

## Package

- Path: `lib/unilives-cli`
- Name: `@unilives/cli` v0.1.0

## Commands

| Command | Behavior | Status |
|---|---|---|
| `login` | Local dev status (no cloud required) | **IMPLEMENTED** |
| `init` | Create org, project, credential → `.unilive.json` | **IMPLEMENTED** |
| `doctor` | Config, provider registry, package checks | **IMPLEMENTED** |
| `rtc status` | Fake provider join probe | **IMPLEMENTED** |
| `db status` | Database provider info | **FOUNDATION** |
| `db migrate` | Delegates to repo Supabase migration workflow | **FOUNDATION** |
| `build` | Delegates to instacollab build | **IMPLEMENTED** |
| `test` | Delegates to repo test scripts | **IMPLEMENTED** |
| `deploy` | Delegates to Vercel/GitHub deploy path | **FOUNDATION** |
| `logs` | SDK observe.getLogs() | **IMPLEMENTED** |
| `dev` | Documents local stack | **FOUNDATION** |
| `mcp list` | Lists MCP tools | **IMPLEMENTED** |

## Local config

Reads `.unilive.json` from cwd:

```json
{
  "projectId": "...",
  "organizationId": "...",
  "credentialPublicId": "...",
  "secretRef": "secret://..."
}
```

Gitignore recommended.

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

## Design

Same contracts as API and MCP — no parallel business logic. Delegates heavy work to existing repo scripts (`pnpm --filter ...`).

## Stage C target

- [ ] Complete `unilive start` local stack orchestration (postgres + api + rtc-fake + mcp)
- [ ] npm bin publish prep
- [ ] `--json` output on all commands for scripting

## Evidence

`scripts/test-stage-b.mjs` → `cli_doctor_and_rtc_status`
