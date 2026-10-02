export type PublicationJob = {
  id: string;
  post_id: string;
  post_version: number;
  title: string;
  state:
    | "queued"
    | "building"
    | "deploying"
    | "succeeded"
    | "failed"
    | "needs_review";
  message: string;
  created_at: string;
  updated_at: string;
};
export type PublicationStatus = {
  enabled: boolean;
  available: boolean;
  siteUrl: string | null;
  job: PublicationJob | null;
};
export function publicationActive(job: PublicationJob | null) {
  return (
    !!job &&
    ["queued", "building", "deploying", "needs_review"].includes(job.state)
  );
}
