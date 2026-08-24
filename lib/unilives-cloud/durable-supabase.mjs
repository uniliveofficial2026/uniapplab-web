/**
 * Supabase-backed persistence for UniLive Cloud control plane.
 * Stores metadata + secretRef only — never plaintext secrets.
 */
export async function loadCloudSnapshot(supabase) {
  const [
    orgs,
    members,
    projects,
    environments,
    secrets,
    providers,
    deployments,
    domains,
    audit,
    usage,
  ] = await Promise.all([
    supabase.from('unilive_organizations').select('*'),
    supabase.from('unilive_organization_members').select('*'),
    supabase.from('unilive_projects').select('*'),
    supabase.from('unilive_environments').select('*'),
    supabase.from('unilive_secret_refs').select('*'),
    supabase.from('unilive_provider_connections').select('*'),
    supabase.from('unilive_deployments').select('*'),
    supabase.from('unilive_domains').select('*'),
    supabase.from('unilive_audit_events').select('*').order('at', { ascending: true }).limit(5000),
    supabase.from('unilive_usage_events').select('*').order('at', { ascending: true }).limit(5000),
  ]);

  const err =
    orgs.error ||
    members.error ||
    projects.error ||
    environments.error ||
    secrets.error ||
    providers.error ||
    deployments.error ||
    domains.error ||
    audit.error ||
    usage.error;
  if (err) throw new Error(`cloud_snapshot_load_failed:${err.message}`);

  return {
    orgs: (orgs.data || []).map((r) => ({
      organizationId: r.organization_id,
      name: r.name,
      ownerActorId: r.owner_actor_id,
      createdAt: r.created_at,
    })),
    members: (members.data || []).map((r) => ({
      memberId: r.member_id,
      organizationId: r.organization_id,
      actorId: r.actor_id,
      role: r.role,
      createdAt: r.created_at,
      revoked: !!r.revoked,
    })),
    projects: (projects.data || []).map((r) => ({
      projectId: r.project_id,
      organizationId: r.organization_id,
      name: r.name,
      controlPlaneProjectId: r.control_plane_project_id,
      createdAt: r.created_at,
      createdBy: r.created_by,
      deleted: !!r.deleted,
      deletedAt: r.deleted_at,
    })),
    environments: (environments.data || []).map((r) => ({
      environmentId: r.environment_id,
      projectId: r.project_id,
      kind: r.kind,
      createdAt: r.created_at,
    })),
    secrets: (secrets.data || []).map((r) => ({
      secretId: r.secret_id,
      projectId: r.project_id,
      environmentId: r.environment_id,
      name: r.name,
      secretRef: r.secret_ref,
      status: r.status,
      version: r.version,
      createdAt: r.created_at,
      createdBy: r.created_by,
    })),
    providers: (providers.data || []).map((r) => ({
      providerConnectionId: r.provider_connection_id,
      projectId: r.project_id,
      environmentId: r.environment_id,
      providerType: r.provider_type,
      capabilities: r.capabilities || [],
      secretRef: r.secret_ref,
      status: r.status,
      lastCheckedAt: r.last_checked_at,
      createdAt: r.created_at,
    })),
    deployments: (deployments.data || []).map((r) => ({
      deploymentId: r.deployment_id,
      projectId: r.project_id,
      environmentId: r.environment_id,
      gitSha: r.git_sha,
      provider: r.provider,
      providerDeploymentId: r.provider_deployment_id,
      status: r.status,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      health: r.health,
      rollbackTarget: r.rollback_target,
    })),
    domains: (domains.data || []).map((r) => ({
      domainId: r.domain_id,
      projectId: r.project_id,
      environmentId: r.environment_id,
      domain: r.domain,
      verificationStatus: r.verification_status,
      tlsStatus: r.tls_status,
      providerMapping: r.provider_mapping,
      createdAt: r.created_at,
    })),
    audit: (audit.data || []).map((r) => ({
      auditId: r.audit_id,
      action: r.action,
      resource: r.resource,
      actor: r.actor,
      details: r.details || {},
      at: r.at,
      platformVersion: r.platform_version,
    })),
    usage: (usage.data || []).map((r) => ({
      eventId: r.event_id,
      projectId: r.project_id,
      environmentId: r.environment_id,
      kind: r.kind,
      amount: Number(r.amount || 1),
      at: r.at,
    })),
  };
}

export function createSupabaseCloudDurable(supabase) {
  /** @type {Promise<unknown>[]} */
  const pending = [];

  function track(p) {
    const wrapped = Promise.resolve(p).catch((err) => {
      console.error('[unilive-cloud-durable]', err?.message || err);
    });
    pending.push(wrapped);
    return wrapped;
  }

  return {
    async flush() {
      await Promise.all(pending.splice(0, pending.length));
    },
    saveOrganization(org) {
      return track(
        supabase.from('unilive_organizations').upsert({
          organization_id: org.organizationId,
          name: org.name,
          owner_actor_id: org.ownerActorId,
          created_at: org.createdAt,
          updated_at: new Date().toISOString(),
        }),
      );
    },
    saveMember(m) {
      return track(
        supabase.from('unilive_organization_members').upsert({
          member_id: m.memberId,
          organization_id: m.organizationId,
          actor_id: m.actorId,
          role: m.role,
          created_at: m.createdAt,
          revoked: !!m.revoked,
        }),
      );
    },
    saveProject(p) {
      return track(
        supabase.from('unilive_projects').upsert({
          project_id: p.projectId,
          organization_id: p.organizationId,
          name: p.name,
          control_plane_project_id: p.controlPlaneProjectId || null,
          created_at: p.createdAt,
          updated_at: new Date().toISOString(),
          created_by: p.createdBy || null,
          deleted: !!p.deleted,
          deleted_at: p.deletedAt || null,
        }),
      );
    },
    saveEnvironment(e) {
      return track(
        supabase.from('unilive_environments').upsert({
          environment_id: e.environmentId,
          project_id: e.projectId,
          kind: e.kind,
          created_at: e.createdAt,
        }),
      );
    },
    saveSecret(s) {
      return track(
        supabase.from('unilive_secret_refs').upsert({
          secret_id: s.secretId,
          project_id: s.projectId,
          environment_id: s.environmentId,
          name: s.name,
          secret_ref: s.secretRef,
          status: s.status,
          version: s.version,
          created_at: s.createdAt,
          created_by: s.createdBy || null,
        }),
      );
    },
    saveProvider(p) {
      return track(
        supabase.from('unilive_provider_connections').upsert({
          provider_connection_id: p.providerConnectionId,
          project_id: p.projectId,
          environment_id: p.environmentId,
          provider_type: p.providerType,
          capabilities: p.capabilities || [],
          secret_ref: p.secretRef || null,
          status: p.status,
          last_checked_at: p.lastCheckedAt || null,
          created_at: p.createdAt,
        }),
      );
    },
    saveDeployment(d) {
      return track(
        supabase.from('unilive_deployments').upsert({
          deployment_id: d.deploymentId,
          project_id: d.projectId,
          environment_id: d.environmentId,
          git_sha: d.gitSha,
          provider: d.provider || null,
          provider_deployment_id: d.providerDeploymentId || null,
          status: d.status,
          started_at: d.startedAt,
          completed_at: d.completedAt || null,
          health: d.health || null,
          rollback_target: d.rollbackTarget || null,
        }),
      );
    },
    saveDomain(d) {
      return track(
        supabase.from('unilive_domains').upsert({
          domain_id: d.domainId,
          project_id: d.projectId,
          environment_id: d.environmentId || null,
          domain: d.domain,
          verification_status: d.verificationStatus,
          tls_status: d.tlsStatus,
          provider_mapping: d.providerMapping || null,
          created_at: d.createdAt,
        }),
      );
    },
    saveAudit(a) {
      return track(
        supabase.from('unilive_audit_events').upsert({
          audit_id: a.auditId,
          action: a.action,
          resource: a.resource || null,
          actor: a.actor || null,
          details: a.details || {},
          at: a.at,
          platform_version: a.platformVersion || null,
        }),
      );
    },
    saveUsage(u) {
      return track(
        supabase.from('unilive_usage_events').upsert({
          event_id: u.eventId,
          project_id: u.projectId || null,
          environment_id: u.environmentId || null,
          kind: u.kind,
          amount: u.amount ?? 1,
          at: u.at,
        }),
      );
    },
  };
}
