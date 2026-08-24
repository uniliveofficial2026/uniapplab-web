# Stage C Security

## Secret handling
- Never commit `local/.generated/`, `.unilive.json`, or runtime secrets.
- Observe redaction strips Authorization, JWT, API keys, private keys, passwords.
- MCP/CLI never return provider secrets.

## Vulnerability reporting
Use the repository `SECURITY.md` channel when present. Until formal open-source publish, treat reports as private to maintainers.

## Supported versions
Stage C packages ship as `0.1.0` platform line while license/publication remains `RELEASE_READY_EXTERNAL_STEP`.

## Builder / Plugin / CLI
- No `eval` on ProjectGraph.
- Plugin dangerous capabilities blocked.
- CLI uses structured process args; JSON mode does not mix banners into stdout.
