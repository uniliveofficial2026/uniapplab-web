# AI Builder

## Package

`@unilives/ai-builder` — `lib/unilives-ai-builder/`

## Flow

1. Natural-language requirement
2. `AIProvider` produces structured `ExecutionPlan`
3. `ProjectGraphPatch` proposals (allowed ops only)
4. Schema validation via `@unilives/project-graph`
5. Safe diff apply + `generateAppSource` codegen hook

## Allowed patch operations

`addPage`, `addComponent`, `placeComponent`, `updateNodeProps`, `bindAction`, `setProjectName`

## Security

- `sanitizeRequirement` blocks shell injection, path traversal, deploy/secret patterns
- Privileged permissions require explicit `grantedPermissions`
- Mock provider is deterministic (no paid API required)
- Bounded repair: `MAX_REPAIR_ATTEMPTS` = 3

## Tests

`lib/unilives-ai-builder/test/ai-builder.test.mjs`, `scripts/stage-d-security-matrix.mjs`

## Example

`examples/ai-builder/index.mjs`

## Classification

**PRODUCTION_READY MVP** for safe ProjectGraph authoring in tests/examples.
