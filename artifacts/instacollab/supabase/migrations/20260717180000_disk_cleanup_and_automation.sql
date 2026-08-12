-- Fix disk pressure from ephemeral party-room realtime bus.
-- party_room_sync_events bloated to ~1.5GB and put the Free-tier DB into read-only.
-- These rows are fanout-only (clients fetch recent limit 50); safe to prune.

TRUNCATE TABLE public.party_room_sync_events;

CREATE OR REPLACE FUNCTION public.prune_party_room_sync_events(retention_hours integer DEFAULT 6)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted integer;
BEGIN
  IF retention_hours <= 0 THEN
    DELETE FROM public.party_room_sync_events;
  ELSE
    DELETE FROM public.party_room_sync_events
    WHERE created_at < now() - make_interval(hours => retention_hours);
  END IF;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_party_room_sync_events(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_party_room_sync_events(integer) TO service_role;

-- Automation config for Edge Function (replaces filesystem auto-deploy.json on Vercel).
CREATE TABLE IF NOT EXISTS public.platform_automation_config (
  id text PRIMARY KEY DEFAULT 'default',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_automation_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_automation_config_select_public ON public.platform_automation_config;
CREATE POLICY platform_automation_config_select_public
  ON public.platform_automation_config FOR SELECT USING (true);

INSERT INTO public.platform_automation_config (id, config)
VALUES (
  'default',
  jsonb_build_object(
    'autopilot', false,
    'enabled', false,
    'autoPush', false,
    'githubActionsDeploy', false,
    'autoMachineLearning', false,
    'liveCloudSyncAggressive', true
  )
)
ON CONFLICT (id) DO NOTHING;
