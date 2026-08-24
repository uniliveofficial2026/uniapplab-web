# Final Rollback

1. DNS: restore CNAME `app` → `5fb89dd6.translate-cf.weglot.io` (DNS-only) OR detach Workers domain
2. Worker: previous script version / route delete
3. Render: redeploy prior deploy id on `uniapplab-web` / `uniapplab-spa` / greedy
