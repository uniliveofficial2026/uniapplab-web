import { createMarketplaceRegistry } from '@unilives/marketplace';

const registry = createMarketplaceRegistry({ seed: true });
const basic = registry.get('unilives.template.basic');
console.log('PASS', JSON.stringify({ ok: true, templates: registry.list().length, basic: basic.name }));
