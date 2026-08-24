# @unilives/ai-builder

Provider-neutral AI planner for safe **ProjectGraph** authoring.

## Flow

1. Natural-language requirement
2. Structured `ExecutionPlan` from an `AIProvider`
3. `ProjectGraphPatch` proposals
4. Strict schema validation (allowed ops only — no shell commands)
5. Safe diff apply via `@unilives/project-graph`
6. Codegen hook via `generateAppSource`

## Security

- Requirements and patch params are scanned for shell injection, path traversal, and deploy/secret patterns.
- Privileged permissions (`deploy.mutate`, `secret.read`, `shell`, `filesystem.root`, `db.admin`) require explicit grants.
- Mock provider is deterministic and requires no paid API.

## Bounded repair

`createPlanner` retries validation/apply up to `MAX_REPAIR_ATTEMPTS` (default 3).

```js
import { createPlanner } from '@unilives/ai-builder';

const planner = createPlanner();
const result = await planner.buildFromRequirement({
  projectId: 'demo',
  requirement: 'Create a basic home page starter',
});
console.log(result.ok, result.source);
```

## Tests

```bash
pnpm --filter @unilives/ai-builder test
```
