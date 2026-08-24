import { createExampleButtonPlugin, registerPlugin } from '@unilives/plugin-sdk';
const reg = new Map();
registerPlugin(reg, createExampleButtonPlugin());
console.log(JSON.stringify({ ok: true, plugins: reg.size }));
