<!-- RECOVERY 2026-07-30: File physically present in repository. Prior PASS/fail claims are historical and must not be treated as re-verified unless the recovery verification commands succeed independently. -->

# Final fallback matrix (Phase 12)

| Context | Production status | Active fallback | Fallback type | Reduced-motion | Low-perf | Broken-path behavior | Safe for release? | Blocker |
|---------|-------------------|-----------------|---------------|----------------|----------|----------------------|-------------------|---------|
| branding | missing | `/brand/app-logo.png` | local raster | static | static | keep known-good | yes (degraded) | brand pack |
| onboarding | missing | app-logo / tokens | local/CSS | static | static | no blank img | yes (degraded) | slides |
| auth | missing | app-logo / CSS | local/CSS | static | static | no blank img | yes (degraded) | auth art |
| profile setup | missing | app-logo / CSS | local/CSS | static | static | no blank img | yes (degraded) | art |
| discovery | missing | app-logo / CSS chrome | local/CSS | static | static | no blank img | yes (degraded) | discovery art |
| design-system states | n/a | tokens + Lucide | CSS/icon | CSS | — | — | yes | — |
| gifts | missing | legacy `/live-gifts/*.svga` | legacy SVGA | static thumb | static | legacy path | yes (degraded) | gift pack |
| stickers | missing | emoji / Lucide | emoji | emoji | emoji | emoji | yes (degraded) | sticker pack |
| seat interactions | missing | Lucide/CSS | icon | static | static | icon | yes | reserved UI |
| badges | missing | Lucide | icon | icon | icon | icon | yes (degraded) | identity pack |
| rings | missing | CSS status rings | CSS | CSS | CSS | CSS | yes (degraded) | identity pack |
| frames | missing | seat CSS frames | CSS | CSS | CSS | CSS | yes (degraded) | identity pack |
| legal | missing | Lucide + CSS header | icon/CSS | static | static | icon | yes (degraded) | optional |
| sharing (non-QR) | missing | Lucide | icon | icon | icon | icon | yes (degraded) | optional |
| sharing QR | missing | N/A — not in product UI | reserved | — | — | unreachable | yes | do not invent QR |

Blank/broken `<img>` is **not** an acceptable fallback.
