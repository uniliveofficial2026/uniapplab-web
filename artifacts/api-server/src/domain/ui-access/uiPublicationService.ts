export function publicationGate(input: { role: string; status: "draft" | "published"; sessionType: string }): boolean {
  if (input.role !== "admin") return false;
  if (input.sessionType !== "admin_preview" && input.status !== "published") return false;
  return true;
}
