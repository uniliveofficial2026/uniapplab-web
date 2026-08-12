# Audio pipeline helpers

Lip-sync and SFX staging for UniLive’s characters.

- Put masters in `assets-source/unilives-character/audio/`
- Use FFmpeg for format conversion before runtime packaging
- Do not commit raw recordings with personal PII

Example convert:

```bash
ffmpeg -y -i ../../assets-source/unilives-character/audio/raw.wav \
  -ac 1 -ar 24000 \
  ../../assets-source/unilives-character/audio/lipsync-ready.wav
```
