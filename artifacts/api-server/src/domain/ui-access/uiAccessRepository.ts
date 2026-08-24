/**
 * Repository for UI access. Uses existing ui_* tables from ui_config / ui_session_snapshots.
 * Does not create duplicate tables.
 */
import { getSupabaseService } from "../../lib/supabase";

export async function loadSnapshotRow(snapshotId: string) {
  const { data, error } = await getSupabaseService()
    .from("ui_snapshots")
    .select("id, checksum, lockfile_json, compatible_room_types, status")
    .eq("id", snapshotId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadAssignmentRules() {
  const { data, error } = await getSupabaseService()
    .from("ui_assignment_rules")
    .select("*")
    .eq("active", true);
  if (error) throw error;
  return data || [];
}

export async function loadSessionAssignment(sessionId: string) {
  const { data, error } = await getSupabaseService()
    .from("ui_session_assignments")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
