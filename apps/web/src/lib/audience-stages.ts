/** How far a person got in one automation's flow, from `runs.state`. Shared by the server and the Audience page. */
export type RunStage = "matched" | "opening_sent" | "tapped" | "awaiting_follow" | "awaiting_email" | "final_sent" | "failed";

export const STAGE_LABELS: Record<RunStage, string> = {
  matched: "Matched",
  opening_sent: "Opening DM sent",
  tapped: "Tapped the button",
  awaiting_follow: "Waiting for a follow",
  awaiting_email: "Waiting for an email",
  final_sent: "Got the Final DM",
  failed: "Failed",
};
