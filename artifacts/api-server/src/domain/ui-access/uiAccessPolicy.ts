/** Visual UI snapshots cannot override backend authority. */

export const UI_ACCESS_CANNOT_OVERRIDE = [
  "wallet.balance",
  "gift.price",
  "pk.score",
  "seat.ownership",
  "entitlement.grant",
  "identity.role",
  "live.room_type",
] as const;

export function visualSnapshotMayOverride(field: string): boolean {
  return !(UI_ACCESS_CANNOT_OVERRIDE as readonly string[]).includes(field);
}
