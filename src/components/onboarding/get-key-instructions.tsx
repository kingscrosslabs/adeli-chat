import { ExternalLink } from "lucide-react";

const ADELI_URL = "https://app.tryadeli.com";

const STEPS: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: "Create an Adeli account",
    body: <>Go to <Link href={`${ADELI_URL}/sign-in`}>app.tryadeli.com</Link> and sign in with Google. Your first sign-in creates your account and a default profile. It&apos;s free.</>,
  },
  {
    title: "Connect Instagram in Adeli (optional)",
    body: <>Open <Link href={`${ADELI_URL}/accounts`}>Accounts</Link> and connect your Instagram Business or Creator account. You can also do this from Adeli Chat in the next step.</>,
  },
  {
    title: "Create an API key",
    body: <>Open <Link href={`${ADELI_URL}/settings/api-keys`}>API keys</Link>, label it <span className="font-medium text-foreground">Adeli Chat</span>, and click <span className="font-medium text-foreground">Create key</span>.</>,
  },
  {
    title: "Copy the key now",
    body: <>Adeli shows it only once. It starts with <code className="font-mono text-[0.82rem] text-foreground">rk_live_</code>. Paste it below.</>,
  },
];

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-primary underline-offset-4 hover:underline">
      {children}
      <ExternalLink className="size-3" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/** Numbered "how to get a key" steps (FR-S.2), shared by /setup and the README. */
export function GetKeyInstructions() {
  return (
    <ol className="space-y-4">
      {STEPS.map((step, index) => (
        <li key={step.title} className="flex gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">{index + 1}</span>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-medium">{step.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
