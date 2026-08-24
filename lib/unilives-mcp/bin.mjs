#!/usr/bin/env node
import { createUniLiveMcpServer } from './index.mjs';
import { createControlPlaneStore } from '@unilives/platform-core';

const cp = createControlPlaneStore();
const org = cp.createOrganization({ name: 'local', actor: 'cli' });
const project = cp.createProject({ organizationId: org.organizationId, name: 'default', actor: 'cli' });
const cred = cp.createApiCredential({
  projectId: project.projectId,
  kind: 'mcp',
  scopes: ['*'],
  actor: 'cli',
});

const server = createUniLiveMcpServer({
  controlPlane: cp,
  credentialPublicId: cred.publicId,
  requireAuth: true,
});

const [,, tool, ...rest] = process.argv;
if (!tool || tool === 'list') {
  console.log(JSON.stringify({ tools: server.listTools(), projectId: project.projectId, credentialPublicId: cred.publicId }, null, 2));
  process.exit(0);
}

const args = {};
for (const part of rest) {
  const [k, v] = part.split('=');
  if (k) args[k] = v ?? true;
}
if (!args.projectId) args.projectId = project.projectId;

const result = await server.callTool(tool, args);
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok === false ? 1 : 0);
