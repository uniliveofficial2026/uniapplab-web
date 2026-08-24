import { createUniLiveCloud } from '@unilives/cloud';

const cloud = createUniLiveCloud();
const actorId = 'user_demo';
const org = cloud.createOrganization({ name: 'Example Org', ownerActorId: actorId });
const created = cloud.createProject({ organizationId: org.organizationId, name: 'Demo', actorId });
console.log(
  'PASS',
  JSON.stringify({
    ok: true,
    orgId: org.organizationId,
    projects: cloud.listProjects(org.organizationId, actorId).length,
    envs: created.environments.length,
  }),
);
