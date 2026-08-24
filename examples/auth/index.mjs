import { createUniLive } from '@unilives/sdk';
import { AuthError } from '@unilives/errors';
const uni = createUniLive({ projectId: 'example_auth', environment: 'local' });
try { await uni.auth.signIn(); } catch (e) { if (!(e instanceof AuthError)) throw e; }
console.log(JSON.stringify({ ok: true, demo: 'auth_adapter_required_is_typed' }));
