# FINAL — AI Builder

## Package

`@unilives/ai-builder` v0.1.0

## Pipeline

Requirement → ExecutionPlan → ProjectGraphPatch → validate → apply → generateAppSource

## Security

- Allowed ops whitelist
- Requirement sanitization (no shell/path/deploy/secret patterns)
- Privileged permission grants explicit
- Mock provider (deterministic, no API key)

## Repair

Up to 3 validation/apply repair attempts.

## Classification

**PRODUCTION_READY MVP** for safe graph authoring in tests and examples.
