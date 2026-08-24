# DNS — Production Cutover

## BEFORE (rollback target)
| Name | Type | Content | Proxied | TTL | ID |
|---|---|---|---|---|---|
| app.uniapplab.com | CNAME | 5fb89dd6.translate-cf.weglot.io | false | 3600 | fa09e16334e6208065d267a494224ced |

## AFTER
| Name | Type | Content | Proxied | Notes |
|---|---|---|---|---|
| app.uniapplab.com | AAAA | 100:: | true | Workers Custom Domain (`uniapplab-app`) |
| Worker route | `app.uniapplab.com/*` | script `uniapplab-app` | — | Required for traffic to hit Worker |

**Do not modify** apex/www/mail/TXT unless required.

Rollback: detach Workers domain + restore CNAME to Weglot target above (or previous Worker version).
