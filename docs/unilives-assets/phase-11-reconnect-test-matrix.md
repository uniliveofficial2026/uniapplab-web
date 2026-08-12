# Phase 11 reconnect test matrix

| scenario | expected | observed (code review / local) | notes |
|---|---|---|---|
| stable network | one LiveKit room | unchanged | |
| brief offline | retry then recover | bounded retries party/game | |
| prolonged offline | stop after 5 retries | fixed | |
| room switch | prior disconnect + audio detach | fixed | |
| logout | presence timer paused; surfaces stop | fixed/verified | |
| account switch | surfaces restart for new user | sessionManager | |
| remount discovery | channel removed then new unique topic | existing | |
| stream leave mid-join | leave after stale join | fixed | |
| QR/legal/gifts | unchanged | — | out of scope |
