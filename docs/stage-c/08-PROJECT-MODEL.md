# 08 — Project Model

Projects are the top-level tenant boundary for UniLive Platform apps.

## Hierarchy

```
Organization
  └── Project
        └── Environment (development | preview | production)
              └── Provider connections (per kind)
```

## Project graph

`createProjectGraph({ projectId, name })` — machine-readable app model:

- `pages`, `routes`, `components`, `dataSources`
- `bindings`: data, actions, permissions, auth, rtc, storage, deployment

Version: `1`. Serializable via `toJSON()`.

## API

| Method | Path | Action |
|---|---|---|
| GET | `/v1/projects` | List projects |
| POST | `/v1/projects` | Create project (+ auto environments) |
| GET | `/v1/projects/:projectId` | Project + environments + empty graph |
| GET | `/v1/environments?projectId=` | List environments |

## Local config

CLI `init` produces `.unilive.json` (see `06-CLI.md`).

## SDK binding

`createUniLive({ projectId, credentialPublicId, controlPlane, provider })` scopes all capability calls to a project.

## Reference app mapping

Today `uniapplab-web` bootstrap project maps to the instacollab deployment. Full project graph authoring is future App Builder scope.

## App Builder (foundation)

Graph structure exists; no visual builder UI. MCP agents can programmatically add pages/routes.

## Stage C notes

- Graph `bindings.rtc[]` should reference room types, default roles, token endpoints
- Not yet populated in reference app (hand-authored React)
- Stage C: document graph schema as stable v1 contract

## Status

**FOUNDATION** — structure implemented; productization = schema docs + MCP examples.
