/** Catalog is authored in config/ui-catalog and published into ui_experiences / ui_snapshots. */
export const UI_CATALOG_TABLES = [
  "ui_experiences",
  "ui_experience_versions",
  "ui_nodes",
  "ui_node_versions",
  "ui_components",
  "ui_component_versions",
  "ui_elements",
  "ui_element_versions",
  "ui_layout_versions",
  "ui_design_versions",
  "ui_mockup_versions",
  "ui_asset_versions",
  "ui_snapshots",
  "ui_snapshot_items",
  "ui_assignment_rules",
  "ui_session_assignments",
  "ui_config_audit",
] as const;

export function usesExistingUiConfigTables(): true {
  return true;
}
