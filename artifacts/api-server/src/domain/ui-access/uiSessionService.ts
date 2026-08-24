import { ttlMsForSessionType, type UiSessionType } from "../uiConfig/assignmentResolve";

export type RuntimeSessionType = "anonymous-app" | "authenticated-app" | "live-room" | "pk" | "admin-preview";

export function toInternalSessionType(type: RuntimeSessionType): UiSessionType {
  if (type === "anonymous-app") return "anonymous";
  if (type === "authenticated-app") return "app";
  if (type === "live-room") return "live_room";
  if (type === "admin-preview") return "admin_preview";
  return "pk";
}

export function sessionExpiresAt(sessionType: UiSessionType, now = Date.now()): string {
  return new Date(now + ttlMsForSessionType(sessionType)).toISOString();
}
