export type PublicationSummary = {
  jobId: string;
  status: string;
  snapshotId: string | null;
  configVersionId: string | null;
};

export function publicationIsTerminal(status: string): boolean {
  return status === "succeeded" || status === "failed" || status === "rolled_back";
}
