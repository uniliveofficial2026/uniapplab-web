-- UniLive Cloud durable control plane (production)
-- Applied to production Supabase; server/service_role authority only.

create table if not exists public.unilive_organizations (
  organization_id text primary key,
  name text not null,
  owner_actor_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.unilive_organization_members (
  member_id text primary key,
  organization_id text not null references public.unilive_organizations(organization_id) on delete cascade,
  actor_id text not null,
  role text not null check (role in ('organization_owner','organization_admin','developer','operator','viewer')),
  created_at timestamptz not null default now(),
  revoked boolean not null default false,
  unique (organization_id, actor_id)
);
create index if not exists unilive_org_members_org_idx on public.unilive_organization_members(organization_id);
create index if not exists unilive_org_members_actor_idx on public.unilive_organization_members(actor_id);

create table if not exists public.unilive_projects (
  project_id text primary key,
  organization_id text not null references public.unilive_organizations(organization_id) on delete cascade,
  name text not null,
  control_plane_project_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  deleted boolean not null default false,
  deleted_at timestamptz
);
create index if not exists unilive_projects_org_idx on public.unilive_projects(organization_id) where deleted = false;

create table if not exists public.unilive_environments (
  environment_id text primary key,
  project_id text not null references public.unilive_projects(project_id) on delete cascade,
  kind text not null check (kind in ('development','preview','production')),
  created_at timestamptz not null default now(),
  unique (project_id, kind)
);

create table if not exists public.unilive_secret_refs (
  secret_id text primary key,
  project_id text not null references public.unilive_projects(project_id) on delete cascade,
  environment_id text not null references public.unilive_environments(environment_id) on delete cascade,
  name text not null,
  secret_ref text not null,
  status text not null default 'active',
  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by text,
  unique (project_id, environment_id, name)
);

create table if not exists public.unilive_provider_connections (
  provider_connection_id text primary key,
  project_id text not null references public.unilive_projects(project_id) on delete cascade,
  environment_id text not null references public.unilive_environments(environment_id) on delete cascade,
  provider_type text not null,
  capabilities jsonb not null default '[]'::jsonb,
  secret_ref text,
  status text not null default 'HEALTHY',
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.unilive_deployments (
  deployment_id text primary key,
  project_id text not null references public.unilive_projects(project_id) on delete cascade,
  environment_id text not null references public.unilive_environments(environment_id) on delete cascade,
  git_sha text not null,
  provider text,
  provider_deployment_id text,
  status text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  health text,
  rollback_target text
);

create table if not exists public.unilive_domains (
  domain_id text primary key,
  project_id text not null references public.unilive_projects(project_id) on delete cascade,
  environment_id text references public.unilive_environments(environment_id) on delete set null,
  domain text not null,
  verification_status text not null default 'pending',
  tls_status text not null default 'pending',
  provider_mapping text,
  created_at timestamptz not null default now()
);

create table if not exists public.unilive_audit_events (
  audit_id text primary key,
  action text not null,
  resource text,
  actor text,
  details jsonb not null default '{}'::jsonb,
  at timestamptz not null default now(),
  platform_version text
);

create table if not exists public.unilive_usage_events (
  event_id text primary key,
  project_id text,
  environment_id text,
  kind text not null,
  amount numeric not null default 1,
  at timestamptz not null default now()
);

alter table public.unilive_organizations enable row level security;
alter table public.unilive_organization_members enable row level security;
alter table public.unilive_projects enable row level security;
alter table public.unilive_environments enable row level security;
alter table public.unilive_secret_refs enable row level security;
alter table public.unilive_provider_connections enable row level security;
alter table public.unilive_deployments enable row level security;
alter table public.unilive_domains enable row level security;
alter table public.unilive_audit_events enable row level security;
alter table public.unilive_usage_events enable row level security;

revoke all on public.unilive_organizations from anon, authenticated;
revoke all on public.unilive_organization_members from anon, authenticated;
revoke all on public.unilive_projects from anon, authenticated;
revoke all on public.unilive_environments from anon, authenticated;
revoke all on public.unilive_secret_refs from anon, authenticated;
revoke all on public.unilive_provider_connections from anon, authenticated;
revoke all on public.unilive_deployments from anon, authenticated;
revoke all on public.unilive_domains from anon, authenticated;
revoke all on public.unilive_audit_events from anon, authenticated;
revoke all on public.unilive_usage_events from anon, authenticated;

grant all on public.unilive_organizations to service_role;
grant all on public.unilive_organization_members to service_role;
grant all on public.unilive_projects to service_role;
grant all on public.unilive_environments to service_role;
grant all on public.unilive_secret_refs to service_role;
grant all on public.unilive_provider_connections to service_role;
grant all on public.unilive_deployments to service_role;
grant all on public.unilive_domains to service_role;
grant all on public.unilive_audit_events to service_role;
grant all on public.unilive_usage_events to service_role;
