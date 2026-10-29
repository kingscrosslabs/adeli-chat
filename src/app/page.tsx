import { redirect } from "next/navigation";

/**
 * `/` goes to your automations (PRD §4). `proxy.ts` and the automations pages
 * send you to the first unfinished onboarding step instead.
 */
export default function Home() {
  redirect("/automations");
}
