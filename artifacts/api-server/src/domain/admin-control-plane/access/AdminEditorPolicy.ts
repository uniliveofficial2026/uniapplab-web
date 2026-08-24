import { editorForType, isUnknownTypeReadOnly, editPermissionForType } from "@workspace/admin-access";

export function assertEditableType(type: string): void {
  if (isUnknownTypeReadOnly(type) || !editPermissionForType(type)) {
    throw Object.assign(new Error("resource type is read-only"), { status: 409, code: "error.conflict" });
  }
}

export function resolveEditor(type: string): string {
  return editorForType(type);
}
