#!/usr/bin/env node
/**
 * GitHub Codespaces setup help.
 * Usage: pnpm run codespace:setup
 */
const REPO = 'uniliveofficial2026/uniapplab-web';

console.log('');
console.log('=== GitHub Codespaces ===');
console.log('');
console.log('The message "You don\'t have any codespaces with this repository');
console.log('checked out" means you need to CREATE a codespace first (not an error).');
console.log('');
console.log('1) Open:');
console.log(`   https://github.com/${REPO}`);
console.log('');
console.log('2) Click the green Code button → Codespaces tab');
console.log('');
console.log('3) Choose "Create codespace on main"');
console.log('   (uses .devcontainer/devcontainer.json in this repo)');
console.log('');
console.log('4) After the container builds (~2–5 min):');
console.log('   - Add .env secrets in the Codespace terminal or GitHub Codespaces secrets');
console.log('   - Run: pnpm develop');
console.log('');
console.log('Resume an existing codespace:');
console.log(`   https://github.com/codespaces → pick ${REPO}`);
console.log('');
console.log('Local development (no Codespace):');
console.log('   pnpm install && pnpm develop');
console.log('   Use Cursor/VS Code on your Mac — you do not need Codespaces locally.');
console.log('');
