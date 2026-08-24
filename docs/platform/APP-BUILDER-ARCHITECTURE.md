# App Builder Architecture

Foundation for visual/no-code app composition via `createProjectGraph()` in platform-core.

## ProjectGraph schema (v1)

```javascript
{
  version: 1,
  projectId, name,
  pages: [],
  routes: [],
  components: [],
  dataSources: [],
  bindings: {
    data: [], actions: [], permissions: [],
    auth: [], rtc: [], storage: [], deployment: []
  }
}
```

## Mutators

- `addPage({ path, title, ... })`
- `addRoute({ path, pageId, ... })`
- `addComponent({ type, props, ... })`
- `toJSON()` — serializable for MCP/CLI/API

## API exposure

`GET /v1/projects/:projectId` returns empty graph skeleton alongside project metadata.

## Intended consumers

| Consumer | Use |
|---|---|
| MCP agents | Generate pages/routes programmatically |
| CLI | Scaffold new apps |
| Studio (future) | Visual editor |
| Deploy | Resolve bindings → env provider connections |

## RTC bindings

Graph `bindings.rtc[]` will reference room types, default roles, and token endpoints — not yet populated in reference app.

## Status

**FOUNDATION_ONLY** — graph structure exists; no visual builder UI in Stage B.

## Relation to instacollab

Reference app is hand-authored React, not graph-driven. Graph models the target platform abstraction layer.
